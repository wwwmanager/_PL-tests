import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { hashToken, generateRefreshToken, addDays, getRefreshCookieOptions, REFRESH_TTL_DAYS } from '../utils/refreshToken';
import { prisma } from '../db/prisma';
import { signAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);

        // Optionally set refresh token as HttpOnly cookie
        if (result.data?.refreshToken) {
            res.cookie('refreshToken', result.data.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/auth',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const user = await authService.findUserById(userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Extract role from token or roles relation
        const primaryRole = (req as any).user?.role ?? user.roles[0]?.role.code ?? 'user';
        const organizationId = (req as any).user?.organizationId ?? user.organizationId;
        const departmentId = (req as any).user?.departmentId ?? user.departmentId;

        // REL-001: Get linked driverId if user has employee link
        let driverId: string | null = null;
        if (user.employeeId) {
            const driver = await prisma.driver.findUnique({
                where: { employeeId: user.employeeId }
            });
            driverId = driver?.id ?? null;
        }

        // Build response data
        const userData = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: primaryRole,
            organizationId: organizationId,
            organizationName: (user as any).organization?.shortName || (user as any).organization?.name || null,
            departmentId: departmentId,
            departmentName: (user as any).department?.name || null,
            employeeId: user.employeeId || null,
            driverId: driverId
        };

        res.json({
            success: true,
            data: {
                user: userData,
                debug: {
                    timestamp: new Date().toISOString(),
                    backendVersion: '1.0.0',
                    userId: userData.id,
                    organizationId: userData.organizationId,
                    departmentId: userData.departmentId,
                    role: userData.role,
                    employeeId: userData.employeeId,
                    driverId: userData.driverId
                }
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * REL-402: Refresh token endpoint
 * - Validates refresh token (from cookie or body)
 * - Issues new access token with fresh claims from DB
 * - Rotates refresh token (revoke old, issue new)
 */
export async function refresh(req: Request, res: Response, next: NextFunction) {
    try {
        // Get refresh token from cookie or body
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ success: false, error: 'No refresh token provided' });
        }

        const tokenHash = hashToken(refreshToken);

        // Find token by hash
        const tokenRow = await prisma.refreshToken.findFirst({
            where: { tokenHash },
            select: { id: true, userId: true, revokedAt: true, expiresAt: true }
        });

        // Validate token
        if (!tokenRow) {
            return res.status(401).json({ success: false, error: 'Invalid refresh token' });
        }
        if (tokenRow.revokedAt) {
            return res.status(401).json({ success: false, error: 'Refresh token revoked' });
        }
        if (tokenRow.expiresAt <= new Date()) {
            return res.status(401).json({ success: false, error: 'Refresh token expired' });
        }

        // Get user with current data (important: use DB values, not old token claims)
        const user = await prisma.user.findUnique({
            where: { id: tokenRow.userId },
            select: {
                id: true,
                organizationId: true,
                departmentId: true,
                employeeId: true,
                isActive: true,
                tokenVersion: true,
                roles: {
                    include: { role: true }
                }
            }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, error: 'User inactive or not found' });
        }

        const primaryRole = user.roles[0]?.role.code || 'user';
        const now = new Date();

        // Atomic: revoke old token (one-time!), create new token, issue new access token
        const result = await prisma.$transaction(async (tx) => {
            // 1) One-time rotation: use updateMany to verify exactly 1 row affected
            const revokeResult = await tx.refreshToken.updateMany({
                where: {
                    id: tokenRow.id,
                    revokedAt: null  // Must be currently active
                },
                data: { revokedAt: now }
            });

            // If count !== 1, token was already used by concurrent request
            if (revokeResult.count !== 1) {
                throw new UnauthorizedError('REFRESH_TOKEN_REUSED');
            }

            // 2) Create new refresh token
            const newRefreshToken = generateRefreshToken();
            const newTokenHash = hashToken(newRefreshToken);
            const newExpiresAt = addDays(now, REFRESH_TTL_DAYS);

            await tx.refreshToken.create({
                data: {
                    userId: user.id,
                    tokenHash: newTokenHash,
                    expiresAt: newExpiresAt
                }
            });

            // 3) Sign new access token with FRESH claims from DB
            const accessToken = signAccessToken({
                id: user.id,
                organizationId: user.organizationId,
                departmentId: user.departmentId,
                role: primaryRole,
                employeeId: user.employeeId,
                tokenVersion: user.tokenVersion  // AUTH-003
            });

            return { accessToken, newRefreshToken };
        });

        // Set new refresh token cookie using utils
        res.cookie('refreshToken', result.newRefreshToken, getRefreshCookieOptions());

        res.json({
            success: true,
            data: {
                token: result.accessToken,
                refreshToken: result.newRefreshToken // Also return in body for non-cookie clients
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * REL-402: Logout with refresh token revocation
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

        if (refreshToken) {
            const tokenHash = hashToken(refreshToken);

            // Revoke the refresh token
            await prisma.refreshToken.updateMany({
                where: { tokenHash, revokedAt: null },
                data: { revokedAt: new Date() }
            });
        }

        // Clear the cookie
        res.clearCookie('refreshToken', { path: '/auth' });

        res.json({
            success: true,
            data: { message: 'Logged out successfully' }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * AUTH-004.1 — Logout Everywhere
 * Semantic:
 * 1) Increment User.tokenVersion -> immediately invalidates all access tokens (AUTH-003)
 * 2) Revoke ALL active refresh tokens for the user
 * 3) Clear refresh cookie on the current client
 */
export const logoutAll = async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;

    if (!userId) {
        return next(new UnauthorizedError('Требуется авторизация'));
    }

    logger.info({ userId }, 'Logout everywhere requested');

    try {
        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            // 1) Immediately invalidate all access tokens
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { tokenVersion: { increment: 1 } },
                select: { id: true, tokenVersion: true }
            });

            // 2) Revoke ALL active refresh tokens for this user
            const revoked = await tx.refreshToken.updateMany({
                where: {
                    userId: userId,
                    revokedAt: null
                },
                data: {
                    revokedAt: now
                }
            });

            // 3) Create audit log
            await tx.auditLog.create({
                data: {
                    organizationId: organizationId,
                    userId: userId,
                    actionType: 'LOGOUT',
                    entityType: 'AUTH',
                    entityId: userId,
                    description: `Logout everywhere: tokenVersion++ and revoked refresh tokens: ${revoked.count}`,
                    newValue: {
                        tokenVersion: updatedUser.tokenVersion,
                        revokedRefreshTokensCount: revoked.count
                    }
                }
            });

            return {
                tokenVersion: updatedUser.tokenVersion,
                revokedCount: revoked.count
            };
        });

        // 4) Clear refresh cookie on current device
        res.clearCookie('refreshToken', getRefreshCookieOptions());

        logger.info({ userId, revokedCount: result.revokedCount, newTokenVersion: result.tokenVersion },
            'Logout everywhere completed successfully');

        res.json({
            success: true,
            data: result,
            message: 'Выполнен выход со всех устройств'
        });
    } catch (error) {
        logger.error({ error, userId }, 'Logout everywhere failed');
        next(error);
    }
};

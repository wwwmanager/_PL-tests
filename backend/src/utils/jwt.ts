import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface AccessTokenPayload {
    sub: string;
    organizationId: string;
    departmentId: string | null;  // for department-level access control
    role: string;
    employeeId: string | null;    // WB-905
    tokenVersion: number;         // AUTH-003: для мгновенной инвалидации
}

export function signAccessToken(user: {
    id: string;
    organizationId: string;
    departmentId?: string | null;
    role: string;
    employeeId?: string | null;
    tokenVersion: number;         // AUTH-003: обязательное поле
}): string {
    const payload: AccessTokenPayload = {
        sub: user.id,
        organizationId: user.organizationId,
        departmentId: user.departmentId ?? null,
        role: user.role,
        employeeId: user.employeeId ?? null,
        tokenVersion: user.tokenVersion,
    };

    console.log('[signAccessToken] Signing with:', {
        userId: user.id,
        organizationId: user.organizationId,
        departmentId: user.departmentId ?? null,
        role: user.role,
        employeeId: user.employeeId ?? null,
        tokenVersion: user.tokenVersion,
        expiresIn: env.JWT_EXPIRES_IN,
        secretLength: env.JWT_SECRET.length
    });

    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

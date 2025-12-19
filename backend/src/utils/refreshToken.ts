import crypto from 'crypto';
import type { CookieOptions } from 'express';

export const REFRESH_TTL_DAYS = 30;

/**
 * Generate cryptographically secure refresh token
 * base64url: безопасно для cookie/headers
 */
export function generateRefreshToken(): string {
    return crypto.randomBytes(48).toString('base64url');
}

/**
 * Hash refresh token for storage (SHA-256 is sufficient for random tokens)
 * Храним hash в БД, не plaintext
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

/**
 * Get secure cookie options for refresh token
 * ВАЖНО: path должен совпадать с фактическим путём API
 */
export function getRefreshCookieOptions(): CookieOptions {
    const isProd = process.env.NODE_ENV === 'production';

    return {
        httpOnly: true,
        secure: isProd,                // в проде обязательно true, в dev false для http://localhost
        sameSite: 'lax',               // защита от CSRF, но разрешает переходы с других сайтов
        path: '/api/auth',             // ИСПРАВЛЕНО: cookie отправляется только на /api/auth/*
        maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000  // 30 days in ms
    };
}

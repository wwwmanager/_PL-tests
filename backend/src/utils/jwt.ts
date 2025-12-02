import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface AccessTokenPayload {
    sub: string;
    organizationId: string;
    role: string;
}

export function signAccessToken(user: { id: string; organizationId: string; role: string }): string {
    const payload: AccessTokenPayload = {
        sub: user.id,
        organizationId: user.organizationId,
        role: user.role,
    };

    console.log('[signAccessToken] Signing with:', {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        expiresIn: env.JWT_EXPIRES_IN,
        secretLength: env.JWT_SECRET.length
    });

    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

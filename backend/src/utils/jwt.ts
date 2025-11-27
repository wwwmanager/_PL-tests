import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface AccessTokenPayload {
    sub: string;
    organizationId: string;
    role: string;
}

export function signAccessToken(user: { id: string; organizationId: string; role: string }) {
    const payload: AccessTokenPayload = {
        sub: user.id,
        organizationId: user.organizationId,
        role: user.role
    };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

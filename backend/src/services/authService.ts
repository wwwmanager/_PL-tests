import { prisma } from '../db/prisma';
import { comparePassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

export async function login(email: string, password: string) {
    const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true }
    });

    if (!user || !user.isActive) {
        throw new UnauthorizedError('Неверный логин или пароль');
    }

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
        throw new UnauthorizedError('Неверный логин или пароль');
    }

    const accessToken = signAccessToken({
        id: user.id,
        organizationId: user.organizationId,
        role: user.role
    });

    return {
        accessToken,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            organizationId: user.organizationId,
            organizationName: user.organization.name,
            role: user.role
        }
    };
}

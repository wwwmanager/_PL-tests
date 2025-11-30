// authService - TypeORM version
import { AppDataSource } from '../db/data-source';
import { User } from '../entities/User';
import bcrypt from 'bcrypt';
import { BadRequestError } from '../utils/errors';
import { signAccessToken } from '../utils/jwt';

const userRepo = () => AppDataSource.getRepository(User);

export async function login(email: string, password: string) {
    const user = await userRepo().findOne({
        where: { email },
        relations: { organization: true, department: true }
    });

    if (!user) {
        throw new BadRequestError('Неверный email или пароль');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        throw new BadRequestError('Неверный email или пароль');
    }

    if (!user.isActive) {
        throw new BadRequestError('Пользователь неактивен');
    }

    // Generate JWT token
    const token = signAccessToken({
        id: user.id,
        organizationId: user.organizationId,
        role: user.role
    });

    // Return formatted response for frontend
    return {
        success: true,
        data: {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.fullName,
                organizationId: user.organizationId
            }
        }
    };
}

export async function findUserById(id: string) {
    return userRepo().findOne({
        where: { id },
        relations: { organization: true, department: true }
    });
}

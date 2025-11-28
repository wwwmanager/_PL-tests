// authService - TypeORM version
import { AppDataSource } from '../db/data-source';
import { User } from '../entities/User';
import bcrypt from 'bcrypt';
import { BadRequestError } from '../utils/errors';

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

    return user;
}

export async function findUserById(id: string) {
    return userRepo().findOne({
        where: { id },
        relations: { organization: true, department: true }
    });
}

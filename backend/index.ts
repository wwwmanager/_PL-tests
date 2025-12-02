// index.ts
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();

// ===== Конфиг =====

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL = '1h'; // срок жизни access token

// Разрешаем фронтенд на Vite (по умолчанию http://localhost:3000)
app.use(
    cors({
        origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'],
        credentials: false, // мы используем Bearer-токен, а не cookies
    }),
);
app.use(express.json());

// ===== Модели и "база" пользователей =====

type Role =
    | 'admin'
    | 'user'
    | 'auditor'
    | 'driver'
    | 'mechanic'
    | 'reviewer'
    | 'accountant'
    | 'viewer';

interface User {
    id: string;
    email: string;
    displayName: string;
    role: Role;
    extraCaps?: string[];
    isActive: boolean;
    createdAt: string;
    lastLoginAt?: string;
}

// ВНИМАНИЕ: это только тестовые пользователи для dev/demo.
// В продакшене нужно хранить пользователей в БД и пароли не в открытом виде.
const users: Array<User & { password: string }> = [
    {
        id: 'u-admin',
        email: 'admin',
        displayName: 'Администратор',
        role: 'admin',
        extraCaps: [],
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: undefined,
        password: '123', // ТОЛЬКО для демо. В бою нужен хэш пароля.
    },
    {
        id: 'u-driver',
        email: 'driver@example.com',
        displayName: 'Водитель Иванов',
        role: 'driver',
        extraCaps: [],
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: undefined,
        password: 'Driver123!', // демо-пароль
    },
    {
        id: 'u-user',
        email: 'user@example.com',
        displayName: 'Пользователь',
        role: 'user',
        extraCaps: [],
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: undefined,
        password: 'User123!',
    },
];

function findUserByEmail(email: string): (User & { password: string }) | undefined {
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function getUserSafe(user: User): User {
    // на всякий случай убираем возможные чувствительные поля (пароль, токены и т.п.)
    const { ...safe } = user;
    return safe;
}

// ===== JWT-хелперы =====

interface JwtPayload {
    sub: string; // user.id
    role: Role;
}

function signToken(user: User): string {
    const payload: JwtPayload = {
        sub: user.id,
        role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
        return null;
    }
}

// ===== Формат ответа API =====

interface ApiError {
    code: string;
    message: string;
    details?: any;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
}

// Утилита для отправки ошибок
function sendError<T>(res: express.Response<ApiResponse<T>>, status: number, err: ApiError) {
    res.status(status).json({ success: false, error: err });
}

// ===== Маршруты /api/auth/* =====

app.post(
    '/api/auth/login',
    (req: express.Request, res: express.Response<ApiResponse<{ token: string; user: User }>>) => {
        const { email, password } = req.body as { email?: string; password?: string };

        if (!email || !password) {
            return sendError(res, 400, {
                code: 'BAD_REQUEST',
                message: 'Email и пароль обязательны',
            });
        }

        const user = findUserByEmail(email);
        if (!user || !user.isActive) {
            return sendError(res, 401, {
                code: 'INVALID_CREDENTIALS',
                message: 'Неверный email или пароль',
            });
        }

        // В демо-версии сравниваем просто строки; в бою нужно использовать хэши (bcrypt).
        if (user.password !== password) {
            return sendError(res, 401, {
                code: 'INVALID_CREDENTIALS',
                message: 'Неверный email или пароль',
            });
        }

        user.lastLoginAt = new Date().toISOString();
        const token = signToken(user);

        return res.json({
            success: true,
            data: {
                token,
                user: getUserSafe(user),
            },
        });
    },
);

app.get(
    '/api/auth/me',
    (req: express.Request, res: express.Response<ApiResponse<User>>) => {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) {
            return sendError(res, 401, {
                code: 'UNAUTHORIZED',
                message: 'Токен не предоставлен',
            });
        }

        const token = auth.slice('Bearer '.length);
        const payload = verifyToken(token);
        if (!payload) {
            return sendError(res, 401, {
                code: 'UNAUTHORIZED',
                message: 'Неверный или истёкший токен',
            });
        }

        const user = users.find((u) => u.id === payload.sub);
        if (!user || !user.isActive) {
            return sendError(res, 404, {
                code: 'USER_NOT_FOUND',
                message: 'Пользователь не найден',
            });
        }

        return res.json({
            success: true,
            data: getUserSafe(user),
        });
    },
);

app.post(
    '/api/auth/logout',
    (req: express.Request, res: express.Response<ApiResponse<null>>) => {
        // Для JWT logout обычно реализуется на клиенте (забываем токен).
        // Здесь просто отвечаем success.
        return res.json({ success: true, data: null });
    },
);

// ===== Запуск =====

app.listen(PORT, () => {
    console.log(`Auth backend listening on http://localhost:${PORT}`);
    console.log('Test users:');
    console.log('  admin@example.com / Admin123!');
    console.log('  driver@example.com / Driver123!');
    console.log('  user@example.com / User123!');
});

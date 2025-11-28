/**
 * HTTP Client для взаимодействия с Backend API
 * Поддерживает авторизацию через Bearer токен
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

let accessToken: string | null = null;

/**
 * Установить токен доступа для последующих запросов
 */
export function setAccessToken(token: string | null) {
    accessToken = token;

    // Сохранить токен в localStorage для персистентности
    if (token) {
        localStorage.setItem('accessToken', token);
    } else {
        localStorage.removeItem('accessToken');
    }
}

/**
 * Получить текущий токен доступа
 */
export function getAccessToken(): string | null {
    if (!accessToken) {
        // Попробовать восстановить из localStorage
        accessToken = localStorage.getItem('accessToken');
    }
    return accessToken;
}

/**
 * Базовая функция для выполнения HTTP запросов
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Добавить существующие заголовки
    if (options.headers) {
        const optHeaders = options.headers as Record<string, string>;
        Object.assign(headers, optHeaders);
    }

    const token = getAccessToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(`${API_URL}${path}`, { ...options, headers });

        if (!res.ok) {
            // Обработка ошибок
            let errorMessage = `API error ${res.status}`;

            try {
                const errorData = await res.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch {
                errorMessage = await res.text() || errorMessage;
            }

            // Если 401 - сбросить токен
            if (res.status === 401) {
                setAccessToken(null);
            }

            throw new Error(errorMessage);
        }

        // Обработка пустого ответа
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return res.json();
        }

        return res.text() as unknown as T;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error');
    }
}

/**
 * HTTP клиент с методами для различных типов запросов
 */
export const http = {
    get: <T>(path: string) => request<T>(path),

    post: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        }),

    put: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        }),

    patch: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        }),

    delete: <T>(path: string) =>
        request<T>(path, { method: 'DELETE' }),
};

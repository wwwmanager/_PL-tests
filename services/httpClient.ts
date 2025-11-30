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
        localStorage.setItem('__auth_token__', token);
    } else {
        localStorage.removeItem('__auth_token__');
    }
}

/**
 * Получить текущий токен доступа
 */
export function getAccessToken(): string | null {
    if (!accessToken) {
        // Попробовать восстановить из localStorage
        accessToken = localStorage.getItem('__auth_token__');
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
        // 🔍 DEBUG: Log request details
        if (options.method === 'POST' || options.method === 'PUT') {
            console.group(`🌐 ${options.method} ${API_URL}${path}`);
            console.log('📤 Request Headers:', headers);
            if (options.body) {
                console.log('📦 Request Payload:', JSON.parse(options.body as string));
            }
            console.groupEnd();
        }

        const res = await fetch(`${API_URL}${path}`, { ...options, headers });

        if (!res.ok) {
            // Обработка ошибок
            let errorMessage = `API error ${res.status}`;
            let errorData: any = null;

            try {
                errorData = await res.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch {
                errorMessage = await res.text() || errorMessage;
            }

            // 🔍 DEBUG: Log error response
            console.group(`❌ ${options.method || 'GET'} ${path} - Status ${res.status}`);
            console.log('Error Message:', errorMessage);
            if (errorData) {
                console.log('Error Data:', errorData);
            }
            console.groupEnd();

            // Если 401 - сбросить токен
            if (res.status === 401) {
                setAccessToken(null);
            }

            throw new Error(errorMessage);
        }

        // Обработка пустого ответа
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const jsonResponse = await res.json();

            // 🔍 DEBUG: Log success response
            if (options.method === 'POST' || options.method === 'PUT') {
                console.group(`✅ ${options.method} ${path} - Status ${res.status}`);
                console.log('📥 Response:', jsonResponse);
                console.groupEnd();
            }

            return jsonResponse;
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
export const httpClient = http;

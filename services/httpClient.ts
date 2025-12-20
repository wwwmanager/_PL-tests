/**
 * HTTP Client для взаимодействия с Backend API
 * Поддерживает авторизацию через Bearer токен и HttpOnly refresh cookie
 */

import { onSessionExpired } from './session';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

/**
 * Custom HTTP Error class that includes status code and requestId
 * REL-204: Allows consumers to detect specific HTTP errors and show requestId
 */
export class HttpError extends Error {
    statusCode: number;
    requestId: string | null;
    code: string | null;

    constructor(message: string, statusCode: number, requestId?: string | null, code?: string | null) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.requestId = requestId ?? null;
        this.code = code ?? null;
    }
}

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

// REL-402: Защита от параллельных refresh запросов
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Попытка обновить access token через refresh endpoint
 * Использует HttpOnly cookie
 */
async function tryRefreshToken(): Promise<boolean> {
    // Если уже идёт refresh — ждём его результат
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
        try {
            console.log('🔄 [httpClient] Attempting token refresh...');

            const res = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // КЛЮЧЕВО: отправляет HttpOnly cookie
            });

            if (!res.ok) {
                console.warn('🔄 [httpClient] Refresh failed:', res.status);
                return false;
            }

            const payload = await res.json();

            // Извлекаем новый токен из ответа
            const token = payload?.data?.token ?? payload?.token ?? null;
            if (!token) {
                console.warn('🔄 [httpClient] Refresh response missing token');
                return false;
            }

            setAccessToken(token);
            console.log('✅ [httpClient] Token refreshed successfully');
            return true;
        } catch (error) {
            console.error('❌ [httpClient] Refresh error:', error);
            return false;
        } finally {
            refreshInFlight = null;
        }
    })();

    return refreshInFlight;
}

/**
 * Базовая функция для выполнения HTTP запросов
 * @param retryOn401 - если true, пробует refresh при 401 и повторяет запрос
 */
async function request<T>(path: string, options: RequestInit = {}, retryOn401 = true): Promise<T> {
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
                try {
                    console.log('📦 Request Payload:', JSON.parse(options.body as string));
                } catch {
                    console.log('📦 Request Payload: [non-JSON]');
                }
            }
            console.groupEnd();
        }

        const res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers,
            credentials: 'include'  // REL-402: Для HttpOnly refresh cookie
        });

        // REL-402: При 401 пробуем refresh один раз
        if (res.status === 401 && retryOn401) {
            const refreshed = await tryRefreshToken();
            if (refreshed) {
                // Повторяем запрос с новым токеном (без повторного retry)
                return request<T>(path, options, false);
            }
            // AUTH-002: Refresh не удался — уведомляем о разлогине
            setAccessToken(null);
            onSessionExpired('token_revoked');
        }

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
                // REL-FIX: Explicitly log validation errors for debugging
                if (errorData.errors && Array.isArray(errorData.errors)) {
                    console.error('🔴 Validation Errors:', JSON.stringify(errorData.errors, null, 2));
                }
            }
            console.groupEnd();

            throw new HttpError(errorMessage, res.status, errorData?.requestId, errorData?.code);
        }

        // Обработка пустого ответа (204 No Content)
        if (res.status === 204) {
            return undefined as T;
        }

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
        if (error instanceof HttpError) {
            throw error;
        }
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

// Re-export для использования в authApi
export { setAccessToken as setToken, getAccessToken as getToken };

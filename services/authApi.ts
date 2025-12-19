/**
 * API для работы с авторизацией
 */

import { http, setAccessToken } from './httpClient';

export interface AuthUser {
    id: string;
    email: string;
    fullName: string;
    organizationId: string;
    departmentId?: string | null;
    isActive: boolean;
}

export interface LoginResponse {
    accessToken: string;
    user: AuthUser;
}

/**
 * Войти в систему
 */
export async function login(email: string, password: string): Promise<AuthUser> {
    const data = await http.post<LoginResponse>('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    return data.user;
}

/**
 * Выйти из системы
 */
export async function logout(): Promise<void> {
    setAccessToken(null);
    await http.post('/auth/logout');
}

/**
 * Выйти со всех устройств (AUTH-004.1)
 */
export async function logoutAll(): Promise<void> {
    await http.post('/auth/logout-all');
    setAccessToken(null);
}

/**
 * Получить текущего пользователя
 */
export async function getCurrentUser(): Promise<AuthUser> {
    return http.get<AuthUser>('/auth/me');
}

/**
 * Обновить токен
 */
export async function refreshToken(): Promise<string> {
    const data = await http.post<{ accessToken: string }>('/auth/refresh');
    setAccessToken(data.accessToken);
    return data.accessToken;
}

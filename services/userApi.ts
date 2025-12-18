/**
 * User API Facade
 * 
 * Uses real backend API for all user operations.
 * Driver Mode with mockApi has been removed.
 */

import { User } from '../types';
import { httpClient } from './httpClient';

export const userApi = {
    getUsers: async (): Promise<User[]> => {
        const response = await httpClient.get<any[]>('/users');
        // Transform backend response to frontend User type
        return response.map(u => ({
            id: u.id,
            email: u.email,
            displayName: u.fullName,
            role: u.roles && u.roles.length > 0 ? u.roles[0] : 'user',
            extraCaps: [],
            organizationId: u.organizationId,
            departmentId: u.departmentId,
            isActive: u.isActive
        }));
    },

    addUser: async (user: Omit<User, 'id'> & { password?: string }): Promise<User> => {
        const payload = {
            email: user.email || `${user.displayName.replace(/\\s+/g, '.').toLowerCase()}@waybills.local`,
            password: (user as any).password || '123456',
            fullName: user.displayName,
            roleCodes: [user.role],
            organizationId: user.organizationId,
            extraCaps: user.extraCaps,
            isActive: true
        };
        const response = await httpClient.post<any>('/users', payload);
        return {
            id: response.id,
            email: response.email,
            displayName: response.fullName,
            role: user.role,
            extraCaps: [],
            organizationId: response.organizationId,
            isActive: response.isActive
        };
    },

    updateUser: async (user: User): Promise<User> => {
        const payload = {
            email: user.email,
            fullName: user.displayName,
            roleCodes: [user.role],
            isActive: user.isActive
        };
        const response = await httpClient.put<any>(`/users/${user.id}`, payload);
        return {
            ...user,
            displayName: response.fullName,
            email: response.email,
            role: user.role
        };
    },

    deleteUser: async (id: string): Promise<void> => {
        await httpClient.delete(`/users/${id}`);
    }
};

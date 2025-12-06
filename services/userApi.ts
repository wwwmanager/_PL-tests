import { User } from '../types';
import { httpClient } from './httpClient';
import * as mockApi from './mockApi';
import { getAppSettings } from './mockApi';

async function shouldUseRealApi() {
    // For now, assume if we have a token (checked elsewhere) or appMode is not purely offline
    const settings = await getAppSettings();
    const useReal = settings.appMode !== 'driver'; // Central mode uses real API
    // Or check env var override
    const useRealEnv = import.meta.env.VITE_USE_REAL_API === 'true';
    return useRealEnv || useReal;
}

export const userApi = {
    getUsers: async (): Promise<User[]> => {
        if (await shouldUseRealApi()) {
            const response = await httpClient.get<any[]>('/users');
            // Transform backend response to frontend User type if needed
            return response.map(u => ({
                id: u.id,
                email: u.email,
                displayName: u.fullName,
                role: u.roles && u.roles.length > 0 ? u.roles[0] : 'user', // Backend returns roleCodes
                extraCaps: [], // Backend doesn't support extraCaps per user yet (or it's mapped from other roles)
                organizationId: u.organizationId,
                departmentId: u.departmentId,
                isActive: u.isActive
            }));
        } else {
            return mockApi.getUsers();
        }
    },

    addUser: async (user: Omit<User, 'id'>): Promise<User> => {
        if (await shouldUseRealApi()) {
            const payload = {
                email: user.email || `${user.displayName.replace(/\s+/g, '.').toLowerCase()}@example.com`, // Generate email if missing
                fullName: user.displayName,
                roleCodes: [user.role],
                organizationId: user.organizationId,
                extraCaps: user.extraCaps, // Backend ignores currently
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
        } else {
            return mockApi.addUser(user);
        }
    },

    updateUser: async (user: User): Promise<User> => {
        if (await shouldUseRealApi()) {
            const payload = {
                email: user.email,
                fullName: user.displayName,
                roleCodes: [user.role],
                // extraCaps ignored
                isActive: user.isActive
            };
            const response = await httpClient.put<any>(`/users/${user.id}`, payload);
            return {
                ...user,
                displayName: response.fullName,
                email: response.email,
                role: user.role
            };
        } else {
            return mockApi.updateUser(user);
        }
    },

    deleteUser: async (id: string): Promise<void> => {
        if (await shouldUseRealApi()) {
            await httpClient.delete(`/users/${id}`);
        } else {
            await mockApi.deleteUser(id);
        }
    }
};

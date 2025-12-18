/**
 * Role API Facade
 * 
 * Uses real backend API for all role operations.
 * Driver Mode with mockApi has been removed.
 */

import { Role, Capability } from '../types';
import { httpClient } from './httpClient';

export type RoleMap = Record<Role, Capability[]>;

export const roleApi = {
    getRolePolicies: async (): Promise<RoleMap> => {
        // Fetch roles from /roles
        const roles = await httpClient.get<any[]>('/roles');
        // Transform: [{code: 'admin', rolePermissions: [{permission: {code: 'p1'}}]}, ...]
        // To: { admin: ['p1', ...] }
        const policies: RoleMap = {} as RoleMap;

        roles.forEach(r => {
            const caps = r.rolePermissions?.map((rp: any) => rp.permission.code) || [];
            policies[r.code as Role] = caps;
        });
        return policies;
    },

    saveRolePolicies: async (policies: RoleMap): Promise<void> => {
        // Get all roles to find IDs
        const roles = await httpClient.get<any[]>('/roles');

        for (const [code, caps] of Object.entries(policies)) {
            const role = roles.find(r => r.code === code);
            if (role) {
                await httpClient.put(`/roles/${role.id}`, {
                    permissionCodes: caps
                });
            }
        }
    }
};

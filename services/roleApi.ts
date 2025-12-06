import { Role, Capability } from '../types';
import { httpClient } from './httpClient';
import { getAppSettings } from './mockApi';
import * as mockApi from './mockApi';

async function shouldUseRealApi() {
    const settings = await getAppSettings();
    return import.meta.env.VITE_USE_REAL_API === 'true' || settings.appMode !== 'driver';
}

export type RoleMap = Record<Role, Capability[]>;

export const roleApi = {
    getRolePolicies: async (): Promise<RoleMap> => {
        if (await shouldUseRealApi()) {
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
        } else {
            return mockApi.getRolePolicies();
        }
    },

    saveRolePolicies: async (policies: RoleMap): Promise<void> => {
        if (await shouldUseRealApi()) {
            // Frontend sends the entire map, but backend updates per role.
            // We need to iterate and update each role.
            // This is inefficient but works for now. 
            // Better: update backend to accept bulk update or update specific role in UI.

            // For now, let's assume we update only changed roles? 
            // But we don't know which changed.
            // Let's iterate all known roles in policies.

            const promises = Object.entries(policies).map(async ([roleCode, capabilities]) => {
                // First get role ID (we need ID to update)
                // We'd better cache IDs or fetch them.
                // Assuming we can find role by code or update by code? 
                // Backend controller updates by ID.

                // Hack: Fetch roles first to get IDs
                // Optimization: RoleManagement should pass ID
            });

            // Since RoleManagement passes `policies` map, we need to adapt.
            // Maybe we should replicate logic: Get all roles, match by code, update.
            const roles = await httpClient.get<any[]>('/roles');

            for (const [code, caps] of Object.entries(policies)) {
                const role = roles.find(r => r.code === code);
                if (role) {
                    await httpClient.put(`/roles/${role.id}`, {
                        permissionCodes: caps
                    });
                } else {
                    // Create role if doesn't exist? (Maybe not needed for standard roles)
                }
            }
        } else {
            return mockApi.saveRolePolicies(policies);
        }
    }
};

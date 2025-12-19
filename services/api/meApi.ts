// REL-001: /me API endpoint
import { http } from '../httpClient';

export type MeResponse = {
    requestId: string | null;
    user: {
        id: string;
        email: string;
        fullName: string;
        role: string;
        isActive: boolean;
        employeeId: string | null;
        driverId: string | null;
    };
    organization: {
        id: string;
        name: string | null;
    };
    department: {
        id: string;
        name: string;
    } | null;
    tokenClaims: {
        organizationId: string;
        departmentId: string | null;
        role: string;
    };
    serverTime: string;
    backendVersion: string;
};

export async function getMe(): Promise<MeResponse> {
    const response = await http.get<MeResponse>('/me');
    return response;
}

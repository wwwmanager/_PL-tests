import { httpClient } from '../httpClient';

export interface OrganizationDto {
    id: string;
    name: string;
    shortName?: string | null;
    inn?: string | null;
    kpp?: string | null;
    ogrn?: string | null;
    address?: string | null;
    createdAt: string;
    updatedAt: string;
}

export async function getMyOrganization(): Promise<OrganizationDto> {
    const response = await httpClient.get<{ data: OrganizationDto }>('/organizations/me');
    return response.data;
}

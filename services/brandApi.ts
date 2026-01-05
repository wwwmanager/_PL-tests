import { httpClient } from './httpClient';

export interface Brand {
    id: string;
    name: string;
    organizationId: string;
}

interface ApiResponse<T> {
    data: T;
}

export async function getBrands(): Promise<Brand[]> {
    const response = await httpClient.get<Brand[]>('/brands');
    return response || [];
}

export async function createBrand(name: string): Promise<Brand> {
    const response = await httpClient.post<Brand>('/brands', { name });
    return response;
}

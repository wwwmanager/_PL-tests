// Route API Facade
import { httpClient } from '../httpClient';

export interface Route {
    id: string;
    name: string;
    startPoint?: string | null;
    endPoint?: string | null;
    distance?: number | null;
    estimatedTime?: number | null;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Get all routes
 */
export async function getRoutes(): Promise<Route[]> {
    const response = await httpClient.get<{ data: Route[] }>('/routes');
    return response.data?.data || [];
}

/**
 * Get route by ID
 */
export async function getRouteById(id: string): Promise<Route> {
    const response = await httpClient.get<{ data: Route }>(`/routes/${id}`);
    return response.data.data;
}

/**
 * Create new route
 */
export async function createRoute(data: {
    name: string;
    startPoint?: string | null;
    endPoint?: string | null;
    distance?: number | null;
    estimatedTime?: number | null;
}): Promise<Route> {
    const response = await httpClient.post<{ data: Route }>('/routes', data);
    return response.data.data;
}

/**
 * Update route
 */
export async function updateRoute(id: string, data: {
    name?: string;
    startPoint?: string | null;
    endPoint?: string | null;
    distance?: number | null;
    estimatedTime?: number | null;
}): Promise<Route> {
    const response = await httpClient.put<{ data: Route }>(`/routes/${id}`, data);
    return response.data.data;
}

/**
 * Delete route
 */
export async function deleteRoute(id: string): Promise<void> {
    await httpClient.delete(`/routes/${id}`);
}

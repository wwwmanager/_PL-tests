/**
 * Route API Facade
 * 
 * Uses real backend API for all route operations.
 * Driver Mode with mockApi has been removed.
 */

import { SavedRoute } from '../types';
import { httpClient } from './httpClient';

interface ApiResponse<T> {
    data: T;
}

// Backend Route model (different from frontend SavedRoute)
interface BackendRoute {
    id: string;
    name: string;
    startPoint: string | null;
    endPoint: string | null;
    distance: number | null;
    estimatedTime: number | null;
}

// Map backend route to frontend SavedRoute
function mapBackendToFrontend(backendRoute: BackendRoute): SavedRoute {
    return {
        id: backendRoute.id,
        from: backendRoute.startPoint || backendRoute.name?.split(' - ')[0] || '',
        to: backendRoute.endPoint || backendRoute.name?.split(' - ')[1] || '',
        distanceKm: backendRoute.distance || 0,
    };
}

// Map frontend SavedRoute to backend format
function mapFrontendToBackend(frontendRoute: Omit<SavedRoute, 'id'>): Omit<BackendRoute, 'id' | 'estimatedTime'> {
    return {
        name: `${frontendRoute.from} - ${frontendRoute.to}`,
        startPoint: frontendRoute.from,
        endPoint: frontendRoute.to,
        distance: frontendRoute.distanceKm,
    };
}

export async function getSavedRoutes(): Promise<SavedRoute[]> {
    console.log('📡 [routeApi] Fetching from BACKEND /routes...');
    const response = await httpClient.get<ApiResponse<BackendRoute[]>>('/routes');
    const backendRoutes = response.data || [];
    const routes = backendRoutes.map(mapBackendToFrontend);
    console.log('📡 [routeApi] Received from backend:', routes.length, 'routes');
    return routes;
}

export async function addSavedRoute(data: Omit<SavedRoute, 'id'>): Promise<SavedRoute> {
    const backendData = mapFrontendToBackend(data);
    console.log('📡 [routeApi] Creating route:', backendData);
    const response = await httpClient.post<ApiResponse<BackendRoute>>('/routes', backendData);
    return mapBackendToFrontend(response.data);
}

export async function updateSavedRoute(data: SavedRoute): Promise<SavedRoute> {
    const { id, ...rest } = data;
    const backendData = mapFrontendToBackend(rest);
    const response = await httpClient.put<ApiResponse<BackendRoute>>(`/routes/${id}`, backendData);
    return mapBackendToFrontend(response.data);
}

export async function deleteSavedRoute(id: string): Promise<void> {
    await httpClient.delete(`/routes/${id}`);
}

/**
 * Search saved locations for autocomplete
 * @param query - Search query (minimum 2 characters)
 * @returns Array of unique locations, sorted by relevance
 */
export async function searchSavedLocations(query: string): Promise<string[]> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
        return [];
    }

    // Get all saved routes and extract unique locations
    const routes = await getSavedRoutes();
    const normalizedQuery = trimmedQuery.toLowerCase();

    // Collect all unique locations with relevance scores
    const locationScores = new Map<string, { location: string; score: number }>();

    for (const route of routes) {
        // Check "from"
        if (route.from) {
            const normalizedFrom = route.from.toLowerCase();
            if (normalizedFrom.includes(normalizedQuery)) {
                const score = getRelevanceScore(normalizedFrom, normalizedQuery);
                const existing = locationScores.get(route.from);
                if (!existing || score > existing.score) {
                    locationScores.set(route.from, { location: route.from, score });
                }
            }
        }

        // Check "to"
        if (route.to) {
            const normalizedTo = route.to.toLowerCase();
            if (normalizedTo.includes(normalizedQuery)) {
                const score = getRelevanceScore(normalizedTo, normalizedQuery);
                const existing = locationScores.get(route.to);
                if (!existing || score > existing.score) {
                    locationScores.set(route.to, { location: route.to, score });
                }
            }
        }
    }

    // Sort by relevance and return top 10
    return Array.from(locationScores.values())
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.location.localeCompare(b.location, 'ru');
        })
        .slice(0, 10)
        .map(item => item.location);
}

/**
 * Calculate relevance score (higher = more relevant)
 */
function getRelevanceScore(text: string, query: string): number {
    let score = 0;

    // Starts with query - highest priority
    if (text.startsWith(query)) {
        score += 100;
    }

    // Contains query
    const position = text.indexOf(query);
    if (position !== -1) {
        score += 50;
        score += Math.max(0, 10 - position);
    }

    return score;
}

/**
 * Save routes from waybill to saved routes collection
 * @param routes - Routes from a waybill
 */
export async function addSavedRoutesFromWaybill(routes: { from: string; to: string; distanceKm: number }[]): Promise<void> {
    const currentRoutes = await getSavedRoutes();

    // Create index of existing routes
    const existingIndex = new Map<string, SavedRoute>();
    for (const route of currentRoutes) {
        const key = `${route.from.trim().toLowerCase()}|${route.to.trim().toLowerCase()}`;
        existingIndex.set(key, route);
    }

    for (const route of routes) {
        if (!route.from?.trim() || !route.to?.trim() || !route.distanceKm) continue;

        const from = route.from.trim();
        const to = route.to.trim();
        const key = `${from.toLowerCase()}|${to.toLowerCase()}`;

        const existing = existingIndex.get(key);
        if (existing) {
            // Route exists - update if distance changed significantly
            if (Math.abs(existing.distanceKm - route.distanceKm) > 1) {
                const newDistance = Math.round((existing.distanceKm + route.distanceKm) / 2);
                if (newDistance !== existing.distanceKm) {
                    await updateSavedRoute({ ...existing, distanceKm: newDistance });
                }
            }
        } else {
            // New route - add it
            await addSavedRoute({ from, to, distanceKm: route.distanceKm });
        }
    }
}

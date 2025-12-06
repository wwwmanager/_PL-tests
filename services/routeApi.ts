import * as mockApi from './mockApi';
import { getAppSettings } from './mockApi';
import { SavedRoute } from '../types';
import { httpClient, getAccessToken } from './httpClient';

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

async function shouldUseRealApi(): Promise<boolean> {
    const hasToken = !!getAccessToken();

    try {
        const settings = await getAppSettings();
        const useReal = settings.appMode === 'central' || (settings.appMode === undefined && hasToken);

        console.log(`🔗 [routeApi] appMode = "${settings.appMode}", hasToken = ${hasToken} → ${useReal ? 'REAL BACKEND' : 'MOCK API'}`);

        return useReal;
    } catch (error) {
        console.warn('⚠️ [routeApi] Could not load AppSettings, hasToken:', hasToken);
        return hasToken || !import.meta.env.DEV;
    }
}

// Real API implementations
async function getSavedRoutesReal(): Promise<SavedRoute[]> {
    console.log('📡 [routeApi] Fetching from BACKEND /routes...');
    const response = await httpClient.get<ApiResponse<BackendRoute[]>>('/routes');
    const backendRoutes = response.data || [];
    const routes = backendRoutes.map(mapBackendToFrontend);
    console.log('📡 [routeApi] Received from backend:', routes.length, 'routes');
    return routes;
}

async function addSavedRouteReal(data: Omit<SavedRoute, 'id'>): Promise<SavedRoute> {
    const backendData = mapFrontendToBackend(data);
    console.log('📡 [routeApi] Creating route:', backendData);
    const response = await httpClient.post<ApiResponse<BackendRoute>>('/routes', backendData);
    return mapBackendToFrontend(response.data);
}

async function updateSavedRouteReal(data: SavedRoute): Promise<SavedRoute> {
    const { id, ...rest } = data;
    const backendData = mapFrontendToBackend(rest);
    const response = await httpClient.put<ApiResponse<BackendRoute>>(`/routes/${id}`, backendData);
    return mapBackendToFrontend(response.data);
}

async function deleteSavedRouteReal(id: string): Promise<void> {
    await httpClient.delete(`/routes/${id}`);
}

// Facade functions - match mockApi function names for easy migration
export async function getSavedRoutes(): Promise<SavedRoute[]> {
    const useReal = await shouldUseRealApi();
    return useReal ? getSavedRoutesReal() : mockApi.getSavedRoutes();
}

export async function addSavedRoute(data: Omit<SavedRoute, 'id'>): Promise<SavedRoute> {
    const useReal = await shouldUseRealApi();
    return useReal ? addSavedRouteReal(data) : mockApi.addSavedRoute(data);
}

export async function updateSavedRoute(data: SavedRoute): Promise<SavedRoute> {
    const useReal = await shouldUseRealApi();
    return useReal ? updateSavedRouteReal(data) : mockApi.updateSavedRoute(data);
}

export async function deleteSavedRoute(id: string): Promise<void> {
    const useReal = await shouldUseRealApi();
    return useReal ? deleteSavedRouteReal(id) : mockApi.deleteSavedRoute(id);
}

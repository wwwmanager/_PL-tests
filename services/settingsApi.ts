import { httpClient } from './httpClient';
import { getAppSettings as getMockAppSettings, saveAppSettings as saveMockAppSettings, getSeasonSettings as getMockSeasonSettings, saveSeasonSettings as saveMockSeasonSettings } from './mockApi';
import { getAccessToken } from './httpClient';
import type { AppSettings, SeasonSettings } from '../types';

async function shouldUseRealApi(): Promise<boolean> {
    const hasToken = !!getAccessToken();
    // Always use real API if we have a token (user is authenticated)
    return hasToken;
}

export async function getAppSettings(): Promise<AppSettings> {
    if (await shouldUseRealApi()) {
        try {
            const response = await httpClient.get<{ success: boolean; data: AppSettings }>('/settings/app');
            return response.data;
        } catch (e) {
            console.warn('⚠️ [settingsApi] Failed to get AppSettings from backend, using mock');
            return getMockAppSettings();
        }
    }
    return getMockAppSettings();
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
    if (await shouldUseRealApi()) {
        await httpClient.put<{ success: boolean; data: AppSettings }>('/settings/app', settings);
        return;
    }
    await saveMockAppSettings(settings);
}

export async function getSeasonSettings(): Promise<SeasonSettings> {
    if (await shouldUseRealApi()) {
        try {
            const response = await httpClient.get<{ success: boolean; data: SeasonSettings }>('/settings/season');
            return response.data;
        } catch (e) {
            console.warn('⚠️ [settingsApi] Failed to get SeasonSettings from backend, using mock');
            return getMockSeasonSettings();
        }
    }
    return getMockSeasonSettings();
}

export async function saveSeasonSettings(settings: SeasonSettings): Promise<void> {
    if (await shouldUseRealApi()) {
        await httpClient.put<{ success: boolean; data: SeasonSettings }>('/settings/season', settings);
        return;
    }
    await saveMockSeasonSettings(settings);
}

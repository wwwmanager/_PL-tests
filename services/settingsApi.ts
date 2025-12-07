/**
 * Settings API Facade
 * 
 * Uses real backend API for all settings operations.
 * Driver Mode with mockApi has been removed.
 */

import { httpClient } from './httpClient';
import type { AppSettings, SeasonSettings } from '../types';

export async function getAppSettings(): Promise<AppSettings> {
    const response = await httpClient.get<{ success: boolean; data: AppSettings }>('/settings/app');
    return response.data;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
    await httpClient.put<{ success: boolean; data: AppSettings }>('/settings/app', settings);
}

export async function getSeasonSettings(): Promise<SeasonSettings> {
    const response = await httpClient.get<{ success: boolean; data: SeasonSettings }>('/settings/season');
    return response.data;
}

export async function saveSeasonSettings(settings: SeasonSettings): Promise<void> {
    await httpClient.put<{ success: boolean; data: SeasonSettings }>('/settings/season', settings);
}

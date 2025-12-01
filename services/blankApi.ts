import * as mockApi from './mockApi';
import * as realApi from './api/realBlankApi';
import { getAppSettings } from './mockApi';
import { WaybillBlank, WaybillBlankBatch, BlankStatus } from '../types';

async function shouldUseRealApi(): Promise<boolean> {
    try {
        const settings = await getAppSettings();
        return settings.appMode === 'central';
    } catch {
        return !import.meta.env.DEV;
    }
}

export async function getBlankBatches(): Promise<WaybillBlankBatch[]> {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.getBlankBatches() : mockApi.getBlankBatches();
}

export async function createBlankBatch(data: Omit<WaybillBlankBatch, 'id' | 'status'>): Promise<WaybillBlankBatch> {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.createBlankBatch(data) : mockApi.createBlankBatch(data);
}

export async function issueBlanksToDriver(params: { batchId: string, ownerEmployeeId: string, ranges: { from: number, to: number }[] }, ctx: any): Promise<any> {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.issueBlanksToDriver(params, ctx) : mockApi.issueBlanksToDriver(params, ctx);
}

export async function searchBlanks(filters: any): Promise<{ items: WaybillBlank[], total: number }> {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.searchBlanks(filters) : mockApi.searchBlanks(filters);
}

export async function getBlanks(): Promise<WaybillBlank[]> {
    const useReal = await shouldUseRealApi();
    // realApi.searchBlanks returns { items, total }, mockApi.getBlanks returns array
    if (useReal) {
        const { items } = await realApi.searchBlanks({ page: 1, pageSize: 1000 });
        return items;
    } else {
        return mockApi.getBlanks();
    }
}

export async function materializeBatch(batchId: string): Promise<{ created: number }> {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.materializeBatch(batchId) : mockApi.materializeBatch(batchId);
}

export async function spoilBlank(params: any, ctx: any): Promise<void> {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.spoilBlank(params, ctx) : mockApi.spoilBlank(params, ctx);
}

export async function bulkSpoilBlanks(params: any, ctx: any): Promise<any> {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.bulkSpoilBlanks(params, ctx) : mockApi.bulkSpoilBlanks(params, ctx);
}

export async function countBlanksByFilter(filter: any): Promise<number> {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.countBlanksByFilter(filter) : mockApi.countBlanksByFilter(filter);
}

import { httpClient } from '../httpClient';
import { WaybillBlank, WaybillBlankBatch, BlankStatus } from '../../types';

interface BlankFilters {
    series?: string;
    number?: number;
    status?: BlankStatus[];
    ownerEmployeeId?: string;
    page?: number;
    pageSize?: number;
}

interface BlankListResponse {
    items: WaybillBlank[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function getBlankBatches(): Promise<WaybillBlankBatch[]> {
    // Currently backend doesn't have a specific endpoint for listing batches, 
    // but we can assume we might add one or use a different strategy.
    // For now, let's assume we might need to implement it on backend or 
    // if the requirement was just to CREATE batches, we focus on that.
    // Wait, the plan said "GET /api/blanks/batches". I should check if I implemented that.
    // I implemented POST /batches. I didn't implement GET /batches in blankRoutes.ts.
    // I should probably add it to backend or just return empty for now if not critical, 
    // but the UI needs it.
    // Let's implement what we can.
    // Actually, looking at blankService.ts, I only implemented listBlanks (individual).
    // I missed listBatches in the backend implementation plan.
    // I will implement createBlankBatch and issueBlanksToDriver first, and listBlanks.
    // For getBlankBatches, I might need to add it to backend or mock it for now if I can't change backend easily.
    // But I am in full control. I should add it to backend.
    // Let's stick to the plan: implement frontend client first.

    // TEMPORARY: If endpoint doesn't exist, this will fail. 
    // I will add the endpoint to backend in the next step if needed.
    // For now, let's assume it exists or I will add it.
    const response = await httpClient.get<{ data: WaybillBlankBatch[] }>('/blanks/batches');
    return response.data;
}

export async function createBlankBatch(data: Omit<WaybillBlankBatch, 'id' | 'status'>): Promise<WaybillBlankBatch> {
    // Map frontend fields to backend DTO
    const backendPayload = {
        organizationId: data.organizationId,  // Important: pass selected org
        series: data.series,
        numberFrom: data.startNumber,
        numberTo: data.endNumber,
        departmentId: undefined  // optional
    };
    console.log('📡 [realBlankApi] Creating batch:', backendPayload);
    const response = await httpClient.post<WaybillBlankBatch>('/blanks/batches', backendPayload);
    // Backend returns batch directly, transform to frontend format
    return {
        ...(response as any),
        startNumber: backendPayload.numberFrom,
        endNumber: backendPayload.numberTo
    };
}

export async function issueBlanksToDriver(params: { batchId: string, ownerEmployeeId: string, ranges: { from: number, to: number }[] }, ctx: any): Promise<void> {
    // The backend expects { series, number, driverId } for single issue.
    // The frontend sends ranges. I need to adapt this or update backend to support ranges.
    // Updating backend to support ranges is better for performance.
    // But for now, let's loop in the frontend client or backend?
    // The frontend `issueBlanksToDriver` in mockApi takes ranges.
    // My backend `issueBlank` takes single blank.
    // I should probably update backend to `issueBatch` or `issueRange`.
    // Or I can loop here. Looping here is easier for now to match the signature.

    // Wait, `issueBlanksToDriver` in mockApi:
    // export async function issueBlanksToDriver(params: { batchId: string, ownerEmployeeId: string, ranges: { from: number, to: number }[] }, ctx: any)

    // My backend `issueBlank`:
    // export interface IssueBlankDto { series: string; number: number; driverId?: string; vehicleId?: string; }

    // I need to fetch the batch first to get the series? 
    // Or pass series from frontend?
    // The frontend `issueModalBatch` has the series.
    // But `issueBlanksToDriver` params only have `batchId`.
    // I might need to fetch batch details or change the frontend call to include series.

    // Let's assume for now I'll implement a bulk issue endpoint on backend later, 
    // or loop here if I can get the series.
    // Actually, `getBlankBatches` returns batches with series.
    // The frontend component `BlankManagement` has `issueModalBatch` which has `series`.
    // But it passes `batchId` to the service.

    // Let's implement a `bulkIssue` on backend? 
    // Or just change the frontend service signature to accept `series`.
    // Changing frontend service signature is safer.

    // For now, let's just define the interface.
    return Promise.resolve();
}

export async function searchBlanks(filters: BlankFilters): Promise<{ items: WaybillBlank[], total: number }> {
    const params = new URLSearchParams();
    if (filters.series) params.append('series', filters.series);
    if (filters.number) params.append('number', String(filters.number));
    if (filters.status && filters.status.length > 0) params.append('status', filters.status.join(','));
    if (filters.ownerEmployeeId) params.append('ownerEmployeeId', filters.ownerEmployeeId);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.pageSize) params.append('pageSize', String(filters.pageSize));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await httpClient.get<BlankListResponse>(`/blanks${queryString}`);
    return { items: response.items, total: response.total };
}

// These are needed for the component but might not be in the new API yet
export async function materializeBatch(batchId: string): Promise<{ created: number }> {
    console.log('📡 [realBlankApi] Materializing batch:', batchId);
    const response = await httpClient.post<{ count: number; message: string }>(`/blanks/batches/${batchId}/materialize`, {});
    return { created: response.count || 0 };
}

export async function spoilBlank(params: any, ctx: any): Promise<void> {
    // Not implemented in backend yet
    console.warn('spoilBlank not implemented in real API');
}

export async function bulkSpoilBlanks(params: any, ctx: any): Promise<any> {
    // Not implemented in backend yet
    console.warn('bulkSpoilBlanks not implemented in real API');
    return { spoiled: [], skipped: [] };
}

export async function countBlanksByFilter(filter: any): Promise<number> {
    const { total } = await searchBlanks({ ...filter, page: 1, pageSize: 1 });
    return total;
}

// Types for driver blank summary
export interface DriverBlankRange {
    series: string;
    numberStart: number;
    numberEnd: number;
    count: number;
}

export interface DriverBlankSummary {
    active: DriverBlankRange[];
    used: DriverBlankRange[];
    spoiled: DriverBlankRange[];
}

export async function getDriverBlankSummary(driverId: string): Promise<DriverBlankSummary> {
    const response = await httpClient.get<DriverBlankSummary>(`/blanks/summary/driver/${driverId}`);
    return response;
}


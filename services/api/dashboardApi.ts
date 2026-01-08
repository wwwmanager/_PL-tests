/**
 * Dashboard API Facade
 * 
 * Uses real backend API for dashboard statistics.
 */

import { httpClient } from '../httpClient';
import { KpiData } from '../../types';

export interface ChartData {
    month: string;
    value: number;
}

export interface TopVehicleData {
    id: string;
    name: string;
    value: number;
}

export interface DriverStatsData {
    id: string;
    name: string;
    value: number;
}

export interface MaintenanceData {
    id: string;
    vehicle: string;
    remainingKm: number;
    status: 'critical' | 'warning' | 'ok';
}

export interface BirthdayData {
    id: string;
    name: string;
    date: string;
    fullDate: string; // DD.MM.YYYY
    age?: number;
    isToday: boolean;
}

export interface IssueItem {
    id: string;
    type: 'doc_vehicle' | 'doc_driver' | 'maintenance' | 'other';
    title: string;
    description: string;
    severity: 'critical' | 'warning';
    date?: string;
    vehicleId?: string;
}

export interface DashboardData {
    kpi: {
        mileageMonth: number;
        mileageQuarter: number;
        mileageYear: number;
        fuelMonth: number;
        fuelQuarter: number;
        fuelYear: number;
        fuelPeriod: number;           // DASH-IMP-005: Fuel for selected period
        totalFuelBalance: number;
        totalCardBalance: number;
        totalOdometer: number | null; // DASH-IMP-002: null = Все ТС
        issues: number;
        waybillStats: {
            draft: number;
            review: number;
            posted: number;
        }
    };
    fuelConsumptionByMonth: ChartData[];
    medicalExamsByMonth: ChartData[];
    topFuelVehicles: TopVehicleData[];
    driverExams: DriverStatsData[];
    upcomingMaintenance: MaintenanceData[];
    birthdays: BirthdayData[];
    issuesList: IssueItem[];
    // DASH-EXP-001: New expense/mileage widgets
    topFuelExpense: TopVehicleData[];      // Топ ТС по тратам на топливо (руб)
    topOtherExpense: TopVehicleData[];     // Топ ТС по тратам без топлива (руб)
    topMileage: TopVehicleData[];          // Топ ТС по пробегу (км)
}

export interface DashboardFilters {
    vehicleId?: string;
    dateFrom?: string;
    dateTo?: string;
}

export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
    const params = new URLSearchParams();
    if (filters.vehicleId) params.append('vehicleId', filters.vehicleId);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await httpClient.get<{ success: boolean; data: DashboardData }>(`/dashboard/stats${queryString}`);

    console.log('📊 [dashboardApi] Backend stats:', response.data);
    return response.data;
}

// Deprecated: Issues are now returned in getDashboardData
export async function getIssues(filters: { vehicleId?: string }) {
    console.warn('[dashboardApi] getIssues is deprecated. Issues are loaded via getDashboardData.');
    return { expiringDocs: [] };
}

/**
 * Dashboard API Facade
 * 
 * Uses real backend API for dashboard statistics.
 * Falls back to client-side aggregation if backend fails.
 */

import { httpClient } from '../httpClient';
import { getWaybills } from './waybillApi';
import { getVehicles } from './vehicleApi';
import { getEmployees } from './employeeApi';
import { KpiData, Vehicle, Employee } from '../../types';

export interface DashboardData {
    kpi: KpiData;
    fuelConsumptionByMonth: { month: string; 'Факт': number }[];
    medicalExamsByMonth: { month: string; 'Осмотры': number }[];
}

export interface DashboardFilters {
    vehicleId?: string;
    dateFrom?: string;
    dateTo?: string;
}

export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
    try {
        const params = new URLSearchParams();
        if (filters.vehicleId) params.append('vehicleId', filters.vehicleId);
        if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.append('dateTo', filters.dateTo);

        const queryString = params.toString() ? `?${params.toString()}` : '';
        const response = await httpClient.get<{ success: boolean; data: DashboardData }>(`/dashboard/stats${queryString}`);

        console.log('📊 [dashboardApi] Backend stats:', response.data);
        return response.data;
    } catch (e) {
        console.warn('⚠️ [dashboardApi] Backend failed, falling back to client-side aggregation:', e);
        return getDashboardDataClientSide(filters);
    }
}

// Client-side fallback (for mock mode)
async function getDashboardDataClientSide(filters: DashboardFilters): Promise<DashboardData> {
    const { waybills } = await getWaybills({
        startDate: filters.dateFrom,
        endDate: filters.dateTo,
        vehicleId: filters.vehicleId,
        limit: 1000
    });

    let mileageMonth = 0;
    let mileageQuarter = 0;
    let mileageYear = 0;
    let fuelMonth = 0;
    let fuelQuarter = 0;
    let fuelYear = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3);

    waybills.forEach(w => {
        const date = new Date(w.date);
        const mileage = (w.odometerEnd ?? w.odometerStart) - w.odometerStart;
        const fuel = (w.fuelAtStart ?? 0) + (w.fuelFilled ?? 0) - (w.fuelAtEnd ?? 0);

        if (date.getFullYear() === currentYear) {
            mileageYear += mileage;
            fuelYear += fuel;

            if (Math.floor(date.getMonth() / 3) === currentQuarter) {
                mileageQuarter += mileage;
                fuelQuarter += fuel;
            }

            if (date.getMonth() === currentMonth) {
                mileageMonth += mileage;
                fuelMonth += fuel;
            }
        }
    });

    const vehicles = await getVehicles({ organizationId: waybills[0]?.organizationId });
    const totalFuelBalance = vehicles.reduce((sum, v) => sum + (v.currentFuel ?? 0), 0);

    const issues = await getIssuesCountClientSide(vehicles);

    const fuelConsumptionByMonth = aggregateByMonth(waybills, 'fuel');
    const medicalExamsByMonth = aggregateByMonth(waybills, 'exams');

    return {
        kpi: {
            mileageMonth,
            mileageQuarter,
            mileageYear,
            fuelMonth,
            fuelQuarter,
            fuelYear,
            totalFuelBalance,
            issues
        },
        fuelConsumptionByMonth,
        medicalExamsByMonth
    };
}

async function getIssuesCountClientSide(vehicles: Vehicle[]): Promise<number> {
    let count = 0;
    const now = new Date();
    const warningDate = new Date();
    warningDate.setDate(now.getDate() + 30);

    vehicles.forEach(v => {
        if (v.osagoEndDate && new Date(v.osagoEndDate) < warningDate) count++;
        if (v.diagnosticCardExpiryDate && new Date(v.diagnosticCardExpiryDate) < warningDate) count++;
    });

    const employees = await getEmployees({ isActive: true });
    employees.forEach(e => {
        if (e.driverCardExpiryDate && new Date(e.driverCardExpiryDate) < warningDate) count++;
        if (e.medicalCertificateExpiryDate && new Date(e.medicalCertificateExpiryDate) < warningDate) count++;
    });

    return count;
}

function aggregateByMonth(waybills: any[], type: 'fuel' | 'exams') {
    const map = new Map<string, number>();

    waybills.forEach(w => {
        const date = new Date(w.date);
        const key = date.toLocaleString('ru-RU', { month: 'short' });

        if (type === 'fuel') {
            const fuel = (w.fuelAtStart ?? 0) + (w.fuelFilled ?? 0) - (w.fuelAtEnd ?? 0);
            map.set(key, (map.get(key) || 0) + fuel);
        } else {
            map.set(key, (map.get(key) || 0) + 1);
        }
    });

    return Array.from(map.entries()).map(([month, value]) => {
        if (type === 'fuel') return { month, 'Факт': value };
        return { month, 'Осмотры': value };
    }) as any[];
}

export async function getIssues(filters: { vehicleId?: string }) {
    try {
        const params = new URLSearchParams();
        if (filters.vehicleId) params.append('vehicleId', filters.vehicleId);
        const queryString = params.toString() ? `?${params.toString()}` : '';

        const response = await httpClient.get<{ success: boolean; data: { expiringDocs: any[] } }>(`/dashboard/issues${queryString}`);
        return response.data;
    } catch (e) {
        console.warn('⚠️ [dashboardApi] Issues endpoint failed, falling back');
        return getIssuesClientSide(filters);
    }
}

async function getIssuesClientSide(filters: { vehicleId?: string }) {
    const vehicles = await getVehicles();
    const employees = await getEmployees({ isActive: true });

    const expiringDocs: { type: string; name: string; date: string }[] = [];
    const now = new Date();
    const warningDate = new Date();
    warningDate.setDate(now.getDate() + 30);

    const check = (dateStr: string | undefined | null, type: string, name: string) => {
        if (dateStr && new Date(dateStr) < warningDate) {
            expiringDocs.push({ type, name, date: dateStr });
        }
    };

    vehicles.forEach(v => {
        if (filters.vehicleId && v.id !== filters.vehicleId) return;
        check(v.osagoEndDate, 'ОСАГО', `${v.brand} ${v.registrationNumber}`);
        check(v.diagnosticCardExpiryDate, 'Диагностическая карта', `${v.brand} ${v.registrationNumber}`);
    });

    if (!filters.vehicleId) {
        employees.forEach(e => {
            check(e.driverCardExpiryDate, 'Карта водителя', e.shortName);
            check(e.medicalCertificateExpiryDate, 'Медсправка', e.shortName);
        });
    }

    return { expiringDocs };
}

import { PrismaClient, WaybillStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export interface DashboardFilters {
    organizationId: string;
    vehicleId?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface KpiData {
    mileageMonth: number;
    mileageQuarter: number;
    mileageYear: number;
    fuelMonth: number;
    fuelQuarter: number;
    fuelYear: number;
    totalFuelBalance: number;
    issues: number;
}

export interface DashboardData {
    kpi: KpiData;
    fuelConsumptionByMonth: { month: string; Факт: number }[];
    medicalExamsByMonth: { month: string; Осмотры: number }[];
}

// Helper to get Russian month abbreviations
const MONTH_NAMES = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

// Helper to safely convert Decimal to number
function toNumber(val: Decimal | null | undefined): number {
    if (!val) return 0;
    return typeof val.toNumber === 'function' ? val.toNumber() : Number(val);
}

export async function getDashboardStats(filters: DashboardFilters): Promise<DashboardData> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3);

    // Build date ranges
    const monthStart = new Date(currentYear, currentMonth, 1);
    const quarterStart = new Date(currentYear, currentQuarter * 3, 1);
    const yearStart = new Date(currentYear, 0, 1);

    // Base filter for waybills
    const baseWhere: any = {
        organizationId: filters.organizationId,
        status: WaybillStatus.POSTED
    };

    if (filters.vehicleId) {
        baseWhere.vehicleId = filters.vehicleId;
    }

    // === Fetch waybills with fuel data for KPI ===
    // Month
    const monthWaybills = await prisma.waybill.findMany({
        where: { ...baseWhere, date: { gte: monthStart } },
        select: { odometerStart: true, odometerEnd: true, fuelLines: { select: { fuelConsumed: true } } }
    });

    // Quarter  
    const quarterWaybills = await prisma.waybill.findMany({
        where: { ...baseWhere, date: { gte: quarterStart } },
        select: { odometerStart: true, odometerEnd: true, fuelLines: { select: { fuelConsumed: true } } }
    });

    // Year
    const yearWaybills = await prisma.waybill.findMany({
        where: { ...baseWhere, date: { gte: yearStart } },
        select: { odometerStart: true, odometerEnd: true, fuelLines: { select: { fuelConsumed: true } } }
    });

    // Calculate totals
    const calcTotals = (waybills: typeof monthWaybills) => {
        let mileage = 0;
        let fuel = 0;
        waybills.forEach(w => {
            mileage += toNumber(w.odometerEnd) - toNumber(w.odometerStart);
            fuel += w.fuelLines.reduce((sum, f) => sum + toNumber(f.fuelConsumed), 0);
        });
        return { mileage, fuel };
    };

    const monthTotals = calcTotals(monthWaybills);
    const quarterTotals = calcTotals(quarterWaybills);
    const yearTotals = calcTotals(yearWaybills);

    // === Issues Count (simple count of waybills in draft state as a placeholder) ===
    const draftWaybillsCount = await prisma.waybill.count({
        where: {
            organizationId: filters.organizationId,
            status: WaybillStatus.DRAFT,
            ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {})
        }
    });

    // === Chart Data: Fuel Consumption by Month ===
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : yearStart;
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : now;

    const waybillsForCharts = await prisma.waybill.findMany({
        where: {
            ...baseWhere,
            date: { gte: dateFrom, lte: dateTo }
        },
        select: {
            date: true,
            fuelLines: { select: { fuelConsumed: true } },
            routes: { select: { date: true } }
        }
    });

    // Aggregate by month
    const fuelByMonth = new Map<string, number>();
    const examsByMonth = new Map<string, number>();

    waybillsForCharts.forEach(w => {
        // Fuel aggregation (attributed to Waybill Date)
        const wbMonthKey = MONTH_NAMES[w.date.getMonth()];
        const fuelSum = w.fuelLines.reduce((sum, f) => sum + toNumber(f.fuelConsumed), 0);
        fuelByMonth.set(wbMonthKey, (fuelByMonth.get(wbMonthKey) || 0) + fuelSum);

        // Medical Exams aggregation (attributed to distinct dates of activity)
        // Set of unique date strings (YYYY-MM-DD) to count exams
        const distinctDates = new Set<string>();

        // Always include the waybill start date - REMOVED based on user feedback
        // distinctDates.add(w.date.toISOString().slice(0, 10));

        // Add any specific dates from routes
        w.routes.forEach(r => {
            if (r.date) {
                distinctDates.add(r.date.toISOString().slice(0, 10));
            } else {
                // Should we count routes without dates? 
                // Assumed yes, using waybill date as fallback if it's a real trip
                distinctDates.add(w.date.toISOString().slice(0, 10));
            }
        });

        // Increment exam count for the month of EACH unique date
        distinctDates.forEach(dateStr => {
            const date = new Date(dateStr);
            const monthKey = MONTH_NAMES[date.getMonth()];
            examsByMonth.set(monthKey, (examsByMonth.get(monthKey) || 0) + 1);
        });
    });

    const fuelConsumptionByMonth = Array.from(fuelByMonth.entries()).map(([month, value]) => ({
        month,
        'Факт': Math.round(value * 10) / 10
    }));

    const medicalExamsByMonth = Array.from(examsByMonth.entries()).map(([month, value]) => ({
        month,
        'Осмотры': value
    }));

    return {
        kpi: {
            mileageMonth: Math.round(monthTotals.mileage * 10) / 10,
            mileageQuarter: Math.round(quarterTotals.mileage * 10) / 10,
            mileageYear: Math.round(yearTotals.mileage * 10) / 10,
            fuelMonth: Math.round(monthTotals.fuel * 10) / 10,
            fuelQuarter: Math.round(quarterTotals.fuel * 10) / 10,
            fuelYear: Math.round(yearTotals.fuel * 10) / 10,
            totalFuelBalance: 0, // No currentFuel field in Vehicle model
            issues: draftWaybillsCount
        },
        fuelConsumptionByMonth,
        medicalExamsByMonth
    };
}

export async function getExpiringDocs(organizationId: string, vehicleId?: string): Promise<{ type: string; name: string; date: string }[]> {
    // Note: The current Prisma schema doesn't have document expiry fields
    // (osagoEndDate, diagnosticCardExpiryDate, driverCardExpiryDate, medicalCertificateExpiryDate)
    // So we return an empty array for now
    // TODO: Add these fields to the Prisma schema if needed
    return [];
}

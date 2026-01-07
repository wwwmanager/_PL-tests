import { WaybillStatus, StockLocationType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { getBalancesAt } from './stockService';

// =============================================================================
// Interfaces
// =============================================================================

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
    fuelPeriod: number;             // DASH-IMP-005: Fuel for selected period
    totalFuelBalance: number;
    totalCardBalance: number;
    totalOdometer: number | null;   // DASH-IMP-002: null = Все ТС, number = конкретное ТС
    issues: number;
    waybillStats: {
        draft: number;
        review: number;
        posted: number;
    }
}

export interface ChartData {
    month: string;
    value: number;
}

export interface TopVehicleData {
    id: string;
    name: string; // Brand + RegNumber
    value: number;
}

export interface DriverStatsData {
    id: string;
    name: string; // ShortName
    value: number;
}

export interface MaintenanceData {
    id: string;
    vehicle: string;
    remainingKm: number;
    status: 'critical' | 'warning' | 'ok'; // <500, <1000, >1000
}

export interface BirthdayData {
    id: string;
    name: string;
    date: string; // DD.MM
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
    kpi: KpiData;
    fuelConsumptionByMonth: ChartData[];
    medicalExamsByMonth: ChartData[];
    topFuelVehicles: TopVehicleData[];
    driverExams: DriverStatsData[];
    upcomingMaintenance: MaintenanceData[];
    birthdays: BirthdayData[];
    issuesList: IssueItem[];
}

// =============================================================================
// Service Implementation
// =============================================================================

// Helper: Russian Month Names
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// Helper: Format Date DD.MM.YYYY
const formatDate = (d: Date) => d.toLocaleDateString('ru-RU');

// Helper: Safe Decimal to Number
const toNumber = (val: Decimal | null | undefined): number => {
    if (!val) return 0;
    return typeof val.toNumber === 'function' ? val.toNumber() : Number(val);
};

export async function getDashboardStats(filters: DashboardFilters): Promise<DashboardData> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3);

    // Date Ranges
    const monthStart = new Date(currentYear, currentMonth, 1);
    const quarterStart = new Date(currentYear, currentQuarter * 3, 1);
    const yearStart = new Date(currentYear, 0, 1);

    // Active Filters
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : yearStart;
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : now;
    // Adjust dateTo to end of day if it's the same as today or specific date
    dateTo.setHours(23, 59, 59, 999);

    // DASH-FIX-003: Include child organizations (subdivisions) in the filter
    const childOrgs = await prisma.organization.findMany({
        where: { parentOrganizationId: filters.organizationId },
        select: { id: true }
    });
    const allOrgIds = [filters.organizationId, ...childOrgs.map(o => o.id)];

    // Use organizationId IN [...] for queries that need to include child orgs
    const orgFilter = { organizationId: filters.organizationId };
    const orgFilterWithChildren = { organizationId: { in: allOrgIds } };
    const vehicleFilter = filters.vehicleId ? { vehicleId: filters.vehicleId } : {};

    console.log('[Dashboard] Filters:', {
        org: filters.organizationId,
        childOrgs: childOrgs.length,
        veh: filters.vehicleId,
        dates: { from: dateFrom, to: dateTo }
    });

    // 1. KPI Stats (Mileage & Fuel) - Based on POSTED waybills for accuracy
    // -------------------------------------------------------------------------
    const kpiWaybills = await prisma.waybill.findMany({
        where: {
            ...orgFilter,
            ...vehicleFilter,
            status: WaybillStatus.POSTED,
            date: { gte: yearStart } // Get all for year to calculate M/Q/Y
        },
        select: {
            date: true,
            odometerStart: true,
            odometerEnd: true,
            fuelLines: { select: { fuelConsumed: true } }
        }
    });

    let mileageMonth = 0, mileageQuarter = 0, mileageYear = 0;
    let fuelMonth = 0, fuelQuarter = 0, fuelYear = 0;

    for (const w of kpiWaybills) {
        const mileage = toNumber(w.odometerEnd) - toNumber(w.odometerStart);
        const fuel = w.fuelLines.reduce((sum, f) => sum + toNumber(f.fuelConsumed), 0);
        const d = w.date;

        // Year (Since we filtered gte yearStart)
        mileageYear += mileage;
        fuelYear += fuel;

        // Quarter
        if (d >= quarterStart) {
            mileageQuarter += mileage;
            fuelQuarter += fuel;
        }

        // Month
        if (d >= monthStart) {
            mileageMonth += mileage;
            fuelMonth += fuel;
        }
    }

    // 2. Balances (Tank, Cards, Odometer) - Using StockLocation for accurate data
    // -------------------------------------------------------------------------
    console.log('[Dashboard] Querying Vehicles with:', {
        ...orgFilter,
        isActive: true,
        ...(filters.vehicleId ? { id: filters.vehicleId } : {})
    });

    const activeVehicles = await prisma.vehicle.findMany({
        where: {
            // DASH-FIX-003: Use orgFilterWithChildren to find vehicles in child organizations
            ...orgFilterWithChildren,
            // DASH-FIX-002: When specific vehicle is selected, don't filter by isActive
            // to allow viewing data for any vehicle the user selects
            ...(filters.vehicleId ? { id: filters.vehicleId } : { isActive: true })
        },
        select: {
            id: true,
            mileage: true,
            registrationNumber: true,
            brand: true,
            lastMaintenanceMileage: true,
            maintenanceIntervalKm: true,
            osagoEndDate: true,
            diagnosticCardExpiryDate: true,
            fuelStockItemId: true,
            stockLocation: { select: { id: true } },
            fuelCards: { select: { id: true, stockLocation: { select: { id: true } }, assignedToDriverId: true } },
            assignedDriver: {
                select: {
                    id: true,
                    shortName: true,  // DASH-IMP-001: For issue descriptions
                    fullName: true,
                    driver: { select: { id: true, licenseValidTo: true } },
                    medicalCertificateExpiryDate: true,
                    driverCardExpiryDate: true
                }
            }
        }
    });

    // DASH-IMP-002: Odometer - show vehicle mileage only for specific vehicle, null for "Все ТС"
    const totalOdometer = filters.vehicleId && activeVehicles.length > 0
        ? toNumber(activeVehicles[0].mileage)
        : null;

    // DASH-FIX-001: Use getBalancesAt from stockService for accurate fuel balances
    // Find all fuel stock items for the organization
    const fuelStockItems = await prisma.stockItem.findMany({
        where: {
            organizationId: filters.organizationId,
            isFuel: true,
            isActive: true
        },
        select: { id: true }
    });

    let totalFuelBalance = 0;
    let totalCardBalance = 0;

    // DASH-FIX-004: Get driver's fuel cards when filtering by vehicle
    let driverFuelCardStockLocationIds: string[] = [];
    if (filters.vehicleId && activeVehicles.length > 0) {
        const vehicle = activeVehicles[0];
        if (vehicle.assignedDriver?.driver?.id) {
            // Find fuel cards assigned to this driver
            const driverCards = await prisma.fuelCard.findMany({
                where: {
                    assignedToDriverId: vehicle.assignedDriver.driver.id,
                    isActive: true
                },
                select: {
                    stockLocation: { select: { id: true } }
                }
            });
            driverFuelCardStockLocationIds = driverCards
                .filter(fc => fc.stockLocation?.id)
                .map(fc => fc.stockLocation!.id);
            console.log('[Dashboard] Driver fuel cards:', {
                driverId: vehicle.assignedDriver.driver.id,
                cardCount: driverCards.length,
                locationIds: driverFuelCardStockLocationIds
            });
        }
    }

    // Calculate balances from StockLocation for each fuel type
    for (const fuelItem of fuelStockItems) {
        const balances = await getBalancesAt(filters.organizationId, fuelItem.id, new Date());

        for (const bal of balances) {
            // Filter by vehicleId if specified
            if (filters.vehicleId) {
                // For VEHICLE_TANK: check if this location belongs to selected vehicle
                const tankLoc = activeVehicles.find(v => v.stockLocation?.id === bal.locationId);
                // For FUEL_CARD: check cards assigned to vehicle directly
                const vehicleCardLocs = activeVehicles.flatMap(v => v.fuelCards.map(fc => fc.stockLocation?.id));

                if (bal.locationType === StockLocationType.VEHICLE_TANK && tankLoc) {
                    totalFuelBalance += bal.balance;
                } else if (bal.locationType === StockLocationType.FUEL_CARD) {
                    // DASH-FIX-004: Check both vehicle cards AND driver cards
                    if (vehicleCardLocs.includes(bal.locationId) ||
                        driverFuelCardStockLocationIds.includes(bal.locationId)) {
                        totalCardBalance += bal.balance;
                    }
                }
            } else {
                // No vehicle filter - sum all
                if (bal.locationType === StockLocationType.VEHICLE_TANK) {
                    totalFuelBalance += bal.balance;
                } else if (bal.locationType === StockLocationType.FUEL_CARD) {
                    totalCardBalance += bal.balance;
                }
            }
        }
    }

    console.log('[Dashboard] Fuel balances from StockLocation:', { totalFuelBalance, totalCardBalance });

    // 3. Status Counts (Draft, Review, Posted) - Respecting Date Range & Vehicle
    // -------------------------------------------------------------------------
    // Note: User asked for "Проведены" count.
    const statusCounts = await prisma.waybill.groupBy({
        by: ['status'],
        where: {
            ...orgFilter,
            ...vehicleFilter,
            date: { gte: dateFrom, lte: dateTo }
        },
        _count: { id: true }
    });

    const getCount = (s: WaybillStatus) => statusCounts.find(c => c.status === s)?._count.id || 0;
    const waybillStats = {
        draft: getCount(WaybillStatus.DRAFT),
        review: getCount(WaybillStatus.SUBMITTED),
        posted: getCount(WaybillStatus.POSTED),
    };

    // 4. Issues Logic (Docs, Maintenance)
    // -------------------------------------------------------------------------
    const issuesList: IssueItem[] = [];
    const checkDate = (dateStr: string | Date | null | undefined, name: string, type: IssueItem['type'], vehicleId: string, vehicleInfo: string) => {
        if (!dateStr) return;
        const d = new Date(dateStr);
        const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);

        if (diffDays < 0) { // Expired
            issuesList.push({
                id: `${type}-${vehicleId}-${name}`,
                type,
                title: `Просрочка: ${name}`,
                description: `${vehicleInfo}. Истекло: ${formatDate(d)}`,
                severity: 'critical',
                date: d.toISOString(),
                vehicleId
            });
        } else if (diffDays <= 30) { // Warning
            issuesList.push({
                id: `${type}-${vehicleId}-${name}`,
                type,
                title: `Истекает: ${name}`,
                description: `${vehicleInfo}. Дата: ${formatDate(d)} (${Math.ceil(diffDays)} дн.)`,
                severity: 'warning',
                date: d.toISOString(),
                vehicleId
            });
        }
    };

    activeVehicles.forEach(v => {
        const vInfo = `${v.brand} ${v.registrationNumber}`;

        // Vehicle Docs
        checkDate(v.osagoEndDate, 'ОСАГО', 'doc_vehicle', v.id, vInfo);
        checkDate(v.diagnosticCardExpiryDate, 'Диагностическая карта', 'doc_vehicle', v.id, vInfo);

        // Driver Docs (if assigned)
        if (v.assignedDriver) {
            // DASH-IMP-001: Show driver name in issue description
            const driverName = v.assignedDriver.shortName || v.assignedDriver.fullName;

            // License check
            if (v.assignedDriver.driver?.licenseValidTo) {
                checkDate(v.assignedDriver.driver.licenseValidTo, 'ВУ Водителя', 'doc_driver', v.id, driverName);
            }
            // Medical check
            checkDate(v.assignedDriver.medicalCertificateExpiryDate, 'Медсправка', 'doc_driver', v.id, driverName);
            // Driver card
            checkDate(v.assignedDriver.driverCardExpiryDate, 'Карта тахографа', 'doc_driver', v.id, driverName);
        }

        // Maintenance (only if tracked)
        if (v.lastMaintenanceMileage > 0) {
            const mileage = toNumber(v.mileage);
            const nextService = v.lastMaintenanceMileage + v.maintenanceIntervalKm;
            const remaining = nextService - mileage;

            if (remaining < 0) {
                issuesList.push({
                    id: `maint-${v.id}`,
                    type: 'maintenance',
                    title: 'Просрочено ТО',
                    description: `${vInfo}. Перепробег: ${Math.abs(remaining)} км`,
                    severity: 'critical',
                    vehicleId: v.id
                });
            } else if (remaining <= 1000) {
                issuesList.push({
                    id: `maint-${v.id}`,
                    type: 'maintenance',
                    title: 'Скоро ТО',
                    description: `${vInfo}. Осталось: ${remaining} км`,
                    severity: 'warning',
                    vehicleId: v.id
                });
            }
        } // End if lastMaintenanceMileage > 0
    });

    const issuesCount = issuesList.length;

    // 5. Dynamic Charts (Fuel & Medical) - POSTED waybills in Date Range
    // -------------------------------------------------------------------------
    // We fetch posted waybills again for the specific range for aggregation
    // (We could reuse kpiWaybills if range matches, but let's be safe with separate query for chart range)
    const chartWaybills = await prisma.waybill.findMany({
        where: {
            ...orgFilter,
            ...vehicleFilter,
            status: WaybillStatus.POSTED,
            date: { gte: dateFrom, lte: dateTo } // User selected range
        },
        select: {
            date: true,
            vehicleId: true,
            driverId: true,
            fuelLines: { select: { fuelConsumed: true } },
            routes: { select: { date: true } } // needed for medical exams count
        }
    });

    // DASH-FIX-005: Separate query for comparison charts (top vehicles, driver exams)
    // These should ALWAYS show ALL vehicles/drivers regardless of vehicleId filter
    const chartWaybillsAll = await prisma.waybill.findMany({
        where: {
            ...orgFilterWithChildren, // Include child orgs
            // NO vehicleFilter here!
            status: WaybillStatus.POSTED,
            date: { gte: dateFrom, lte: dateTo }
        },
        select: {
            date: true,
            vehicleId: true,
            driverId: true,
            fuelLines: { select: { fuelConsumed: true } },
            routes: { select: { date: true } }
        }
    });

    const fuelMap = new Map<string, number>();
    const medicalMap = new Map<string, number>();

    chartWaybills.forEach(w => {
        const d = w.date;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

        // Fuel
        const fuel = w.fuelLines.reduce((sum, f) => sum + toNumber(f.fuelConsumed), 0);
        fuelMap.set(key, (fuelMap.get(key) || 0) + fuel);

        // Medical Exams - logic: single day = 1, multiday = count of unique days
        const uniqueDays = new Set<string>();
        // Always add start date if routes empty, or just rely on routes?
        // Logic: if routes present, use routes dates. If single day, Just 1.
        if (w.routes.length > 0) {
            w.routes.forEach(r => {
                if (r.date) uniqueDays.add(r.date.toISOString().split('T')[0]);
            });
        }

        let exams = uniqueDays.size;
        // Fallback: if no routes or no dates, count as 1 (start date)
        if (exams === 0) exams = 1;

        medicalMap.set(key, (medicalMap.get(key) || 0) + exams);
    });

    // Formatting charts
    const sortAndFormat = (map: Map<string, number>): ChartData[] => {
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, val]) => {
                const [y, m] = key.split('-');
                return {
                    month: MONTH_NAMES[parseInt(m) - 1], // + " " + y (optional year)
                    value: Math.round(val * 10) / 10
                };
            });
    };

    const fuelConsumptionByMonth = sortAndFormat(fuelMap);
    const medicalExamsByMonth = sortAndFormat(medicalMap);

    // 6. Top 10 Fuel Consumers
    // -------------------------------------------------------------------------
    const vehicleFuelMap = new Map<string, number>();
    chartWaybillsAll.forEach(w => {
        const fuel = w.fuelLines.reduce((sum, f) => sum + toNumber(f.fuelConsumed), 0);
        vehicleFuelMap.set(w.vehicleId, (vehicleFuelMap.get(w.vehicleId) || 0) + fuel);
    });

    // We need logic to map IDs to Names quickly (we have activeVehicles, but chart might include inactive ones found in old waybills)
    // Let's resolve names efficiently.
    const allVehicleIds = Array.from(vehicleFuelMap.keys());
    // Use activeVehicles cache first, fallback to DB if needed
    const vehicleInfoMap = new Map<string, string>();
    activeVehicles.forEach(v => vehicleInfoMap.set(v.id, `${v.registrationNumber} (${v.brand})`));

    // Find missing
    const missingVIds = allVehicleIds.filter(id => !vehicleInfoMap.has(id));
    if (missingVIds.length > 0) {
        const extras = await prisma.vehicle.findMany({
            where: { id: { in: missingVIds } },
            select: { id: true, registrationNumber: true, brand: true }
        });
        extras.forEach(v => vehicleInfoMap.set(v.id, `${v.registrationNumber} (${v.brand})`));
    }

    const topFuelVehicles: TopVehicleData[] = Array.from(vehicleFuelMap.entries())
        .map(([id, val]) => ({
            id,
            name: vehicleInfoMap.get(id) || 'Unknown',
            value: Math.round(val)
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    // 7. Driver Exams Stats
    // -------------------------------------------------------------------------
    const driverExamsMap = new Map<string, number>();
    chartWaybillsAll.forEach(w => {
        if (!w.driverId) return;

        // Re-calc exams count strict for this record
        const uniqueDays = new Set<string>();
        if (w.routes.length > 0) {
            w.routes.forEach(r => {
                if (r.date) uniqueDays.add(r.date.toISOString().split('T')[0]);
            });
        }
        let exams = uniqueDays.size > 0 ? uniqueDays.size : 1;

        driverExamsMap.set(w.driverId, (driverExamsMap.get(w.driverId) || 0) + exams);
    });

    const allDriverIds = Array.from(driverExamsMap.keys());
    const employees = await prisma.employee.findMany({
        where: { driver: { id: { in: allDriverIds } } },
        select: { driver: { select: { id: true } }, shortName: true, fullName: true }
    });

    const driverNameMap = new Map<string, string>();
    employees.forEach(e => {
        if (e.driver) driverNameMap.set(e.driver.id, e.shortName || e.fullName);
    });

    const driverExams: DriverStatsData[] = Array.from(driverExamsMap.entries())
        .map(([id, val]) => ({
            id,
            name: driverNameMap.get(id) || 'Unknown',
            value: val
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Maybe top 10 too?

    // 8. Upcoming Maintenance (< 2000km)
    // -------------------------------------------------------------------------
    const upcomingMaintenance: MaintenanceData[] = activeVehicles
        .map(v => {
            const mileage = toNumber(v.mileage);
            const next = v.lastMaintenanceMileage + v.maintenanceIntervalKm;
            const remaining = next - mileage;
            let status: MaintenanceData['status'] = 'ok';
            if (remaining < 500) status = 'critical';
            else if (remaining < 1000) status = 'warning';

            return {
                id: v.id,
                vehicle: `${v.registrationNumber} (${v.brand})`,
                remainingKm: Math.round(remaining),
                status
            };
        })
        .filter(i => i.remainingKm < 2000)
        .sort((a, b) => a.remainingKm - b.remainingKm);

    // 9. Birthdays (Current Month)
    // -------------------------------------------------------------------------
    const birthdayEmployees = await prisma.employee.findMany({
        where: {
            organizationId: filters.organizationId,
            isActive: true,
            dateOfBirth: { not: null }
        },
        select: { id: true, shortName: true, fullName: true, dateOfBirth: true }
    });

    const birthdays: BirthdayData[] = [];
    birthdayEmployees.forEach(e => {
        if (!e.dateOfBirth) return;
        // DOB format in DB is string (usually YYYY-MM-DD or DD.MM.YYYY, user says input is string)
        // Assume ISO for now or try parse. Standard in this project seems to be YYYY-MM-DD
        const dob = new Date(e.dateOfBirth);
        if (isNaN(dob.getTime())) return;

        if (dob.getMonth() === currentMonth) {
            const isToday = dob.getDate() === now.getDate();
            birthdays.push({
                id: e.id,
                name: e.shortName || e.fullName,
                date: `${String(dob.getDate()).padStart(2, '0')}.${String(dob.getMonth() + 1).padStart(2, '0')}`,
                isToday
            });
        }
    });

    birthdays.sort((a, b) => {
        const dayA = parseInt(a.date.split('.')[0]);
        const dayB = parseInt(b.date.split('.')[0]);
        return dayA - dayB;
    });

    return {
        kpi: {
            mileageMonth: Math.round(mileageMonth * 10) / 10,
            mileageQuarter: Math.round(mileageQuarter * 10) / 10,
            mileageYear: Math.round(mileageYear * 10) / 10,
            fuelMonth: Math.round(fuelMonth * 10) / 10,
            fuelQuarter: Math.round(fuelQuarter * 10) / 10,
            fuelYear: Math.round(fuelYear * 10) / 10,
            // DASH-IMP-005: Fuel for selected period (sum from chart data)
            fuelPeriod: Math.round(fuelConsumptionByMonth.reduce((sum, c) => sum + c.value, 0) * 100) / 100,
            // DASH-IMP-003: Round to 2 decimals
            totalFuelBalance: Math.round(totalFuelBalance * 100) / 100,
            totalCardBalance: Math.round(totalCardBalance * 100) / 100,
            // DASH-IMP-002: null for "Все ТС", mileage for specific vehicle
            totalOdometer: totalOdometer !== null ? Math.round(totalOdometer) : null,
            issues: issuesCount,
            waybillStats
        },
        fuelConsumptionByMonth,
        medicalExamsByMonth,
        topFuelVehicles,
        driverExams,
        upcomingMaintenance,
        birthdays,
        issuesList
    };
}

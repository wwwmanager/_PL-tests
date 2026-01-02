import { parseAndPreviewRouteFile, RouteSegment } from './routeParserService';
import { isWorkingDayStandard, getHolidayName, getWorkingWeekRange, calendarApi } from './productionCalendarService';
import { Waybill, WaybillStatus, Vehicle, Employee, SeasonSettings, CalendarEvent, Route } from '../types';
import { addWaybill } from './api/waybillApi';
import { getAvailableBlanksForDriver } from './blankApi';
import { calculateDistance, WaybillCalculationMethod } from './waybillCalculations';
import { calculatePlannedFuelByMethod, FuelCalculationMethod, mapLegacyMethod } from './fuelCalculationService';
import { isWinterDate } from './dateUtils';

export interface BatchPreviewItem {
    dateStr: string; // yyyy-mm-dd
    dateObj: Date;
    dayOfWeek: string;
    isWorking: boolean;
    holidayName?: string;
    routes: RouteSegment[];
    totalDistance: number;
    warnings: string[];
    fuelFilled?: number;
}

export type GroupingDuration = 'day' | '2days' | 'week' | 'month';

export interface BatchConfig {
    driverId: string;
    vehicleId: string;
    organizationId: string;
    dispatcherId: string;
    controllerId: string;
    createEmptyDays: boolean;
    groupingDuration: GroupingDuration;
    calculationMethod: WaybillCalculationMethod;
}

const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
};

const timeToMinutes = (time: string | undefined): number | null => {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
};

const minutesToTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const toLocalISO = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const generateBatchPreview = async (
    file: File,
    periodStart?: string,
    periodEnd?: string,
    calendarEvents?: CalendarEvent[]
): Promise<BatchPreviewItem[]> => {
    const buffer = await file.arrayBuffer();

    const { routeSegments } = await parseAndPreviewRouteFile(buffer, file.name, file.type, {
        autoRemoveEmpty: true
    });

    const segmentsByDate = new Map<string, RouteSegment[]>();
    const normalizedDates: string[] = [];

    routeSegments.forEach(seg => {
        if (seg.date) {
            const isoDate = normalizeDate(seg.date);

            if (!segmentsByDate.has(isoDate)) {
                segmentsByDate.set(isoDate, []);
                normalizedDates.push(isoDate);
            }
            segmentsByDate.get(isoDate)!.push(seg);
        }
    });

    let start: Date;
    let end: Date;

    if (periodStart && periodEnd) {
        start = new Date(periodStart);
        end = new Date(periodEnd);
    } else {
        normalizedDates.sort();
        if (normalizedDates.length > 0) {
            start = new Date(normalizedDates[0]);
            end = new Date(normalizedDates[normalizedDates.length - 1]);
        } else {
            start = new Date();
            end = new Date();
        }
    }

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(0, 0, 0, 0);

    const items: BatchPreviewItem[] = [];

    while (current <= endDate) {
        const dateKey = toLocalISO(current);

        const routes = segmentsByDate.get(dateKey) || [];
        const dist = calculateDistance(routes as any[]);

        const isStandardWorking = isWorkingDayStandard(current, calendarEvents);
        const holiday = getHolidayName(current, calendarEvents);

        const isWorking = isStandardWorking || routes.length > 0;

        const warnings: string[] = [];
        if (!isStandardWorking && routes.length > 0) {
            warnings.push('Поездки в выходной/праздник');
        }

        items.push({
            dateStr: dateKey,
            dateObj: new Date(current),
            dayOfWeek: current.toLocaleDateString('ru-RU', { weekday: 'short' }),
            isWorking,
            holidayName: holiday,
            routes,
            totalDistance: dist,
            warnings,
            fuelFilled: 0
        });

        current.setDate(current.getDate() + 1);
    }

    return items;
};

/**
 * WB-BATCH-002: Use unified fuelCalculationService for fuel calculations
 * Converts BatchPreviewItem[] to Route[] and calls calculateBoiler
 */
const calculateGroupConsumption = (group: BatchPreviewItem[], vehicle: Vehicle, seasonSettings: SeasonSettings | null, method: FuelCalculationMethod) => {
    // Convert BatchPreviewItems to Routes for unified calculation
    const allRoutes: Route[] = [];
    for (const item of group) {
        for (const seg of item.routes) {
            allRoutes.push({
                id: seg.id || '',
                from: seg.from || '',
                to: seg.to || '',
                fromPoint: seg.from || '',
                toPoint: seg.to || '',
                distanceKm: seg.distanceKm || 0,
                isCityDriving: false,
                isWarming: false,
                date: item.dateStr,
            } as Route);
        }
    }

    // Use first date of group as base dateOr fallback
    const baseDate = group[0]?.dateStr || new Date().toISOString().split('T')[0];

    const result = calculatePlannedFuelByMethod({
        method,
        routes: allRoutes,
        vehicleRates: vehicle.fuelConsumptionRates,
        seasonSettings,
        baseDate,
        dayMode: 'multi'
    });

    return { distance: result.totalDistance, consumption: result.plannedFuel };
};

const getISOWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const createWaybillFromGroup = async (
    group: BatchPreviewItem[],
    config: BatchConfig,
    vehicle: Vehicle,
    blank: { id: string; series: string; number: number } | undefined,
    startOdo: number,
    startFuel: number,
    actorId?: string,
    fuelFilledSum: number = 0,
    seasonSettings?: SeasonSettings,
    calendarEvents?: CalendarEvent[]
) => {
    const first = group[0];
    const last = group[group.length - 1];

    let validFromStr = first.dateStr;
    let validToStr = last.dateStr;

    if (config.groupingDuration === 'week') {
        const { start, end } = getWorkingWeekRange(first.dateObj, calendarEvents);

        let finalStart = start;
        let finalEnd = end;

        if (seasonSettings) {
            const targetSeasonIsWinter = isWinterDate(first.dateStr, seasonSettings);

            const startStr = toLocalISO(finalStart);
            if (isWinterDate(startStr, seasonSettings) !== targetSeasonIsWinter) {
                let d = new Date(finalStart);
                while (d < finalEnd) {
                    const dStr = toLocalISO(d);
                    if (isWinterDate(dStr, seasonSettings) === targetSeasonIsWinter) {
                        finalStart = d;
                        break;
                    }
                    d.setDate(d.getDate() + 1);
                }
            }

            const endStr = toLocalISO(finalEnd);
            if (isWinterDate(endStr, seasonSettings) !== targetSeasonIsWinter) {
                let d = new Date(finalEnd);
                while (d > finalStart) {
                    const dStr = toLocalISO(d);
                    if (isWinterDate(dStr, seasonSettings) === targetSeasonIsWinter) {
                        finalEnd = d;
                        break;
                    }
                    d.setDate(d.getDate() - 1);
                }
            }
        }

        validFromStr = toLocalISO(finalStart);
        validToStr = toLocalISO(finalEnd);
    }

    const { distance, consumption } = calculateGroupConsumption(group, vehicle, seasonSettings || null, mapLegacyMethod(config.calculationMethod));
    const endOdo = Number(startOdo) + Number(distance);
    const endFuel = startFuel + fuelFilledSum - consumption;

    // WB-FUEL-NEG-001: Warn if calculated fuel end is negative
    let notes = 'Пакетная генерация';
    if (endFuel < 0) {
        notes += ` ⚠️ ВНИМАНИЕ: Расчётный остаток топлива отрицательный (${endFuel.toFixed(2)} л). Добавьте заправку!`;
        console.warn(`[WB-FUEL-NEG-001] Negative fuel end detected: ${endFuel.toFixed(2)} for group starting ${group[0].dateStr}`);
    }

    const waybillRoutes = [];
    let minMinutes = 24 * 60;
    let maxMinutes = 0;
    let hasTimes = false;

    for (const item of group) {
        for (const r of item.routes) {
            if ((r as any).departureTime) {
                const mins = timeToMinutes((r as any).departureTime);
                if (mins !== null) {
                    if (mins < minMinutes) minMinutes = mins;
                    hasTimes = true;
                }
            }
            if ((r as any).arrivalTime) {
                const mins = timeToMinutes((r as any).arrivalTime);
                if (mins !== null) {
                    if (mins > maxMinutes) maxMinutes = mins;
                    hasTimes = true;
                }
            }

            waybillRoutes.push({
                id: r.id,
                fromPoint: r.from,
                toPoint: r.to,
                distanceKm: r.distanceKm,
                isCityDriving: false,
                isWarming: false,
                date: item.dateStr,
                legOrder: waybillRoutes.length + 1,
            });
        }
    }

    const startTimeStr = hasTimes ? minutesToTime(minMinutes) : '08:00';
    const endTimeStr = hasTimes ? minutesToTime(maxMinutes) : '17:00';

    const payload: any = {
        blankId: blank?.id,
        date: validFromStr,
        validFrom: `${validFromStr}T${startTimeStr}:00Z`,
        validTo: `${validToStr}T${endTimeStr}:00Z`,
        vehicleId: config.vehicleId,
        driverId: config.driverId,
        organizationId: config.organizationId,
        dispatcherId: config.dispatcherId,
        controllerId: config.controllerId,
        status: WaybillStatus.DRAFT,
        odometerStart: Math.round(startOdo),
        odometerEnd: Math.round(endOdo),
        fuelAtStart: Math.round(startFuel * 100) / 100,
        fuelAtEnd: Math.round(endFuel * 100) / 100,
        fuelPlanned: Math.round(consumption * 100) / 100,
        fuelConsumed: Math.round(consumption * 100) / 100,  // WB-FUEL-NEG-001: Pass fuelConsumed
        fuelFilled: fuelFilledSum,
        routes: waybillRoutes,
        notes,
        calculationMethod: config.calculationMethod,
        // WB-BATCH-001: Pass stockItemId to trigger mapLegacyFuelFields in backend controller
        stockItemId: vehicle.fuelStockItemId || undefined,
    };

    const wb = await addWaybill(payload);

    // Note: Backend already reserves blank when blankId is provided in waybill creation
    // No need to call useBlankForWaybill separately

    return wb;
};

export const saveBatchWaybills = async (
    items: BatchPreviewItem[],
    config: BatchConfig,
    vehicle: Vehicle,
    driver: Employee,
    onProgress: (current: number, total: number) => void,
    actorId?: string,
    calendarEvents?: CalendarEvent[],
    seasonSettings?: SeasonSettings
): Promise<void> => {

    let runningOdometer = Number(vehicle.mileage) || 0;
    let runningFuel = Number(vehicle.currentFuel) || 0;

    // Get available blanks for this driver (uses Driver.id, status=ISSUED)
    const availableBlanks = await getAvailableBlanksForDriver(config.driverId);
    console.log(`[BatchWaybill] Available blanks for driver ${config.driverId}: ${availableBlanks.length}`);

    const validItems = items
        .filter(i => i.isWorking)
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    if (validItems.length === 0) return;

    // Pre-calculate number of groups (waybills) that will be created
    // This is an estimate based on grouping logic
    let estimatedGroups = 0;
    let tempGroup: BatchPreviewItem[] = [];
    for (const item of validItems) {
        if (item.routes.length === 0 && !config.createEmptyDays) continue;

        if (tempGroup.length === 0) {
            tempGroup.push(item);
        } else {
            // Check if new group needed (simplified check)
            const lastItem = tempGroup[tempGroup.length - 1];
            const needNewGroup =
                (config.groupingDuration === 'day') ||
                (config.groupingDuration === 'week' && getISOWeek(item.dateObj) !== getISOWeek(lastItem.dateObj)) ||
                (config.groupingDuration === 'month' && item.dateObj.getMonth() !== lastItem.dateObj.getMonth());

            if (needNewGroup && tempGroup.length > 0) {
                estimatedGroups++;
                tempGroup = [];
            }
            tempGroup.push(item);
        }
    }
    if (tempGroup.length > 0) estimatedGroups++;

    console.log(`[BatchWaybill] Estimated waybills to create: ${estimatedGroups}, blanks available: ${availableBlanks.length}`);

    // Validate blank count before starting
    if (availableBlanks.length < estimatedGroups) {
        throw new Error(
            `Недостаточно бланков для генерации. ` +
            `Требуется: ${estimatedGroups}, доступно: ${availableBlanks.length}. ` +
            `Выдайте дополнительные бланки водителю.`
        );
    }

    let blankIndex = 0;
    let currentGroup: BatchPreviewItem[] = [];
    let processedGroups = 0;
    const estimateTotal = validItems.length;

    for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];

        if (item.routes.length === 0 && !config.createEmptyDays) {
            continue;
        }

        let startNewGroup = false;

        if (currentGroup.length === 0) {
            startNewGroup = false;
        } else {
            const firstInGroup = currentGroup[0];
            const prevInGroup = currentGroup[currentGroup.length - 1];
            const diffTime = item.dateObj.getTime() - firstInGroup.dateObj.getTime();

            if (item.dateObj.getMonth() !== firstInGroup.dateObj.getMonth()) {
                startNewGroup = true;
            }
            else if (item.dateObj.getFullYear() !== firstInGroup.dateObj.getFullYear()) {
                startNewGroup = true;
            }
            else {
                const wasWinter = isWinterDate(prevInGroup.dateStr, seasonSettings || null);
                const isWinter = isWinterDate(item.dateStr, seasonSettings || null);

                if (wasWinter !== isWinter) {
                    startNewGroup = true;
                } else {
                    if (config.groupingDuration === 'day') {
                        startNewGroup = true;
                    } else if (config.groupingDuration === '2days') {
                        const gapDays = diffTime / (1000 * 60 * 60 * 24);
                        if (currentGroup.length >= 2 || gapDays > 1.5) {
                            startNewGroup = true;
                        }
                    } else if (config.groupingDuration === 'week') {
                        const currentWeek = getISOWeek(item.dateObj);
                        const firstWeek = getISOWeek(firstInGroup.dateObj);
                        if (currentWeek !== firstWeek) {
                            startNewGroup = true;
                        }
                    }
                }
            }
        }

        if (startNewGroup && currentGroup.length > 0) {
            const groupFuelFilled = currentGroup.reduce((sum, it) => sum + (it.fuelFilled || 0), 0);

            await createWaybillFromGroup(
                currentGroup,
                config,
                vehicle,
                availableBlanks[blankIndex],
                runningOdometer,
                runningFuel,
                actorId,
                groupFuelFilled,
                seasonSettings,
                calendarEvents
            );

            const groupDist = currentGroup.reduce((sum, it) => sum + (Number(it.totalDistance) || 0), 0);
            const { consumption } = calculateGroupConsumption(currentGroup, vehicle, seasonSettings || null, mapLegacyMethod(config.calculationMethod));

            runningOdometer += groupDist;
            runningFuel = runningFuel + groupFuelFilled - consumption;

            if (availableBlanks[blankIndex]) blankIndex++;
            processedGroups++;
            onProgress(i, estimateTotal);
            currentGroup = [];
        }

        currentGroup.push(item);
    }

    if (currentGroup.length > 0) {
        const groupFuelFilled = currentGroup.reduce((sum, it) => sum + (it.fuelFilled || 0), 0);

        await createWaybillFromGroup(
            currentGroup,
            config,
            vehicle,
            availableBlanks[blankIndex],
            runningOdometer,
            runningFuel,
            actorId,
            groupFuelFilled,
            seasonSettings,
            calendarEvents
        );
        processedGroups++;
        onProgress(estimateTotal, estimateTotal);
    }
};

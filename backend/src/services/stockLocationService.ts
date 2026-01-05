import { PrismaClient, StockLocationType } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

/**
 * REL-101: Stock Location Service
 * Управление локациями хранения топлива и ТМЦ
 */

// ============================================================================
// Get or Create Default Warehouse Location
// ============================================================================

/**
 * Получить или создать локацию для дефолтного склада организации/подразделения
 */
export async function getOrCreateDefaultWarehouseLocation(
    organizationId: string,
    departmentId?: string | null
): Promise<{ id: string; name: string; warehouseId: string }> {
    // Сначала проверяем, есть ли склад с привязкой к StockLocation
    const existingLocation = await prisma.stockLocation.findFirst({
        where: {
            organizationId,
            departmentId: departmentId || null,
            type: StockLocationType.WAREHOUSE,
        },
        include: {
            warehouse: true,
        },
    });

    if (existingLocation && existingLocation.warehouseId) {
        return {
            id: existingLocation.id,
            name: existingLocation.name,
            warehouseId: existingLocation.warehouseId,
        };
    }

    // Ищем склад без привязки к StockLocation
    let warehouse = await prisma.warehouse.findFirst({
        where: {
            organizationId,
            departmentId: departmentId || undefined,
            stockLocation: null,  // Нет привязки
        },
    });

    // Если склада нет, создаём дефолтный
    if (!warehouse) {
        const defaultName = departmentId
            ? 'Склад подразделения'
            : 'Центральный склад';

        warehouse = await prisma.warehouse.create({
            data: {
                organizationId,
                departmentId: departmentId || null,
                name: defaultName,
            },
        });
    }

    // Создаём StockLocation для склада
    const location = await prisma.stockLocation.create({
        data: {
            organizationId,
            departmentId: departmentId || null,
            type: StockLocationType.WAREHOUSE,
            name: warehouse.name,
            warehouseId: warehouse.id,
        },
    });

    return {
        id: location.id,
        name: location.name,
        warehouseId: warehouse.id,
    };
}

// ============================================================================
// Get or Create Vehicle Tank Location
// ============================================================================

/**
 * Получить или создать локацию бака для транспортного средства
 */
export async function getOrCreateVehicleTankLocation(
    vehicleId: string
): Promise<{ id: string; name: string; vehicleId: string }> {
    // Проверяем существование ТС
    const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
            stockLocation: true,
            organization: true,
        },
    });

    if (!vehicle) {
        throw new NotFoundError(`Транспортное средство ${vehicleId} не найдено`);
    }

    // Если локация уже существует
    if (vehicle.stockLocation) {
        return {
            id: vehicle.stockLocation.id,
            name: vehicle.stockLocation.name,
            vehicleId: vehicle.id,
        };
    }

    // Создаём локацию для бака
    const locationName = `Бак ТС ${vehicle.registrationNumber}`;

    const location = await prisma.stockLocation.create({
        data: {
            organizationId: vehicle.organizationId,
            departmentId: vehicle.departmentId,
            type: StockLocationType.VEHICLE_TANK,
            name: locationName,
            vehicleId: vehicle.id,
        },
    });

    return {
        id: location.id,
        name: location.name,
        vehicleId: vehicle.id,
    };
}

// ============================================================================
// Get or Create Fuel Card Location
// ============================================================================

/**
 * Получить или создать локацию для топливной карты
 */
export async function getOrCreateFuelCardLocation(
    fuelCardId: string
): Promise<{ id: string; name: string; fuelCardId: string }> {
    // Проверяем существование карты
    const fuelCard = await prisma.fuelCard.findUnique({
        where: { id: fuelCardId },
        include: {
            stockLocation: true,
            organization: true,
        },
    });

    if (!fuelCard) {
        throw new NotFoundError(`Топливная карта ${fuelCardId} не найдена`);
    }

    // Если локация уже существует
    if (fuelCard.stockLocation) {
        return {
            id: fuelCard.stockLocation.id,
            name: fuelCard.stockLocation.name,
            fuelCardId: fuelCard.id,
        };
    }

    // Создаём локацию для карты
    const locationName = `Топливная карта ${fuelCard.cardNumber}`;

    const location = await prisma.stockLocation.create({
        data: {
            organizationId: fuelCard.organizationId,
            departmentId: null,  // Карты не привязаны к подразделению
            type: StockLocationType.FUEL_CARD,
            name: locationName,
            fuelCardId: fuelCard.id,
        },
    });

    return {
        id: location.id,
        name: location.name,
        fuelCardId: fuelCard.id,
    };
}

// ============================================================================
// List Locations
// ============================================================================

export interface ListLocationsFilter {
    type?: StockLocationType;
    departmentId?: string | null;
    vehicleId?: string;
    fuelCardId?: string;
    warehouseId?: string;
    isActive?: boolean;
    or?: Array<{
        vehicleId?: string;
        fuelCardId?: string | { in: string[] };
        type?: StockLocationType;
    }>; // RLS-STOCK-LOC-010: Support OR for driver filtering
}

/**
 * Получить список локаций организации с фильтрами
 */
export async function listLocations(
    organizationId: string,
    filters: ListLocationsFilter = {}
): Promise<Array<{
    id: string;
    name: string;
    type: StockLocationType;
    departmentId: string | null;
    warehouseId: string | null;
    fuelCardId: string | null;
    vehicleId: string | null;
    isActive: boolean;
    createdAt: Date;
}>> {
    // Include ALL descendant organizations recursively (multi-level hierarchy)
    async function getAllDescendantOrgIds(parentId: string): Promise<string[]> {
        const children = await prisma.organization.findMany({
            where: { parentOrganizationId: parentId },
            select: { id: true }
        });

        const childIds = children.map(c => c.id);
        const grandchildIds: string[] = [];

        for (const childId of childIds) {
            const descendants = await getAllDescendantOrgIds(childId);
            grandchildIds.push(...descendants);
        }

        return [...childIds, ...grandchildIds];
    }

    const descendantOrgIds = await getAllDescendantOrgIds(organizationId);
    const orgIds = [organizationId, ...descendantOrgIds];

    const where: any = {
        organizationId: { in: orgIds },
    };

    if (filters.type) {
        where.type = filters.type;
    }
    if (filters.departmentId !== undefined) {
        where.departmentId = filters.departmentId;
    }
    if (filters.vehicleId) {
        where.vehicleId = filters.vehicleId;
    }
    if (filters.fuelCardId) {
        where.fuelCardId = filters.fuelCardId;
    }
    if (filters.warehouseId) {
        where.warehouseId = filters.warehouseId;
    }
    if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
    }
    if (filters.or) {
        where.OR = filters.or;
    }

    const locations = await prisma.stockLocation.findMany({
        where,
        orderBy: [
            { type: 'asc' },
            { name: 'asc' },
        ],
    });

    return locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        type: loc.type,
        departmentId: loc.departmentId,
        warehouseId: loc.warehouseId,
        fuelCardId: loc.fuelCardId,
        vehicleId: loc.vehicleId,
        isActive: loc.isActive,
        createdAt: loc.createdAt,
    }));
}

// ============================================================================
// Get Location by ID
// ============================================================================

/**
 * Получить локацию по ID
 */
export async function getLocationById(
    id: string
): Promise<{
    id: string;
    name: string;
    type: StockLocationType;
    organizationId: string;
    departmentId: string | null;
    warehouseId: string | null;
    fuelCardId: string | null;
    vehicleId: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
} | null> {
    const location = await prisma.stockLocation.findUnique({
        where: { id },
    });

    if (!location) {
        return null;
    }

    return {
        id: location.id,
        name: location.name,
        type: location.type,
        organizationId: location.organizationId,
        departmentId: location.departmentId,
        warehouseId: location.warehouseId,
        fuelCardId: location.fuelCardId,
        vehicleId: location.vehicleId,
        isActive: location.isActive,
        createdAt: location.createdAt,
        updatedAt: location.updatedAt,
    };
}

// ============================================================================
// Get Location by Entity
// ============================================================================

/**
 * Получить локацию по привязанной сущности (warehouse, fuelCard, vehicle)
 */
export async function getLocationByEntity(
    entityType: 'warehouse' | 'fuelCard' | 'vehicle',
    entityId: string
): Promise<{ id: string; name: string; type: StockLocationType } | null> {
    const where: any = {};

    switch (entityType) {
        case 'warehouse':
            where.warehouseId = entityId;
            break;
        case 'fuelCard':
            where.fuelCardId = entityId;
            break;
        case 'vehicle':
            where.vehicleId = entityId;
            break;
        default:
            throw new BadRequestError(`Неизвестный тип сущности: ${entityType}`);
    }

    const location = await prisma.stockLocation.findFirst({
        where,
    });

    if (!location) {
        return null;
    }

    return {
        id: location.id,
        name: location.name,
        type: location.type,
    };
}

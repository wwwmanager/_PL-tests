/**
 * REL-200/REL-201: StockItem (Nomenclature) Service
 * CRUD operations for unified stock items catalog
 */

import { PrismaClient, Prisma, StockItemCategory } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface StockItemCreateInput {
    organizationId: string;
    departmentId?: string;
    code?: string;
    name: string;
    unit?: string;
    isFuel?: boolean;
    density?: number;
    categoryEnum?: StockItemCategory;  // REL-201: enum
    category?: string;  // Deprecated
    fuelTypeLegacyId?: string;  // REL-201
}

export interface StockItemUpdateInput {
    departmentId?: string | null;
    code?: string;
    name?: string;
    unit?: string;
    isFuel?: boolean;
    density?: number;
    categoryEnum?: StockItemCategory;
    category?: string;
    isActive?: boolean;
}

export interface StockItemFilter {
    organizationId: string;
    categoryEnum?: StockItemCategory;
    category?: string;  // Deprecated
    isFuel?: boolean;
    isActive?: boolean;
    search?: string;
}

/**
 * Get all stock items with optional filters
 */
export async function getAll(filter: StockItemFilter) {
    const { organizationId, categoryEnum, category, isFuel, isActive, search } = filter;

    const where: Prisma.StockItemWhereInput = {
        organizationId,
    };

    // REL-201: Prefer categoryEnum over deprecated category string
    if (categoryEnum !== undefined) {
        where.categoryEnum = categoryEnum;
    } else if (category !== undefined) {
        // Backward compat: try to match by string category
        where.category = category;
    }

    if (isFuel !== undefined) {
        where.isFuel = isFuel;
    }

    if (isActive !== undefined) {
        where.isActive = isActive;
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
        ];
    }

    return prisma.stockItem.findMany({
        where,
        orderBy: [
            { categoryEnum: 'asc' },
            { name: 'asc' },
        ],
        include: {
            fuelType: true,  // Include legacy FuelType for migration visibility
            department: { select: { id: true, name: true } },  // REL-201
        },
    });
}

/**
 * Get stock item by ID
 */
export async function getById(id: string, organizationId: string) {
    return prisma.stockItem.findFirst({
        where: { id, organizationId },
        include: {
            fuelType: true,
            department: { select: { id: true, name: true } },
        },
    });
}

/**
 * Create new stock item
 */
export async function create(data: StockItemCreateInput) {
    // REL-201: Auto-set categoryEnum for fuel items
    let categoryEnum = data.categoryEnum;
    if (!categoryEnum && data.isFuel) {
        categoryEnum = StockItemCategory.FUEL;
    }

    return prisma.stockItem.create({
        data: {
            organizationId: data.organizationId,
            departmentId: data.departmentId,
            code: data.code,
            name: data.name,
            unit: data.unit || 'л',
            isFuel: data.isFuel ?? false,
            density: data.density,
            categoryEnum,
            category: data.category,  // Deprecated but kept for compat
            fuelTypeLegacyId: data.fuelTypeLegacyId,
        },
    });
}

/**
 * Update stock item
 */
export async function update(id: string, organizationId: string, data: StockItemUpdateInput) {
    return prisma.stockItem.updateMany({
        where: { id, organizationId },
        data,
    }).then(() => getById(id, organizationId));
}

/**
 * Soft-delete stock item (set isActive = false)
 */
export async function softDelete(id: string, organizationId: string) {
    return prisma.stockItem.updateMany({
        where: { id, organizationId },
        data: { isActive: false },
    });
}

/**
 * REL-201: Get only fuel items (using categoryEnum)
 */
export async function getFuelItems(organizationId: string) {
    return getAll({ organizationId, categoryEnum: StockItemCategory.FUEL, isActive: true });
}

/**
 * REL-201: Get items by categoryEnum
 */
export async function getByCategory(organizationId: string, categoryEnum: StockItemCategory) {
    return getAll({ organizationId, categoryEnum, isActive: true });
}

/**
 * REL-201: DEPRECATED wrapper for /fuel-types compatibility
 * Returns StockItems where categoryEnum=FUEL formatted like old FuelType
 */
export async function getFuelTypesCompat(organizationId: string) {
    logger.warn('[DEPRECATED] getFuelTypesCompat called - use /stock-items?categoryEnum=FUEL instead');

    const items = await prisma.stockItem.findMany({
        where: {
            organizationId,
            categoryEnum: StockItemCategory.FUEL,
            isActive: true,
        },
        orderBy: { name: 'asc' },
    });

    // Map to legacy FuelType format
    return items.map(item => ({
        id: item.id,
        code: item.code || '',
        name: item.name,
        density: item.density,
        // Provide fallback to fuelTypeLegacyId for old consumers
        legacyId: item.fuelTypeLegacyId,
    }));
}

/**
 * @deprecated MIG-FT-001: FuelType API is deprecated. Use stockItemApi instead.
 * 
 * This is a compatibility wrapper that maps FuelType operations to StockItem.
 * All new code should use stockItemApi.ts directly.
 */

import { getStockItems, createStockItem, updateStockItem, deleteStockItem, StockItem } from '../stockItemApi';
import { FuelType } from '../../types';

/**
 * @deprecated Use getStockItems({ categoryEnum: 'FUEL' }) instead
 */
export async function getFuelTypes(): Promise<FuelType[]> {
    console.warn('[DEPRECATED] getFuelTypes() called. Use stockItemApi.getStockItems({ categoryEnum: "FUEL" }) instead.');

    const items = await getStockItems({ categoryEnum: 'FUEL', isActive: true });

    // Map StockItem to FuelType format
    return items.map(item => ({
        id: item.id,
        code: item.code || '',
        name: item.name,
        density: item.density ?? undefined,
    }));
}

/**
 * @deprecated Use stockItemApi.getStockItems + filter
 */
export async function getFuelTypeById(id: string): Promise<FuelType | null> {
    console.warn('[DEPRECATED] getFuelTypeById() called. Use stockItemApi instead.');

    const items = await getStockItems({ categoryEnum: 'FUEL' });
    const item = items.find(i => i.id === id);

    if (!item) return null;

    return {
        id: item.id,
        code: item.code || '',
        name: item.name,
        density: item.density ?? undefined,
    };
}

/**
 * @deprecated CRUD operations should use stockItemApi directly
 */
export async function createFuelType(data: {
    code: string;
    name: string;
    density?: number | null;
}): Promise<FuelType> {
    console.warn('[DEPRECATED] createFuelType() called. Use stockItemApi.createStockItem() instead.');

    const item = await createStockItem({
        code: data.code,
        name: data.name,
        unit: 'л',
        isFuel: true,
        categoryEnum: 'FUEL',
        density: data.density ?? undefined,
    });

    return {
        id: item.id,
        code: item.code || '',
        name: item.name,
        density: item.density ?? undefined,
    };
}

/**
 * @deprecated CRUD operations should use stockItemApi directly
 */
export async function updateFuelType(id: string, data: {
    code?: string;
    name?: string;
    density?: number | null;
}): Promise<FuelType> {
    console.warn('[DEPRECATED] updateFuelType() called. Use stockItemApi.updateStockItem() instead.');

    const item = await updateStockItem(id, {
        code: data.code,
        name: data.name,
        density: data.density ?? undefined,
    });

    return {
        id: item.id,
        code: item.code || '',
        name: item.name,
        density: item.density ?? undefined,
    };
}

/**
 * @deprecated CRUD operations should use stockItemApi directly
 */
export async function deleteFuelType(id: string): Promise<void> {
    console.warn('[DEPRECATED] deleteFuelType() called. Use stockItemApi.deleteStockItem() instead.');
    await deleteStockItem(id);
}

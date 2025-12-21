/**
 * @deprecated MIG-FT-001: FuelType API is deprecated. Use stockItemApi instead.
 * 
 * This is a compatibility wrapper that maps FuelType operations to StockItem.
 * All new code should use stockItemApi.ts directly.
 */

import { getStockItems, StockItem } from './stockItemApi';

// Legacy FuelType interface for compatibility
export interface FuelType {
    id: string;
    code: string;
    name: string;
    density?: number | null;
}

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
        density: item.density,
    }));
}

/**
 * @deprecated CRUD operations should use stockItemApi directly
 */
export async function addFuelType(data: { code: string; name: string; density?: number }): Promise<FuelType> {
    console.warn('[DEPRECATED] addFuelType() called. Use stockItemApi.createStockItem() instead.');

    // Import dynamically to avoid circular dependency
    const { createStockItem } = await import('./stockItemApi');

    const item = await createStockItem({
        code: data.code,
        name: data.name,
        unit: 'л',
        isFuel: true,
        categoryEnum: 'FUEL',
        density: data.density,
    });

    return {
        id: item.id,
        code: item.code || '',
        name: item.name,
        density: item.density,
    };
}

/**
 * @deprecated CRUD operations should use stockItemApi directly
 */
export async function updateFuelType(data: { id: string; code?: string; name?: string; density?: number }): Promise<FuelType> {
    console.warn('[DEPRECATED] updateFuelType() called. Use stockItemApi.updateStockItem() instead.');

    const { updateStockItem } = await import('./stockItemApi');

    const item = await updateStockItem(data.id, {
        code: data.code,
        name: data.name,
        density: data.density,
    });

    return {
        id: item.id,
        code: item.code || '',
        name: item.name,
        density: item.density,
    };
}

/**
 * @deprecated CRUD operations should use stockItemApi directly
 */
export async function deleteFuelType(id: string): Promise<void> {
    console.warn('[DEPRECATED] deleteFuelType() called. Use stockItemApi.deleteStockItem() instead.');

    const { deleteStockItem } = await import('./stockItemApi');
    await deleteStockItem(id);
}

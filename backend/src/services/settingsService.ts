import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Settings are stored as JSON in a simple key-value table or a single Settings model.
// For simplicity, we'll use a Setting model with key-value pairs.

export interface AppSettings {
    isParserEnabled: boolean;
    enableWarehouseAccounting?: boolean;
    defaultStorageType?: string;
    appMode?: 'driver' | 'central';
    blanks?: {
        driverCanAddBatches: boolean;
    };
    // P0-F: Allow deletion of POSTED waybills (default: false = blocked)
    allowDeletePostedWaybills?: boolean;
    // P0-2: Allow direct deletion of stock movement documents (default: false = blocked)
    allowDirectStockMovementDeletion?: boolean;
}

export type SeasonSettings =
    | {
        type: 'recurring';
        summerDay: number;
        summerMonth: number;
        winterDay: number;
        winterMonth: number;
    }
    | {
        type: 'manual';
        winterStartDate: string;
        winterEndDate: string;
    };

const DEFAULT_APP_SETTINGS: AppSettings = {
    isParserEnabled: true,
    appMode: 'central',
    blanks: { driverCanAddBatches: false },
    allowDeletePostedWaybills: false,
    allowDirectStockMovementDeletion: false, // Default: blocked
};

const DEFAULT_SEASON_SETTINGS: SeasonSettings = {
    type: 'recurring',
    summerDay: 1,
    summerMonth: 4,
    winterDay: 1,
    winterMonth: 11
};

// Helper to get/set settings from a simple key-value store
// We'll use the Setting model if it exists, or create one
// For now, let's assume we have a Setting model with { key: string, value: Json }

export async function getAppSettings(): Promise<AppSettings> {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: 'app_settings' }
        });
        if (setting && setting.value) {
            return { ...DEFAULT_APP_SETTINGS, ...(setting.value as object) };
        }
    } catch (e) {
        console.warn('Setting model not found, using defaults');
    }
    return DEFAULT_APP_SETTINGS;
}

export async function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
    await prisma.setting.upsert({
        where: { key: 'app_settings' },
        update: { value: settings as any },
        create: { key: 'app_settings', value: settings as any }
    });
    return settings;
}

export async function getSeasonSettings(): Promise<SeasonSettings> {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: 'season_settings' }
        });
        if (setting && setting.value) {
            return setting.value as SeasonSettings;
        }
    } catch (e) {
        console.warn('Setting model not found, using defaults');
    }
    return DEFAULT_SEASON_SETTINGS;
}

export async function saveSeasonSettings(settings: SeasonSettings): Promise<SeasonSettings> {
    await prisma.setting.upsert({
        where: { key: 'season_settings' },
        update: { value: settings as any },
        create: { key: 'season_settings', value: settings as any }
    });
    return settings;
}

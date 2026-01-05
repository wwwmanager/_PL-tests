import { PrismaClient, AssetKind, WearMode } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateAssetInput {
    vehicleId: string;
    kind: AssetKind;
    serialNo?: string;
    stockItemId?: string;
    installedAt: Date;
    installedAtOdometerKm: number;
    wearMode: WearMode;
    serviceLifeMonths?: number;
    wearPctPer1000km?: number;
    wearPct?: number;
}

export async function createAsset(data: CreateAssetInput) {
    return prisma.vehicleAsset.create({
        data: {
            vehicleId: data.vehicleId,
            kind: data.kind,
            serialNo: data.serialNo,
            stockItemId: data.stockItemId,
            installedAt: data.installedAt,
            installedAtOdometerKm: data.installedAtOdometerKm,
            wearMode: data.wearMode,
            serviceLifeMonths: data.serviceLifeMonths,
            wearPctPer1000km: data.wearPctPer1000km,
            wearPct: data.wearPct || 0,
            status: 'IN_USE'
        }
    });
}

export async function getAssetsByVehicle(vehicleId: string) {
    return prisma.vehicleAsset.findMany({
        where: { vehicleId },
        include: { stockItem: true }
    });
}

export async function decommissionAsset(assetId: string) {
    return prisma.vehicleAsset.update({
        where: { id: assetId },
        data: { status: 'SCRAPPED' }
    });
}

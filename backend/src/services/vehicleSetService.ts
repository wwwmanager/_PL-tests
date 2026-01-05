import { PrismaClient, SetStatus, SetKind, SeasonType } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

export interface CreateSetInput {
    vehicleId: string;
    kind: SetKind;
    season: SeasonType;
    spec: string;
    stockLocationId?: string; // If starting as STORED
    wearPct?: number;
}

export async function createSet(data: CreateSetInput) {
    return prisma.vehicleSet.create({
        data: {
            vehicleId: data.vehicleId,
            kind: data.kind,
            season: data.season,
            spec: data.spec,
            status: SetStatus.STORED, // Default to stored, must equip explicitly or set in create? Let's default stored.
            stockLocationId: data.stockLocationId,
            wearPct: data.wearPct || 0,
        }
    });
}

export async function getSetsByVehicle(vehicleId: string) {
    return prisma.vehicleSet.findMany({
        where: { vehicleId },
        orderBy: { kind: 'asc' }
    });
}

export async function equipSet(setId: string, vehicleId: string, currentOdometer: number) {
    const set = await prisma.vehicleSet.findUnique({ where: { id: setId } });
    if (!set) throw new NotFoundError('Комплект не найден');
    if (set.vehicleId !== vehicleId) throw new BadRequestError('Комплект принадлежит другому ТС');
    if (set.status === SetStatus.IN_USE) throw new BadRequestError('Комплект уже установлен');

    // Unequip currently installed sets of same kind (e.g. remove Summer tires before putting Winter)
    // This is a simplified logic. Usually you might have multiple sets (front/rear). 
    // For now assuming 1 active set per kind.
    await prisma.vehicleSet.updateMany({
        where: {
            vehicleId,
            kind: set.kind,
            status: SetStatus.IN_USE
        },
        data: {
            status: SetStatus.STORED,
            removedAt: new Date(),
            removedAtOdometerKm: currentOdometer
            // Note: Should we require a location to store them? 
            // For simplicity, we leave stockLocationId null or keep previous?
            // Ideally should ask user. For now, we just unmark IN_USE.
        }
    });

    return prisma.vehicleSet.update({
        where: { id: setId },
        data: {
            status: SetStatus.IN_USE,
            installedAt: new Date(),
            installedAtOdometerKm: currentOdometer,
            stockLocationId: null, // Removed from storage
        }
    });
}

export async function unequipSet(setId: string, locationId: string, currentOdometer: number) {
    return prisma.vehicleSet.update({
        where: { id: setId },
        data: {
            status: SetStatus.STORED,
            removedAt: new Date(),
            removedAtOdometerKm: currentOdometer,
            stockLocationId: locationId
        }
    });
}

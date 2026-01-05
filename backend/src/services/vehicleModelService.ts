import { prisma } from '../db/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';

export async function listVehicleModels(organizationId: string) {
    // Include hierarchy if needed, but for models, usually organization wide or global
    // Assuming simple organization filter for now
    return prisma.vehicleModel.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
        include: {
            fuelStockItem: true
        }
    });
}

export async function getVehicleModelById(organizationId: string, id: string) {
    const model = await prisma.vehicleModel.findFirst({
        where: { id, organizationId },
        include: {
            fuelStockItem: true
        }
    });

    if (!model) return null;
    return model;
}

export async function createVehicleModel(organizationId: string, data: any) {
    if (!data.name) {
        throw new BadRequestError('Наименование конфигурации обязательно');
    }

    try {
        const model = await prisma.vehicleModel.create({
            data: {
                organizationId,
                name: data.name,
                brand: data.brand || '',
                model: data.model || '',
                type: data.type || '',
                fuelStockItemId: data.fuelStockItemId || null,
                tankCapacity: data.tankCapacity ? Number(data.tankCapacity) : null,
                summerRate: data.summerRate ? Number(data.summerRate) : null,
                winterRate: data.winterRate ? Number(data.winterRate) : null,
                tireSize: data.tireSize || null,
                rimSize: data.rimSize || null,
                manufactureYearFrom: data.manufactureYearFrom ? Number(data.manufactureYearFrom) : null,
                manufactureYearTo: data.manufactureYearTo ? Number(data.manufactureYearTo) : null,
            }
        });
        return model;
    } catch (e) {
        throw e;
    }
}

export async function updateVehicleModel(organizationId: string, id: string, data: any) {
    const model = await prisma.vehicleModel.findFirst({
        where: { id, organizationId }
    });

    if (!model) {
        throw new NotFoundError('Модель ТС не найдена');
    }

    return prisma.vehicleModel.update({
        where: { id },
        data: {
            name: data.name,
            brand: data.brand,
            model: data.model,
            type: data.type,
            fuelStockItemId: data.fuelStockItemId,
            tankCapacity: data.tankCapacity !== undefined ? (data.tankCapacity ? Number(data.tankCapacity) : null) : undefined,
            summerRate: data.summerRate !== undefined ? (data.summerRate ? Number(data.summerRate) : null) : undefined,
            winterRate: data.winterRate !== undefined ? (data.winterRate ? Number(data.winterRate) : null) : undefined,
            tireSize: data.tireSize,
            rimSize: data.rimSize,
            manufactureYearFrom: data.manufactureYearFrom !== undefined ? (data.manufactureYearFrom ? Number(data.manufactureYearFrom) : null) : undefined,
            manufactureYearTo: data.manufactureYearTo !== undefined ? (data.manufactureYearTo ? Number(data.manufactureYearTo) : null) : undefined,
        }
    });
}

export async function deleteVehicleModel(organizationId: string, id: string) {
    const model = await prisma.vehicleModel.findFirst({
        where: { id, organizationId }
    });

    if (!model) {
        throw new NotFoundError('Модель ТС не найдена');
    }

    // Check usage
    const usageCount = await prisma.vehicle.count({
        where: { vehicleModelId: id }
    });

    if (usageCount > 0) {
        throw new BadRequestError(`Невозможно удалить модель, так как она используется в ${usageCount} карточках ТС.`);
    }

    return prisma.vehicleModel.delete({
        where: { id }
    });
}

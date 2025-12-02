import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function listFuelTypes(req: Request, res: Response, next: NextFunction) {
    try {
        const fuelTypes = await prisma.fuelType.findMany({
            orderBy: { code: 'asc' }
        });

        res.json({ data: fuelTypes });
    } catch (err) {
        next(err);
    }
}

export async function createFuelType(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const fuelType = await prisma.fuelType.create({ data: req.body });

        res.status(201).json({ data: fuelType });
    } catch (err) {
        next(err);
    }
}

export async function updateFuelType(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const fuelType = await prisma.fuelType.update({
            where: { id },
            data: req.body
        });

        res.json({ data: fuelType });
    } catch (err) {
        next(err);
    }
}

export async function deleteFuelType(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        await prisma.fuelType.delete({ where: { id } });

        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

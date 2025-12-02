import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function listWarehouses(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const orgId = req.user.organizationId;

        const warehouses = await prisma.warehouse.findMany({
            where: { organizationId: orgId },
            orderBy: { name: 'asc' }
        });

        res.json({ data: warehouses });
    } catch (err) {
        next(err);
    }
}

export async function createWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = {
            ...req.body,
            organizationId: req.user.organizationId
        };

        const warehouse = await prisma.warehouse.create({ data });

        res.status(201).json({ data: warehouse });
    } catch (err) {
        next(err);
    }
}

export async function updateWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const warehouse = await prisma.warehouse.update({
            where: { id },
            data: req.body
        });

        res.json({ data: warehouse });
    } catch (err) {
        next(err);
    }
}

export async function deleteWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        await prisma.warehouse.delete({ where: { id } });

        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

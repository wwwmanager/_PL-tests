import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function listRoutes(req: Request, res: Response, next: NextFunction) {
    try {
        const routes = await prisma.route.findMany({
            orderBy: { name: 'asc' }
        });

        res.json({ data: routes });
    } catch (err) {
        next(err);
    }
}

export async function createRoute(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const route = await prisma.route.create({ data: req.body });

        res.status(201).json({ data: route });
    } catch (err) {
        next(err);
    }
}

export async function updateRoute(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const route = await prisma.route.update({
            where: { id },
            data: req.body
        });

        res.json({ data: route });
    } catch (err) {
        next(err);
    }
}

export async function deleteRoute(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        await prisma.route.delete({ where: { id } });

        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

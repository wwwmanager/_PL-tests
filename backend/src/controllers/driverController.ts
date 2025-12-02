// Driver Controller - CRUD operations for drivers
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function listDrivers(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const drivers = await prisma.driver.findMany({
            include: {
                employee: {
                    include: {
                        organization: true,
                        department: true,
                    },
                },
            },
            orderBy: {
                employee: {
                    fullName: 'asc',
                },
            },
        });

        res.json(drivers);
    } catch (err) {
        next(err);
    }
}

export async function getDriverById(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const driver = await prisma.driver.findUnique({
            where: { id },
            include: {
                employee: {
                    include: {
                        organization: true,
                        department: true,
                    },
                },
            },
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json(driver);
    } catch (err) {
        next(err);
    }
}

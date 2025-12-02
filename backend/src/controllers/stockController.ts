// Stock Controller - Read-only access to stock items and movements
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function listStockItems(req: Request, res: Response, next: NextFunction) {
    try {
        console.log('[stockItems] req.user =', req.user);

        if (!req.user) {
            console.log('[stockItems] ERROR: req.user is undefined!');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const organizationId = req.user.organizationId;
        console.log('[stockItems] organizationId =', organizationId);

        const items = await prisma.stockItem.findMany({
            where: organizationId ? { organizationId } : {},
            orderBy: { name: 'asc' },
        });

        console.log('[stockItems] Found items:', items.length);
        if (items.length > 0) {
            console.log('[stockItems] First item:', items[0]);
        }

        res.json(items);
    } catch (err) {
        console.error('[stockItems] Error:', err);
        next(err);
    }
}

// GET /api/stock/movements?stockItemId=...&waybillId=...
export async function listStockMovements(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const organizationId = req.user.organizationId;
        const { stockItemId, waybillId } = req.query as {
            stockItemId?: string;
            waybillId?: string;
        };

        const where: any = { organizationId };
        if (stockItemId) where.stockItemId = stockItemId;
        if (waybillId) where.documentId = waybillId; // связь с ПЛ через documentId

        const movements = await prisma.stockMovement.findMany({
            where,
            include: {
                stockItem: true,
                warehouse: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(movements);
    } catch (err) {
        next(err);
    }
}

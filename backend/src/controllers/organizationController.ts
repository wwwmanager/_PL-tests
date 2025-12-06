import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getMyOrganization(req: Request, res: Response, next: NextFunction) {
    try {
        // req.user заполняется authMiddleware (id, organizationId, role)
        if (!req.user) {
            return res.status(401).json({ error: 'Un authorized' });
        }

        const orgId = req.user.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'User has no organizationId' });
        }

        const organization = await prisma.organization.findUnique({
            where: { id: orgId },
        });

        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json({ data: organization });
    } catch (err) {
        next(err);
    }
}

export async function listOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const organizations = await prisma.organization.findMany({
            orderBy: { name: 'asc' }
        });

        res.json({ data: organizations });
    } catch (err) {
        next(err);
    }
}

export async function createOrganization(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // name is required in Prisma schema, populate from shortName if not provided
        const data = {
            ...req.body,
            name: req.body.name || req.body.shortName || 'Unnamed Organization',
        };

        const organization = await prisma.organization.create({
            data
        });

        res.status(201).json({ data: organization });
    } catch (err) {
        next(err);
    }
}

export async function updateOrganization(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        // If shortName is updated but name is not provided, update name too
        const data = { ...req.body };
        if (req.body.shortName && !req.body.name) {
            data.name = req.body.shortName;
        }
        const organization = await prisma.organization.update({
            where: { id },
            data
        });

        res.json({ data: organization });
    } catch (err) {
        next(err);
    }
}

export async function deleteOrganization(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        await prisma.organization.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

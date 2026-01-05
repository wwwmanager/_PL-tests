import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getAll(organizationId: string) {
    return prisma.brand.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' }
    });
}

export async function create(organizationId: string, name: string) {
    return prisma.brand.create({
        data: {
            organizationId,
            name
        }
    });
}

export async function ensureBrand(organizationId: string, name: string) {
    const existing = await prisma.brand.findUnique({
        where: {
            organizationId_name: {
                organizationId,
                name
            }
        }
    });

    if (existing) return existing;

    return create(organizationId, name);
}

/**
 * Seed script for driver waybill permissions
 * 
 * Run: npx ts-node scripts/seed-driver-waybill-permissions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_PERMISSIONS: Record<string, string[]> = {
    'driver': ['waybill.read', 'waybill.create', 'waybill.update', 'waybill.submit', 'blanks.spoil.self'],
};

async function seed() {
    console.log('Seeding driver waybill permissions...\n');

    // Get the driver role
    const driverRole = await prisma.role.findUnique({
        where: { code: 'driver' }
    });

    if (!driverRole) {
        console.error('  ❌ Role "driver" not found. Please run the main seed first.');
        return;
    }

    const permsForRole = ROLE_PERMISSIONS['driver'];

    for (const permCode of permsForRole) {
        let permission = await prisma.permission.findUnique({
            where: { code: permCode }
        });

        if (!permission) {
            console.log(`  + Creating missing permission: ${permCode}`);
            permission = await prisma.permission.create({
                data: { code: permCode, description: `Permission: ${permCode}` }
            });
        }

        // Check if already assigned
        const existing = await prisma.rolePermission.findUnique({
            where: {
                roleId_permissionId: {
                    roleId: driverRole.id,
                    permissionId: permission.id
                }
            }
        });

        if (existing) {
            console.log(`  ✓ driver already has ${permCode}`);
        } else {
            await prisma.rolePermission.create({
                data: {
                    roleId: driverRole.id,
                    permissionId: permission.id
                }
            });
            console.log(`  + Assigned ${permCode} to driver`);
        }
    }

    console.log('\nDone ✅');
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

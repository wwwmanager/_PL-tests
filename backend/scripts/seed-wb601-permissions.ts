/**
 * WB-601: Seed script for waybill status permissions
 * 
 * Adds permissions: waybill.submit, waybill.post, waybill.cancel
 * Assigns them to appropriate roles (admin, dispatcher, etc.)
 * 
 * Run: npx ts-node scripts/seed-wb601-permissions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NEW_PERMISSIONS = [
    { code: 'waybill.submit', name: 'Отправить путевой лист', description: 'DRAFT → SUBMITTED' },
    { code: 'waybill.post', name: 'Провести путевой лист', description: 'SUBMITTED → POSTED' },
    { code: 'waybill.cancel', name: 'Отменить путевой лист', description: '* → CANCELLED' },
];

// Roles that should have each permission
const ROLE_PERMISSIONS: Record<string, string[]> = {
    'admin': ['waybill.submit', 'waybill.post', 'waybill.cancel'],
    'dispatcher': ['waybill.submit', 'waybill.post', 'waybill.cancel'],
    'manager': ['waybill.submit', 'waybill.cancel'],
    'driver': ['waybill.submit'], // Driver can only submit their own
};

async function seed() {
    console.log('WB-601: Seeding waybill status permissions...\n');

    // 1. Create permissions if they don't exist
    for (const perm of NEW_PERMISSIONS) {
        const existing = await prisma.permission.findUnique({
            where: { code: perm.code }
        });

        if (existing) {
            console.log(`  ✓ Permission ${perm.code} already exists`);
        } else {
            await prisma.permission.create({
                data: perm
            });
            console.log(`  + Created permission: ${perm.code}`);
        }
    }

    console.log('');

    // 2. Get all roles
    const roles = await prisma.role.findMany();

    // 3. Assign permissions to roles
    for (const role of roles) {
        const permsForRole = ROLE_PERMISSIONS[role.code] || [];

        if (permsForRole.length === 0) {
            console.log(`  ⊘ No waybill status permissions for role: ${role.code}`);
            continue;
        }

        for (const permCode of permsForRole) {
            const permission = await prisma.permission.findUnique({
                where: { code: permCode }
            });

            if (!permission) {
                console.log(`  ⚠ Permission ${permCode} not found`);
                continue;
            }

            // Check if already assigned
            const existing = await prisma.rolePermission.findUnique({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: permission.id
                    }
                }
            });

            if (existing) {
                console.log(`  ✓ ${role.code} already has ${permCode}`);
            } else {
                await prisma.rolePermission.create({
                    data: {
                        roleId: role.id,
                        permissionId: permission.id
                    }
                });
                console.log(`  + Assigned ${permCode} to ${role.code}`);
            }
        }
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('WB-601: Permission seeding completed ✅');
    console.log('═══════════════════════════════════════════');
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

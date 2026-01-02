import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Starting permissions update...');

    // 1. Definition of new permissions
    const newPermissions = [
        { code: 'stock.movement.void', description: 'Permission to void manual stock movements' },
        { code: 'stock.period.lock', description: 'Permission to lock stock periods' },
        { code: 'stock.period.unlock', description: 'Permission to unlock stock periods' },
        { code: 'waybill.update', description: 'Permission to update waybills (edit drafts)' },
    ];

    // 2. Upsert permissions
    console.log('Creating/Updating permissions...');
    const permissionMap = new Map<string, string>();

    for (const p of newPermissions) {
        const upserted = await prisma.permission.upsert({
            where: { code: p.code },
            update: { description: p.description },
            create: { code: p.code, description: p.description },
        });
        permissionMap.set(p.code, upserted.id);
        console.log(`   - ${p.code}: ${upserted.id}`);
    }

    // Fix: Fetch existing permissions needed for Driver
    const existingPerms = await prisma.permission.findMany({
        where: { code: { in: ['stock.read', 'stock.create', 'stock.update', 'stock.delete', 'stock.manage'] } }
    });
    for (const p of existingPerms) {
        permissionMap.set(p.code, p.id);
    }

    // 3. Assign to Roles
    console.log('Assigning permissions to roles...');

    // Helper to assign permission to role
    const assign = async (roleCode: string, permCode: string) => {
        const role = await prisma.role.findUnique({ where: { code: roleCode } });
        if (!role) {
            console.warn(`⚠️ Role '${roleCode}' not found. Skipping.`);
            return;
        }

        const permId = permissionMap.get(permCode);
        if (!permId) return; // Should not happen

        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: role.id,
                    permissionId: permId,
                }
            },
            create: { roleId: role.id, permissionId: permId },
            update: {}, // exists
        });
        console.log(`   + Assigned ${permCode} to ${roleCode}`);
    };

    // A. Assign ALL to Admin
    for (const p of newPermissions) {
        await assign('admin', p.code);
    }

    // B. Assign specific to Accountant
    await assign('accountant', 'stock.movement.void');
    await assign('accountant', 'stock.period.lock');
    // Note: stock.period.unlock is for ADMIN only by default

    // C. Assign Stock permissions to Driver (User Request)
    await assign('driver', 'stock.read');
    await assign('driver', 'stock.create');
    await assign('driver', 'stock.update');
    await assign('driver', 'waybill.update');

    await assign('dispatcher', 'waybill.update');

    console.log('✅ Permissions updated successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Update failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

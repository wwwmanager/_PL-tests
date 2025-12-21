import { PrismaClient } from '@prisma/client';
import { getWaybillPrefillData } from './services/waybillService';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- SETUP TEST DATA (ROBUST) ---');

        let org = await prisma.organization.findFirst();
        if (!org) {
            org = await prisma.organization.create({
                data: { name: 'Test Org', inn: '123', kpp: '123' }
            });
        }

        let dept = await prisma.department.findFirst({ where: { organizationId: org.id } });
        if (!dept) {
            dept = await prisma.department.create({
                data: { organizationId: org.id, name: 'Test Dept' }
            });
        }

        // 2. Create Officials
        const disp = await prisma.employee.create({
            data: {
                organizationId: org.id,
                departmentId: dept.id,
                fullName: 'TEST_DISP_' + Date.now(),
                employeeType: 'dispatcher'
            }
        });
        const ctrl = await prisma.employee.create({
            data: {
                organizationId: org.id,
                departmentId: dept.id,
                fullName: 'TEST_CTRL_' + Date.now(),
                employeeType: 'controller'
            }
        });
        console.log(`Created officials: Disp=${disp.id}, Ctrl=${ctrl.id}`);

        // 3. Create Driver Employee with Personal Officials
        const driverEmp = await prisma.employee.create({
            data: {
                organizationId: org.id,
                departmentId: dept.id,
                fullName: 'TEST_DRIVER_' + Date.now(),
                employeeType: 'driver',
                dispatcherId: disp.id,
                controllerId: ctrl.id
            }
        });

        // Ensure Driver entity exists (linked to Employee)
        const driver = await prisma.driver.create({
            data: {
                employeeId: driverEmp.id,
                licenseNumber: 'TEST-' + Date.now()
            }
        });

        // 4. Create Vehicle assigned to this driver
        const vehicle = await prisma.vehicle.create({
            data: {
                organizationId: org.id,
                departmentId: dept.id,
                assignedDriverId: driverEmp.id,
                code: 'TEST-' + Math.floor(Math.random() * 1000),
                registrationNumber: 'AA' + Math.floor(Math.random() * 999) + 'BB',
                brand: 'TestCar',
                model: 'Model1'
            }
        });

        console.log(`Created Context: Vehicle=${vehicle.id}, AssignedDriver=${driverEmp.id}`);
        console.log(`Expected Prefill: Disp=${disp.id}, Ctrl=${ctrl.id}`);

        // 5. Query Prefill
        const user = await prisma.user.findFirst() || await prisma.user.create({
            data: { organizationId: org.id, email: 'test@local', passwordHash: '123', fullName: 'Test' }
        });

        console.log('Calling getWaybillPrefillData...');
        const result = await getWaybillPrefillData(
            {
                id: user.id,
                organizationId: user.organizationId,
                role: 'admin',
                employeeId: null,
                departmentId: null
            },
            vehicle.id
        );

        console.log('--- PREFILL RESPONSE ---');
        console.log(JSON.stringify(result, null, 2));
        console.log('--- END RESPONSE ---');

        if (result.dispatcherEmployeeId === disp.id && result.controllerEmployeeId === ctrl.id) {
            console.log('✅ SUCCESS: Personal dispatcher/controller returned!');
        } else {
            console.error('❌ FAILURE: Returned IDs do not match personal assignments.');
            console.error(`Expected Disp: ${disp.id}, Got: ${result.dispatcherEmployeeId}`);
            console.error(`Expected Ctrl: ${ctrl.id}, Got: ${result.controllerEmployeeId}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVehicle() {
    const regNum = 'a168xh174'; // From screenshot
    const vehicle = await prisma.vehicle.findFirst({
        where: { registrationNumber: { contains: regNum } },
        include: {
            assignedDriver: {
                include: {
                    department: true,
                    driver: true
                }
            },
            department: {
                include: {
                    defaultDispatcher: true,
                    defaultController: true
                }
            }
        }
    });

    console.log('Vehicle Found:', vehicle ? vehicle.registrationNumber : 'No');
    if (vehicle) {
        console.log('assignedDriverId:', vehicle.assignedDriverId);
        console.log('assignedDriver:', vehicle.assignedDriver ? vehicle.assignedDriver.lastName : 'null');
        console.log('Vehicle Dept:', vehicle.department?.name);
        console.log('Vehicle Dept Defaults:', {
            dispatcher: vehicle.department?.defaultDispatcherEmployeeId,
            controller: vehicle.department?.defaultControllerEmployeeId
        });

        if (vehicle.assignedDriver?.department) {
            console.log('Driver Dept:', vehicle.assignedDriver.department.name);
            console.log('Driver Dept Defaults:', {
                dispatcher: vehicle.assignedDriver.department.defaultDispatcherEmployeeId,
                controller: vehicle.assignedDriver.department.defaultControllerEmployeeId
            });
        }
    }
}

checkVehicle()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

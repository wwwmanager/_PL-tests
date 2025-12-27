// Employee Service - CRUD operations for employees
import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError } from '../utils/errors';
import { normalizeCardNumber, calculateRealBalance } from './fuelCardService';

const prisma = new PrismaClient();

export interface EmployeeFilters {
    organizationId?: string;
    departmentId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export async function getEmployees(filters: EmployeeFilters = {}) {
    const {
        organizationId,
        departmentId,
        isActive,
        page = 1,
        limit = 100,
    } = filters;

    const where: Prisma.EmployeeWhereInput = {};

    if (organizationId) {
        where.organizationId = organizationId;
    }

    if (departmentId) {
        where.departmentId = departmentId;
    }

    if (isActive !== undefined) {
        where.isActive = isActive;
    }

    console.log('📊 [employeeService] Filters:', JSON.stringify(where, null, 2));

    const skip = (page - 1) * limit;

    const [employees, total] = await Promise.all([
        prisma.employee.findMany({
            where,
            include: {
                organization: true,
                department: true,
                driver: { // REL-601: Include driver records to get linked fuel cards
                    include: {
                        fuelCards: {
                            where: { isActive: true },
                            take: 1
                        }
                    }
                }
            },
            orderBy: {
                fullName: 'asc',
            },
            skip,
            take: limit,
        }),
        prisma.employee.count({ where }),
    ]);

    // REL-601: Enrich employees with real fuel card balances
    const enrichedEmployees = await Promise.all(employees.map(async (emp: any) => {
        const driver = emp.driver;
        const fuelCard = driver?.fuelCards?.[0];

        let realBalance = emp.fuelCardBalance;
        if (fuelCard) {
            realBalance = await calculateRealBalance(emp.organizationId, fuelCard.id);
        }

        return {
            ...emp,
            fuelCardBalance: realBalance,
            fuelCardNumber: fuelCard?.cardNumber || emp.fuelCardNumber,
            driver: undefined // Remove from final response to save bandwidth
        };
    }));

    return {
        employees: enrichedEmployees,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getEmployeeById(id: string) {
    return prisma.employee.findUnique({
        where: { id },
        include: {
            organization: true,
            department: true,
        },
    });
}

export async function createEmployee(data: any) {
    // Required fields validation
    if (!data.organizationId) {
        throw new BadRequestError('organizationId is required');
    }
    if (!data.fullName) {
        throw new BadRequestError('fullName is required');
    }

    // FIX: Use consistent status variable to avoid isActive mismatch
    const status = data.status ?? 'Active';

    // REL-011: Use transaction to create employee and auto-create Driver if needed
    return prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({
            data: {
                organizationId: data.organizationId,
                departmentId: data.departmentId || null,
                fullName: data.fullName,
                shortName: data.shortName || null,
                employeeType: data.employeeType || 'driver',
                position: data.position || null,
                status: status,
                phone: data.phone || null,
                address: data.address || null,
                email: data.email || null,
                dateOfBirth: data.dateOfBirth || null,
                personnelNumber: data.personnelNumber || null,
                snils: data.snils || null,
                licenseCategory: data.licenseCategory || null,
                documentNumber: data.documentNumber || null,
                documentExpiry: data.documentExpiry || null,
                medicalCertificateSeries: data.medicalCertificateSeries || null,
                medicalCertificateNumber: data.medicalCertificateNumber || null,
                medicalCertificateIssueDate: data.medicalCertificateIssueDate || null,
                medicalCertificateExpiryDate: data.medicalCertificateExpiryDate || null,
                medicalInstitutionId: data.medicalInstitutionId || null,
                driverCardType: data.driverCardType || null,
                driverCardNumber: data.driverCardNumber || null,
                driverCardStartDate: data.driverCardStartDate || null,
                driverCardExpiryDate: data.driverCardExpiryDate || null,
                fuelCardNumber: data.fuelCardNumber || null,
                fuelCardBalance: data.fuelCardBalance !== undefined ? parseFloat(data.fuelCardBalance) : 0,
                dispatcherId: data.dispatcherId || null,
                controllerId: data.controllerId || null,
                notes: data.notes || null,
                isActive: status === 'Active',  // FIX: Now derived from consistent status variable
            },
        });

        // REL-302: Auto-create Driver record if employeeType is 'driver'
        const employeeType = data.employeeType || 'driver';
        let driverId: string | null = null;
        if (employeeType === 'driver') {
            const driver = await tx.driver.create({
                data: {
                    employeeId: employee.id,
                    licenseNumber: data.documentNumber || `AUTO-${employee.id.slice(0, 8)}`,
                    licenseCategory: data.licenseCategory || 'B',
                    // Safe parse date if string
                    licenseValidTo: data.documentExpiry ? new Date(data.documentExpiry) : null,
                },
            });
            driverId = driver.id;
            console.log(`[REL-302] Auto-created Driver for new employee ${employee.id} (${employee.fullName})`);
        }

        if (data.fuelCardNumber && driverId) {
            const cardNumber = data.fuelCardNumber.trim();
            const normalized = normalizeCardNumber(cardNumber);

            const fuelCard = await tx.fuelCard.findFirst({
                where: {
                    organizationId: data.organizationId,
                    isActive: true, // Only link active cards
                    OR: [
                        { cardNumber: cardNumber },
                        { cardNumber: { contains: normalized } },
                    ],
                },
            });

            if (fuelCard) {
                await tx.fuelCard.update({
                    where: { id: fuelCard.id },
                    data: { assignedToDriverId: driverId },
                });
                console.log(`[FUEL-CARD-LINK] Linked card "${fuelCard.cardNumber}" to new driver ${driverId}`);
            }
        }

        return employee;
    });
}


export async function updateEmployee(id: string, data: any) {
    const employee = await prisma.employee.findUnique({
        where: { id },
    });

    if (!employee) {
        throw new BadRequestError('Employee not found');
    }

    // Prepare update data - only include fields that are present
    const updateData: any = {};

    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.shortName !== undefined) updateData.shortName = data.shortName;
    if (data.employeeType !== undefined) updateData.employeeType = data.employeeType;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.status !== undefined) {
        updateData.status = data.status;
        updateData.isActive = data.status === 'Active';
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.personnelNumber !== undefined) updateData.personnelNumber = data.personnelNumber;
    if (data.snils !== undefined) updateData.snils = data.snils;
    if (data.licenseCategory !== undefined) updateData.licenseCategory = data.licenseCategory;
    if (data.documentNumber !== undefined) updateData.documentNumber = data.documentNumber;
    if (data.documentExpiry !== undefined) updateData.documentExpiry = data.documentExpiry;
    if (data.medicalCertificateSeries !== undefined) updateData.medicalCertificateSeries = data.medicalCertificateSeries;
    if (data.medicalCertificateNumber !== undefined) updateData.medicalCertificateNumber = data.medicalCertificateNumber;
    if (data.medicalCertificateIssueDate !== undefined) updateData.medicalCertificateIssueDate = data.medicalCertificateIssueDate;
    if (data.medicalCertificateExpiryDate !== undefined) updateData.medicalCertificateExpiryDate = data.medicalCertificateExpiryDate;
    if (data.medicalInstitutionId !== undefined) updateData.medicalInstitutionId = data.medicalInstitutionId;
    if (data.driverCardType !== undefined) updateData.driverCardType = data.driverCardType;
    if (data.driverCardNumber !== undefined) updateData.driverCardNumber = data.driverCardNumber;
    if (data.driverCardStartDate !== undefined) updateData.driverCardStartDate = data.driverCardStartDate;
    if (data.driverCardExpiryDate !== undefined) updateData.driverCardExpiryDate = data.driverCardExpiryDate;
    if (data.fuelCardNumber !== undefined) updateData.fuelCardNumber = data.fuelCardNumber;
    if (data.fuelCardBalance !== undefined) updateData.fuelCardBalance = parseFloat(data.fuelCardBalance);
    if (data.dispatcherId !== undefined) updateData.dispatcherId = data.dispatcherId;
    if (data.controllerId !== undefined) updateData.controllerId = data.controllerId;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.organizationId !== undefined) updateData.organizationId = data.organizationId;

    // REL-302: Check if we need to ensure Driver exists for driver-type employees
    const newEmployeeType = data.employeeType || employee.employeeType;
    const isDriverType = newEmployeeType === 'driver';

    return prisma.$transaction(async (tx) => {
        const updatedEmployee = await tx.employee.update({
            where: { id },
            data: updateData,
        });

        // REL-302: Ensure Driver exists for ANY driver-type employee (fixes historical data)
        let driverId: string | null = null;
        if (isDriverType) {
            let existingDriver = await tx.driver.findUnique({
                where: { employeeId: id }
            });

            if (!existingDriver) {
                existingDriver = await tx.driver.create({
                    data: {
                        employeeId: id,
                        licenseNumber: data.documentNumber || employee.documentNumber || `AUTO-${id.slice(0, 8)}`,
                        licenseCategory: data.licenseCategory || employee.licenseCategory || 'B',
                        licenseValidTo: (data.documentExpiry || employee.documentExpiry)
                            ? new Date(data.documentExpiry || employee.documentExpiry)
                            : null,
                    },
                });

                console.log(`[REL-302] Auto-created missing Driver for employee ${id} (${updatedEmployee.fullName})`);
            }
            driverId = existingDriver.id;
        }

        // FUEL-CARD-LINK-AUTO: Auto-link FuelCard when fuelCardNumber is updated
        if (data.fuelCardNumber !== undefined && isDriverType && driverId) {
            const newCardNumber = data.fuelCardNumber?.trim();
            const oldCardNumber = employee.fuelCardNumber?.trim();

            // If card number changed
            if (newCardNumber !== oldCardNumber) {
                // Unlink old card if there was one
                if (oldCardNumber) {
                    await tx.fuelCard.updateMany({
                        where: {
                            cardNumber: oldCardNumber,
                            assignedToDriverId: driverId,
                        },
                        data: {
                            assignedToDriverId: null,
                        },
                    });
                    console.log(`[FUEL-CARD-LINK] Unlinked old card "${oldCardNumber}" from driver ${driverId}`);
                }

                // Link new card if provided
                if (newCardNumber) {
                    const normalized = normalizeCardNumber(newCardNumber);
                    const fuelCard = await tx.fuelCard.findFirst({
                        where: {
                            organizationId: employee.organizationId,
                            isActive: true,
                            OR: [
                                { cardNumber: newCardNumber },
                                { cardNumber: { contains: normalized } },
                            ],
                        },
                    });

                    if (fuelCard) {
                        await tx.fuelCard.update({
                            where: { id: fuelCard.id },
                            data: { assignedToDriverId: driverId },
                        });
                        console.log(`[FUEL-CARD-LINK] Linked card "${fuelCard.cardNumber}" (${fuelCard.id}) to driver ${driverId}`);
                    } else {
                        console.log(`[FUEL-CARD-LINK] FuelCard with number "${newCardNumber}" not found in organization ${employee.organizationId}`);
                    }
                }
            }
        }

        return updatedEmployee;
    });
}


export async function deleteEmployee(id: string): Promise<void> {
    const employee = await prisma.employee.findUnique({
        where: { id },
    });

    if (!employee) {
        throw new BadRequestError('Employee not found');
    }

    // Soft delete - set isActive to false
    await prisma.employee.update({
        where: { id },
        data: { isActive: false },
    });
}

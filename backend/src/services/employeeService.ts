// Employee Service - CRUD operations for employees
import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError } from '../utils/errors';

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
            },
            orderBy: {
                fullName: 'asc',
            },
            skip,
            take: limit,
        }),
        prisma.employee.count({ where }),
    ]);

    return {
        employees,
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

    return prisma.employee.create({
        data: {
            organizationId: data.organizationId,
            departmentId: data.departmentId || null,
            fullName: data.fullName,
            shortName: data.shortName || null,
            employeeType: data.employeeType || 'driver',
            position: data.position || null,
            status: data.status || 'Active',
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
            isActive: data.status === 'Active',
        },
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

    return prisma.employee.update({
        where: { id },
        data: updateData,
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

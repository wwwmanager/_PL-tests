// Employee Entity - Aligned with Frontend Type
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Department } from './Department';

export type EmployeeType = 'driver' | 'dispatcher' | 'controller' | 'accountant' | 'mechanic' | 'reviewer';
export type DriverCardType = 'SKZI' | 'ESTR';

@Entity('employees')
export class Employee {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'uuid', nullable: true })
    departmentId!: string | null;

    // Core fields
    @Column({ type: 'text' })
    fullName!: string;

    @Column({ type: 'text' })
    shortName!: string;

    @Column({ type: 'text' })
    employeeType!: EmployeeType;

    @Column({ type: 'text', nullable: true })
    position!: string | null;

    @Column({ type: 'text', default: 'Active' })
    status!: 'Active' | 'Inactive';

    // Contact information
    @Column({ type: 'text', nullable: true })
    phone!: string | null;

    @Column({ type: 'text', nullable: true })
    address!: string | null;

    @Column({ type: 'text', nullable: true })
    email!: string | null;

    @Column({ type: 'date', nullable: true })
    dateOfBirth!: string | null;

    // Employment details
    @Column({ type: 'text', nullable: true })
    personnelNumber!: string | null;

    @Column({ type: 'text', nullable: true })
    snils!: string | null;

    // Driver license (for drivers)
    @Column({ type: 'text', nullable: true })
    licenseCategory!: string | null;

    @Column({ type: 'text', nullable: true })
    documentNumber!: string | null;

    @Column({ type: 'date', nullable: true })
    documentExpiry!: string | null;

    // Medical certificate
    @Column({ type: 'text', nullable: true })
    medicalCertificateSeries!: string | null;

    @Column({ type: 'text', nullable: true })
    medicalCertificateNumber!: string | null;

    @Column({ type: 'date', nullable: true })
    medicalCertificateIssueDate!: string | null;

    @Column({ type: 'date', nullable: true })
    medicalCertificateExpiryDate!: string | null;

    @Column({ type: 'uuid', nullable: true })
    medicalInstitutionId!: string | null;

    // Driver card (tachograph)
    @Column({ type: 'text', nullable: true })
    driverCardType!: DriverCardType | null;

    @Column({ type: 'text', nullable: true })
    driverCardNumber!: string | null;

    @Column({ type: 'date', nullable: true })
    driverCardStartDate!: string | null;

    @Column({ type: 'date', nullable: true })
    driverCardExpiryDate!: string | null;

    // Fuel card
    @Column({ type: 'text', nullable: true })
    fuelCardNumber!: string | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelCardBalance!: number | null;

    // References to other employees
    @Column({ type: 'uuid', nullable: true })
    dispatcherId!: string | null;

    @Column({ type: 'uuid', nullable: true })
    controllerId!: string | null;

    // Additional
    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @ManyToOne(() => Organization, (o) => o.employees, { onDelete: 'CASCADE' })
    organization!: Organization;

    @ManyToOne(() => Department, (d) => d.employees, { nullable: true, onDelete: 'SET NULL' })
    department!: Department | null;
}

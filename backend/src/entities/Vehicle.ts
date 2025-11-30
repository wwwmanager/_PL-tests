import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn
} from 'typeorm';
import { Organization } from './Organization';
import { Department } from './Department';
import { Waybill } from './Waybill';
import { Employee } from './Employee';

@Entity('vehicles')
export class Vehicle {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'uuid', nullable: true })
    departmentId!: string | null;

    @Column({ type: 'text', nullable: true })
    code!: string | null;

    // Frontend uses plateNumber, backend used registrationNumber.
    // We'll use plateNumber to match frontend types.
    @Column({ type: 'text', name: 'plate_number' })
    plateNumber!: string;

    @Column({ type: 'text', nullable: true })
    brand!: string | null;

    @Column({ type: 'text', nullable: true })
    model!: string | null;

    @Column({ type: 'text', nullable: true })
    vin!: string | null;

    @Column({ type: 'text', nullable: true })
    fuelTypeId!: string | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelTankCapacity!: string | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    currentFuel!: number | null;

    @Column({ type: 'int', nullable: true })
    mileage!: number | null;

    @Column({ type: 'jsonb', nullable: true })
    fuelConsumptionRates!: {
        summerRate: number;
        winterRate: number;
        cityIncreasePercent?: number;
        warmingIncreasePercent?: number;
    } | null;

    @Column({ type: 'int', nullable: true })
    year!: number | null;

    @Column({ type: 'text', nullable: true })
    vehicleType!: string | null;

    @Column({ type: 'text', default: 'Active' })
    status!: string;

    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    // PTS / EPTS
    @Column({ type: 'text', nullable: true })
    ptsType!: 'PTS' | 'EPTS' | null;

    @Column({ type: 'text', nullable: true })
    ptsSeries!: string | null;

    @Column({ type: 'text', nullable: true })
    ptsNumber!: string | null;

    @Column({ type: 'text', nullable: true })
    eptsNumber!: string | null;

    // Diagnostic Card
    @Column({ type: 'text', nullable: true })
    diagnosticCardNumber!: string | null;

    @Column({ type: 'date', nullable: true })
    diagnosticCardIssueDate!: string | null;

    @Column({ type: 'date', nullable: true })
    diagnosticCardExpiryDate!: string | null;

    // OSAGO
    @Column({ type: 'text', nullable: true })
    osagoSeries!: string | null;

    @Column({ type: 'text', nullable: true })
    osagoNumber!: string | null;

    @Column({ type: 'date', nullable: true })
    osagoStartDate!: string | null;

    @Column({ type: 'date', nullable: true })
    osagoEndDate!: string | null;

    // Modifiers
    @Column({ type: 'boolean', default: false })
    useCityModifier!: boolean;

    @Column({ type: 'boolean', default: false })
    useWarmingModifier!: boolean;

    @Column({ type: 'boolean', default: false })
    disableFuelCapacityCheck!: boolean;

    @Column({ type: 'uuid', nullable: true })
    assignedDriverId!: string | null;

    @Column({ type: 'uuid', nullable: true })
    storageLocationId!: string | null;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @ManyToOne(() => Organization, (o) => o.vehicles, { onDelete: 'RESTRICT' })
    organization!: Organization;

    @ManyToOne(() => Department, (d) => d.vehicles, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    department!: Department | null;

    @ManyToOne(() => Employee, { nullable: true })
    @JoinColumn({ name: 'assignedDriverId' })
    assignedDriver!: Employee | null;

    @OneToMany(() => Waybill, (w) => w.vehicle)
    waybills!: Waybill[];
}

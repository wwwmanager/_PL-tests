// Waybill Entity - Aligned with Frontend Type
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Department } from './Department';
import { Vehicle } from './Vehicle';
import { Employee } from './Employee';
import { User } from './User';
import { WaybillRoute } from './WaybillRoute';
import { WaybillFuel } from './WaybillFuel';
import { WaybillStatus } from './enums';

@Entity('waybills')
export class Waybill {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'uuid', nullable: true })
    departmentId!: string | null;

    @Column({ type: 'text' })
    number!: string;

    // Blank info
    @Column({ type: 'uuid', nullable: true })
    blankId!: string | null;

    @Column({ type: 'text', nullable: true })
    blankSeries!: string | null;

    @Column({ type: 'int', nullable: true })
    blankNumber!: number | null;

    @Column({ type: 'timestamptz', nullable: true })
    reservedAt!: Date | null;

    @Column({ type: 'date' })
    date!: string;

    @Column({ type: 'timestamptz', nullable: true })
    validFrom!: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    validTo!: Date | null;

    @Column({ type: 'uuid' })
    vehicleId!: string;

    @Column({ type: 'uuid' })
    driverId!: string;

    @Column({ type: 'uuid', nullable: true })
    dispatcherId!: string | null;

    @Column({ type: 'uuid', nullable: true })
    controllerId!: string | null;

    @Column({
        type: 'enum',
        enum: WaybillStatus,
        default: WaybillStatus.DRAFT,
    })
    status!: WaybillStatus;

    // Odometer
    @Column({ type: 'numeric', precision: 10, scale: 1, nullable: true })
    odometerStart!: number | null;

    @Column({ type: 'numeric', precision: 10, scale: 1, nullable: true })
    odometerEnd!: number | null;

    // Fuel
    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelPlanned!: number | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelAtStart!: number | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelFilled!: number | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelAtEnd!: number | null;

    @Column({ type: 'text', nullable: true })
    plannedRoute!: string | null;

    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    @Column({ type: 'text', nullable: true })
    reviewerComment!: string | null;

    @Column({ type: 'text', nullable: true })
    deviationReason!: string | null;

    // Audit
    @Column({ type: 'uuid', nullable: true })
    createdByUserId!: string | null;

    @Column({ type: 'uuid', nullable: true })
    submittedBy!: string | null;

    @Column({ type: 'uuid', nullable: true })
    approvedByUserId!: string | null;

    @Column({ type: 'uuid', nullable: true })
    postedBy!: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    postedAt!: Date | null;

    @Column({ type: 'uuid', nullable: true })
    cancelledBy!: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    cancelledAt!: Date | null;

    @Column({ type: 'uuid', nullable: true })
    completedByUserId!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @ManyToOne(() => Organization, (o) => o.waybills, { onDelete: 'RESTRICT' })
    organization!: Organization;

    @ManyToOne(() => Department, (d) => d.waybills, {
        nullable: true,
        onDelete: 'RESTRICT',
    })
    department!: Department | null;

    @ManyToOne(() => Vehicle, (v) => v.waybills, { onDelete: 'RESTRICT' })
    vehicle!: Vehicle;

    @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
    driver!: Employee;

    @ManyToOne(() => Employee, { nullable: true })
    dispatcher!: Employee | null;

    @ManyToOne(() => Employee, { nullable: true })
    controller!: Employee | null;

    @ManyToOne(() => User, (u) => u.createdWaybills, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    createdByUser!: User | null;

    @ManyToOne(() => User, (u) => u.approvedWaybills, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    approvedByUser!: User | null;

    @ManyToOne(() => User, (u) => u.completedWaybills, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    completedByUser!: User | null;

    @OneToMany(() => WaybillRoute, (r) => r.waybill)
    routes!: WaybillRoute[];

    @OneToMany(() => WaybillFuel, (f) => f.waybill)
    fuelLines!: WaybillFuel[];
}

// Waybill Entity
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Department } from './Department';
import { Vehicle } from './Vehicle';
import { Driver } from './Driver';
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

    @Column({ type: 'date' })
    date!: string;

    @Column({ type: 'uuid' })
    vehicleId!: string;

    @Column({ type: 'uuid' })
    driverId!: string;

    @Column({ type: 'uuid', nullable: true })
    blankId!: string | null;

    @Column({
        type: 'enum',
        enum: WaybillStatus,
        default: WaybillStatus.DRAFT,
    })
    status!: WaybillStatus;

    @Column({ type: 'numeric', precision: 10, scale: 1, nullable: true })
    odometerStart!: string | null;

    @Column({ type: 'numeric', precision: 10, scale: 1, nullable: true })
    odometerEnd!: string | null;

    @Column({ type: 'text', nullable: true })
    plannedRoute!: string | null;

    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    @Column({ type: 'uuid', nullable: true })
    createdByUserId!: string | null;

    @Column({ type: 'uuid', nullable: true })
    approvedByUserId!: string | null;

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

    @ManyToOne(() => Driver, (d) => d.waybills, { onDelete: 'RESTRICT' })
    driver!: Driver;

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

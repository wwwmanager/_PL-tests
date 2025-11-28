// Vehicle Entity
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Department } from './Department';
import { Waybill } from './Waybill';

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

    @Column({ type: 'text' })
    registrationNumber!: string;

    @Column({ type: 'text', nullable: true })
    brand!: string | null;

    @Column({ type: 'text', nullable: true })
    model!: string | null;

    @Column({ type: 'text', nullable: true })
    vin!: string | null;

    @Column({ type: 'text', nullable: true })
    fuelType!: string | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelTankCapacity!: string | null;

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

    @OneToMany(() => Waybill, (w) => w.vehicle)
    waybills!: Waybill[];
}

// User Entity
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Department } from './Department';
import { Waybill } from './Waybill';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'uuid', nullable: true })
    departmentId!: string | null;

    @Column({ type: 'text', unique: true })
    email!: string;

    @Column({ type: 'text' })
    passwordHash!: string;

    @Column({ type: 'text' })
    fullName!: string;

    @Column({ type: 'text', default: 'user' })
    role!: string;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @ManyToOne(() => Organization, (o) => o.users, { onDelete: 'CASCADE' })
    organization!: Organization;

    @ManyToOne(() => Department, (d) => d.users, { nullable: true, onDelete: 'SET NULL' })
    department!: Department | null;

    @OneToMany(() => Waybill, (w) => w.createdByUser)
    createdWaybills!: Waybill[];

    @OneToMany(() => Waybill, (w) => w.approvedByUser)
    approvedWaybills!: Waybill[];

    @OneToMany(() => Waybill, (w) => w.completedByUser)
    completedWaybills!: Waybill[];
}

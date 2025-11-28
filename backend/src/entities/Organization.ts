// Organization Entity
import {
    Entity, PrimaryGeneratedColumn, Column,
    OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Department } from './Department';
import { User } from './User';
import { Employee } from './Employee';
import { Vehicle } from './Vehicle';
import { Waybill } from './Waybill';

@Entity('organizations')
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'text' })
    name!: string;

    @Column({ type: 'varchar', length: 12, nullable: true })
    inn!: string | null;

    @Column({ type: 'varchar', length: 9, nullable: true })
    kpp!: string | null;

    @Column({ type: 'text', nullable: true })
    address!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @OneToMany(() => Department, (d) => d.organization)
    departments!: Department[];

    @OneToMany(() => User, (u) => u.organization)
    users!: User[];

    @OneToMany(() => Employee, (e) => e.organization)
    employees!: Employee[];

    @OneToMany(() => Vehicle, (v) => v.organization)
    vehicles!: Vehicle[];

    @OneToMany(() => Waybill, (w) => w.organization)
    waybills!: Waybill[];
}

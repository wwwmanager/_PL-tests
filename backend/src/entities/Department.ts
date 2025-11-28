// Department Entity
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';
import { Employee } from './Employee';
import { Vehicle } from './Vehicle';
import { Waybill } from './Waybill';

@Entity('departments')
export class Department {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'text', nullable: true })
    code!: string | null;

    @Column({ type: 'text' })
    name!: string;

    @Column({ type: 'text', nullable: true })
    address!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @ManyToOne(() => Organization, (o) => o.departments, { onDelete: 'CASCADE' })
    organization!: Organization;

    @OneToMany(() => User, (u) => u.department)
    users!: User[];

    @OneToMany(() => Employee, (e) => e.department)
    employees!: Employee[];

    @OneToMany(() => Vehicle, (v) => v.department)
    vehicles!: Vehicle[];

    @OneToMany(() => Waybill, (w) => w.department)
    waybills!: Waybill[];
}

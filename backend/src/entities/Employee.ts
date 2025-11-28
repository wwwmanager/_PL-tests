// Employee Entity
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToOne, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Department } from './Department';
import { Driver } from './Driver';

@Entity('employees')
export class Employee {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'uuid', nullable: true })
    departmentId!: string | null;

    @Column({ type: 'text' })
    fullName!: string;

    @Column({ type: 'text', nullable: true })
    position!: string | null;

    @Column({ type: 'text', nullable: true })
    phone!: string | null;

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

    @OneToOne(() => Driver, (d) => d.employee)
    driver!: Driver | null;
}

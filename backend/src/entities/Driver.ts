// Driver Entity
import {
    Entity, PrimaryGeneratedColumn, Column,
    OneToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Employee } from './Employee';
import { Waybill } from './Waybill';

@Entity('drivers')
export class Driver {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid', unique: true })
    employeeId!: string;

    @Column({ type: 'text' })
    licenseNumber!: string;

    @Column({ type: 'text', nullable: true })
    licenseCategory!: string | null;

    @Column({ type: 'date', nullable: true })
    licenseValidTo!: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @OneToOne(() => Employee, (e) => e.driver, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'employeeId' })
    employee!: Employee;

    @OneToMany(() => Waybill, (w) => w.driver)
    waybills!: Waybill[];
}

// Blank Entity - БСО (бланки строгой отчётности)
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToOne, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Organization } from './Organization';
import { Employee } from './Employee';
import { Waybill } from './Waybill';
import { BlankStatus } from './enums';

@Entity('blanks')
@Index(['series', 'number'], { unique: true })
export class Blank {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'text' })
    series!: string;

    @Column({ type: 'text' })
    number!: string;

    @Column({
        type: 'enum',
        enum: BlankStatus,
        default: BlankStatus.AVAILABLE,
    })
    status!: BlankStatus;

    @Column({ type: 'uuid', nullable: true })
    issuedToId!: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    issuedAt!: Date | null;

    @Column({ type: 'uuid', nullable: true })
    usedInWaybillId!: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    usedAt!: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    returnedAt!: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    organization!: Organization;

    @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
    issuedTo!: Employee | null;

    @OneToOne(() => Waybill, { nullable: true, onDelete: 'SET NULL' })
    usedInWaybill!: Waybill | null;
}

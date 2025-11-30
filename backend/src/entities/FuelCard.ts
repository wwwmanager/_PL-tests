// FuelCard Entity - Fuel card management
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Organization } from './Organization';
import { Vehicle } from './Vehicle';

@Entity('fuel_cards')
export class FuelCard {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'text', unique: true })
    @Index()
    cardNumber!: string;

    @Column({ type: 'text' })
    holderType!: string; // 'vehicle' | 'organization'

    @Column({ type: 'uuid', nullable: true })
    holderId!: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    balance!: number; // liters

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    organization!: Organization;

    @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
    holder!: Vehicle | null;
}

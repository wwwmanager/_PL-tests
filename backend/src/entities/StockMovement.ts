// StockMovement Entity - Stock operations tracking
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, CreateDateColumn, Index,
} from 'typeorm';
import { StockItem } from './StockItem';
import { Waybill } from './Waybill';
import { User } from './User';
import { StockMovementType } from './enums';

@Entity('stock_movements')
export class StockMovement {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    @Index()
    stockItemId!: string;

    @Column({
        type: 'enum',
        enum: StockMovementType,
    })
    type!: StockMovementType; // INCOME, EXPENSE, ADJUSTMENT

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    quantity!: number; // can be negative for EXPENSE

    @Column({ type: 'uuid', nullable: true })
    @Index()
    waybillId!: string | null;

    @Column({ type: 'uuid' })
    userId!: string;

    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    @Index()
    createdAt!: Date;

    // Relations
    @ManyToOne(() => StockItem, (si) => si.movements, { onDelete: 'CASCADE' })
    stockItem!: StockItem;

    @ManyToOne(() => Waybill, { nullable: true, onDelete: 'SET NULL' })
    waybill!: Waybill | null;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user!: User;
}

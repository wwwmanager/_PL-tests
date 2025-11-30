// StockItem Entity - Warehouse/garage inventory items
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Organization } from './Organization';

@Entity('stock_items')
export class StockItem {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    @Index()
    organizationId!: string;

    @Column({ type: 'text' })
    @Index()
    code!: string; // артикул

    @Column({ type: 'text' })
    name!: string;

    @Column({ type: 'text' })
    category!: string; // 'fuel', 'parts', 'consumables', etc.

    @Column({ type: 'text' })
    unit!: string; // 'л', 'шт', 'кг'

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    currentQuantity!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    minQuantity!: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    price!: number | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;

    // Relations
    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    organization!: Organization;

    @OneToMany('StockMovement', 'stockItem')
    movements!: any[];
}

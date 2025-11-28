// WaybillFuel Entity
import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne,
} from 'typeorm';
import { Waybill } from './Waybill';

@Entity('waybill_fuel')
export class WaybillFuel {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    waybillId!: string;

    @Column({ type: 'uuid' })
    stockItemId!: string;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelStart!: string | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelReceived!: string | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelConsumed!: string | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    fuelEnd!: string | null;

    @Column({ type: 'text', nullable: true })
    comment!: string | null;

    // Relations
    @ManyToOne(() => Waybill, (w) => w.fuelLines, { onDelete: 'CASCADE' })
    waybill!: Waybill;

    // Note: stockItem relation will be added when StockItem entity is created
}

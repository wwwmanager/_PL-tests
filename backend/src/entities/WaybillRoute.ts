// WaybillRoute Entity
import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne,
} from 'typeorm';
import { Waybill } from './Waybill';

@Entity('waybill_routes')
export class WaybillRoute {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    waybillId!: string;

    @Column({ type: 'int' })
    legOrder!: number;

    @Column({ type: 'text', nullable: true })
    fromPoint!: string | null;

    @Column({ type: 'text', nullable: true })
    toPoint!: string | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    distanceKm!: string | null;

    @Column({ type: 'text', nullable: true })
    plannedTime!: string | null;

    @Column({ type: 'text', nullable: true })
    actualTime!: string | null;

    @Column({ type: 'text', nullable: true })
    comment!: string | null;

    // Relations
    @ManyToOne(() => Waybill, (w) => w.routes, { onDelete: 'CASCADE' })
    waybill!: Waybill;
}

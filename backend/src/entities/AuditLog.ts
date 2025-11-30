// AuditLog Entity - Comprehensive audit trail for all user actions
import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, CreateDateColumn,
} from 'typeorm';
import { User } from './User';
import { AuditActionType } from './enums';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    userId!: string;

    @Column({
        type: 'enum',
        enum: AuditActionType,
    })
    action!: AuditActionType;

    @Column({ type: 'text' })
    entityType!: string;

    @Column({ type: 'uuid', nullable: true })
    entityId!: string | null;

    // JSONB field for storing before/after changes
    @Column({ type: 'jsonb', nullable: true })
    changes!: Record<string, any> | null;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress!: string | null;

    @Column({ type: 'text', nullable: true })
    userAgent!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user!: User;
}

import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateAuditLog1732896300000 implements MigrationInterface {
    name = 'CreateAuditLog1732896300000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create audit_logs table
        await queryRunner.createTable(new Table({
            name: 'audit_logs',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'userId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'action',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'entityType',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'entityId',
                    type: 'uuid',
                    isNullable: true,
                },
                {
                    name: 'changes',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'ipAddress',
                    type: 'varchar',
                    length: '45',
                    isNullable: true,
                },
                {
                    name: 'userAgent',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamptz',
                    default: 'now()',
                    isNullable: false,
                },
            ],
        }), true);

        // Create foreign key to users table
        await queryRunner.createForeignKey('audit_logs', new TableForeignKey({
            columnNames: ['userId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE',
        }));

        // Create indexes for performance
        await queryRunner.createIndex('audit_logs', new TableIndex({
            name: 'IDX_audit_logs_user_id',
            columnNames: ['userId'],
        }));

        await queryRunner.createIndex('audit_logs', new TableIndex({
            name: 'IDX_audit_logs_entity',
            columnNames: ['entityType', 'entityId'],
        }));

        await queryRunner.createIndex('audit_logs', new TableIndex({
            name: 'IDX_audit_logs_created_at',
            columnNames: ['createdAt'],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_created_at');
        await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_entity');
        await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_user_id');

        // Drop table (foreign key will be dropped automatically)
        await queryRunner.dropTable('audit_logs');
    }
}

// TypeORM DataSource configuration
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../config/env';

// Import entities (will be added incrementally)
import { Organization } from '../entities/Organization';
import { Department } from '../entities/Department';
// import { User } from '../entities/User'; // DISABLED: Using Prisma for User
import { Employee } from '../entities/Employee';
import { Vehicle } from '../entities/Vehicle';
import { Waybill } from '../entities/Waybill';
import { WaybillRoute } from '../entities/WaybillRoute';
import { WaybillFuel } from '../entities/WaybillFuel';
import { AuditLog } from '../entities/AuditLog';
import { Blank } from '../entities/Blank';
import { FuelCard } from '../entities/FuelCard';
import { StockItem } from '../entities/StockItem';
import { StockMovement } from '../entities/StockMovement';

// TODO: Add remaining entities as they are created
// import { Role } from '../entities/Role';
// import { Permission } from '../entities/Permission';
// import { UserRole } from '../entities/UserRole';
// import { RolePermission } from '../entities/RolePermission';
// import { FuelCard } from '../entities/FuelCard';
// import { StockItem } from '../entities/StockItem';
// import { Warehouse } from '../entities/Warehouse';
// import { StockMovement } from '../entities/StockMovement';
// import { BlankBatch } from '../entities/BlankBatch';
// import { Blank } from '../entities/Blank';
// import { AuditLog } from '../entities/AuditLog';
// import { RefreshToken } from '../entities/RefreshToken';

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: env.DATABASE_URL,

    // Entities list
    entities: [
        Organization,
        Department,
        // User, // DISABLED: Using Prisma for User authentication
        Employee,
        Vehicle,
        Waybill,
        WaybillRoute,
        WaybillFuel,
        AuditLog,
        Blank,
        FuelCard,
        StockItem,
        StockMovement,
    ],

    // Migrations
    migrations: ['src/db/migrations/**/*.ts'],
    migrationsTableName: 'migrations',

    // Development mode: use migrations instead of auto-sync
    // NOTE: synchronize=true auto-creates/updates tables but is NOT safe for production
    // For production, always use migrations
    // DISABLED: We use Prisma for schema management now
    synchronize: false,  // Disabled to avoid conflicts with Prisma migrations

    // Logging
    logging: true,  // Enabled for debugging
});

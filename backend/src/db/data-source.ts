// TypeORM DataSource configuration
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../config/env';

// Import entities (will be added incrementally)
import { Organization } from '../entities/Organization';
import { Department } from '../entities/Department';
import { User } from '../entities/User';
import { Employee } from '../entities/Employee';
import { Driver } from '../entities/Driver';
import { Vehicle } from '../entities/Vehicle';
import { Waybill } from '../entities/Waybill';
import { WaybillRoute } from '../entities/WaybillRoute';
import { WaybillFuel } from '../entities/WaybillFuel';

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
        User,
        Employee,
        Driver,
        Vehicle,
        Waybill,
        WaybillRoute,
        WaybillFuel,
    ],

    // Development mode: auto-create tables
    synchronize: true,  // TODO: Set to false in production

    // Logging
    logging: false,  // Set to true for debugging
});

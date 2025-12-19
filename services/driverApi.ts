/**
 * Driver API Facade
 * 
 * Uses real backend API for all driver operations.
 */

import * as realDriverApi from './api/driverApi';
export type { DriverListItem } from './api/driverApi';

export const listDrivers = realDriverApi.listDrivers;
export const getDriverById = realDriverApi.getDriverById;

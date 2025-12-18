/**
 * Vehicle API Facade
 * 
 * Uses real backend API for all vehicle operations.
 * Driver Mode with mockApi has been removed.
 */

import { Vehicle } from '../types';
import * as realVehicleApi from './api/vehicleApi';

// Re-export all functions from realVehicleApi
export const getVehicles = realVehicleApi.getVehicles;
export const getVehicleById = realVehicleApi.getVehicleById;
export const createVehicle = realVehicleApi.createVehicle;
export const updateVehicle = realVehicleApi.updateVehicle;
export const deleteVehicle = realVehicleApi.deleteVehicle;

// Новые режимы приложения
export type AppMode = 'driver' | 'central';

export type Role =
  | 'admin'
  | 'dispatcher'
  | 'auditor'
  | 'driver'
  | 'mechanic'
  | 'reviewer'
  | 'accountant'
  | 'viewer';

export type Capability =
  | 'waybill.create'
  | 'waybill.submit'
  | 'waybill.post'
  | 'waybill.cancel'
  | 'waybill.backdate'
  | 'waybill.correct'
  | 'blanks.issue'
  | 'blanks.return'
  | 'blanks.spoil.self'
  | 'blanks.spoil.warehouse'
  | 'blanks.spoil.override'
  | 'rbac.delegate'
  | 'audit.business.read'
  | 'stock.read'
  | 'stock.manage'
  // существующие:
  | 'admin.panel'
  | 'import.run'
  | 'import.limited'
  | 'export.run'
  | 'audit.read'
  | 'audit.diff'
  | 'audit.rollback'
  | 'audit.delete';

export type User = {
  id: string;
  displayName: string;
  email?: string;
  role: Role;
  extraCaps?: Capability[];
};

export type View =
  | 'DASHBOARD'
  | 'WAYBILLS'
  | 'DICTIONARIES'
  | 'WAREHOUSE'
  | 'REPORTS'
  | 'ADMIN'
  | 'ABOUT'
  | 'USER_GUIDE'
  | 'ADMIN_GUIDE'
  | 'DEVELOPER_GUIDE'
  | 'BLANKS'
  | 'TESTING_GUIDE'
  | 'BUSINESS_LOGIC_GUIDE'
  | 'CAPABILITIES_GUIDE'
  | 'SYSTEM_DICTIONARIES_GUIDE';

export type DictionaryType =
  | 'fuelTypes'
  | 'organizations'
  | 'vehicles'
  | 'employees'
  | 'routes'
  | 'garageStockItems'
  | 'stockTransactions'
  | 'storageLocations';

// Расширяем статусы ПЛ, добавляем обратную совместимость
export enum WaybillStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted',
  POSTED = 'Posted', // Проведено
  CANCELLED = 'Cancelled',
  // совместимость со старым кодом (строка будет 'Posted'):
  COMPLETED = 'Posted',
}

export type FuelCalculationMethod = 'BOILER' | 'SEGMENTS' | 'MIXED';

export interface Route {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  isCityDriving?: boolean;
  isWarming?: boolean;
  date?: string;
  notes?: string;
}

export interface SavedRoute {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
  content: string; // Base64 mock content
  userId: string; // Uploader ID
}

// Добавляем нормализованные серия/номер и служебные поля аудита статусов
export interface Waybill {
  id: string;
  number?: string; // оставляем для печати и совместимости

  // НОВОЕ: нормализованный номер
  blankId?: string | null;
  blankSeries?: string | null;
  blankNumber?: number | null;
  reservedAt?: string | null;

  date: string;
  vehicleId: string;
  driverId: string;
  status: WaybillStatus;

  // НОВОЕ: штампы и «кто сделал»
  createdAt?: string;
  updatedAt?: string;
  submittedBy?: string;
  postedBy?: string;
  postedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;

  odometerStart: number;
  odometerEnd?: number;
  fuelPlanned?: number;
  fuelAtStart?: number;
  fuelFilled?: number;
  fuelAtEnd?: number;
  routes: Route[];
  organizationId: string;
  dispatcherId: string;
  controllerId?: string;
  validFrom: string;
  validTo: string;
  attachments?: Attachment[];
  reviewerComment?: string;
  deviationReason?: string;
  linkedStockTransactionIds?: string[];
  notes?: string;
  fuelCalculationMethod?: FuelCalculationMethod; // НОВОЕ WB-1001
}

export interface FuelConsumptionRates {
  summerRate: number;
  winterRate: number;
  cityIncreasePercent?: number;
  warmingIncreasePercent?: number;
}

export enum VehicleStatus {
  ACTIVE = 'Active',
  ARCHIVED = 'Archived',
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  workType: string;
  mileage: number;
  description?: string;
  performer?: string;
  cost?: number;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;  // Changed from plateNumber to match backend
  brand: string;
  vin: string;
  mileage: number;
  /** @deprecated Use fuelStockItemId instead. */
  fuelTypeId: string;
  fuelStockItemId?: string | null;
  fuelConsumptionRates: FuelConsumptionRates;
  assignedDriverId: string | null;
  organizationId: string | null;
  currentFuel?: number;
  year?: number;
  vehicleType?: 'Легковой' | 'Тягач' | 'Прицеп' | 'Автобус' | 'Спецтехника';
  status: VehicleStatus;
  notes?: string;
  ptsType?: 'PTS' | 'EPTS';
  ptsSeries?: string;
  ptsNumber?: string;
  eptsNumber?: string;
  diagnosticCardNumber?: string;
  diagnosticCardIssueDate?: string;
  diagnosticCardExpiryDate?: string;
  maintenanceHistory?: MaintenanceRecord[];
  useCityModifier?: boolean;
  useWarmingModifier?: boolean;
  fuelTankCapacity?: number;
  disableFuelCapacityCheck?: boolean;
  osagoSeries?: string;
  osagoNumber?: string;
  osagoStartDate?: string;
  osagoEndDate?: string;
  storageLocationId?: string;
}

// Расширяем тип сотрудника
export type EmployeeType =
  | 'driver'
  | 'dispatcher'
  | 'controller'
  | 'accountant'
  | 'mechanic' // НОВОЕ
  | 'reviewer'; // НОВОЕ

export type DriverCardType = 'SKZI' | 'ESTR';

export const EMPLOYEE_TYPE_TRANSLATIONS: { [key in EmployeeType]: string } = {
  driver: 'Водитель',
  dispatcher: 'Диспетчер',
  controller: 'Контролер',
  accountant: 'Бухгалтер',
  mechanic: 'Механик (Кладовщик)', // НОВОЕ
  reviewer: 'Проверяющий', // НОВОЕ
};

export interface Employee {
  id: string;
  fullName: string;
  shortName: string;
  employeeType: EmployeeType;
  position?: string;
  organizationId: string | null;
  status: 'Active' | 'Inactive';
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  notes?: string;
  licenseCategory?: string;
  documentNumber?: string;
  documentExpiry?: string;
  snils?: string;
  personnelNumber?: string;
  fuelCardNumber?: string;
  fuelCardBalance?: number;
  medicalCertificateSeries?: string;
  medicalCertificateNumber?: string;
  medicalCertificateIssueDate?: string;
  medicalCertificateExpiryDate?: string;
  dispatcherId?: string;
  controllerId?: string;
  medicalInstitutionId?: string;
  driverCardType?: DriverCardType;
  driverCardNumber?: string;
  driverCardStartDate?: string;
  driverCardExpiryDate?: string;
  /** @deprecated For migration only. Use WaybillBlankBatch/WaybillBlank entities instead. */
  blankBatches?: { id: string; series: string; startNumber: string; endNumber: string }[];
  /** @deprecated For migration only. Use WaybillBlank entities instead. */
  spoiledBlanks?: { series: string; number: string }[];
  email?: string;
}

export enum OrganizationStatus {
  ACTIVE = 'Active',
  ARCHIVED = 'Archived',
  LIQUIDATED = 'Liquidated',
}

/** @deprecated Use StockItem with category='FUEL' instead */
export interface FuelType {
  id: string;
  name: string;
  code: string;
  density: number;
  unit?: string;
  notes?: string;
}

export interface Organization {
  id: string;
  fullName: string;
  shortName: string;
  address?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  registrationDate?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  bankAccount?: string;
  bankName?: string;
  bankBik?: string;
  correspondentAccount?: string;
  accountCurrency?: string;
  paymentPurpose?: string;
  status: OrganizationStatus;
  group?: string;
  notes?: string;
  medicalLicenseNumber?: string;
  medicalLicenseIssueDate?: string;
  storageIds?: string[];
}

export type SeasonSettings =
  | {
    type: 'recurring';
    summerDay: number;
    summerMonth: number;
    winterDay: number;
    winterMonth: number;
  }
  | {
    type: 'manual';
    winterStartDate: string;
    winterEndDate: string;
  };

export interface PrintPositions {
  [key: string]: { x: number; y: number };
}

export interface KpiData {
  // Обновленная структура для Dashboard
  mileageMonth: number;
  mileageQuarter: number;
  mileageYear: number;

  fuelMonth: number;
  fuelQuarter: number;
  fuelYear: number;

  totalFuelBalance: number; // Остаток в баке (или суммарный)
  issues: number;
}

// Расширяем настройки приложения (режимы и бланки)
export interface AppSettings {
  isParserEnabled: boolean;
  enableWarehouseAccounting?: boolean;
  defaultStorageType?: StorageType;
  appMode?: AppMode; // 'driver' | 'central' (по умолчанию — 'driver')
  blanks?: {
    driverCanAddBatches: boolean;
  };
}

export type StorageType =
  | 'centralWarehouse'
  | 'remoteWarehouse'
  | 'vehicleTank'
  | 'contractorWarehouse';

/**
 * Storage location for warehouse management
 */
export interface Storage {
  id: string;
  organizationId: string;
  type: StorageType;
  name: string;
  description?: string;
  address?: string;
  responsiblePerson?: string;
  fuelType?: string;
  capacityLiters?: number;
  currentLevelLiters?: number;
  safetyStockLiters?: number;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
}

export type StockItemGroup = 'ГСМ' | 'Запчасти' | 'Шины' | 'Прочее';

export type StockItemKind = 'Товар' | 'Услуга';

export type StockExpenseReason =
  | 'waybill'
  | 'maintenance'
  | 'writeOff'
  | 'fuelCardTopUp'
  | 'inventoryAdjustment'
  | 'other';

export type StockTransactionType = 'income' | 'expense';

export interface GarageStockItem {
  id: string;
  name: string;
  itemType: StockItemKind;
  group: StockItemGroup;
  unit: string;
  balance: number;
  reserved?: number;
  incoming?: number;
  reorderPoint?: number;
  minBalance?: number;
  maxBalance?: number;
  averagePrice?: number;
  lastPurchasePrice?: number;
  lastInventoryDate?: string;
  lastTransactionDate?: string;
  code?: string;
  storageType: StorageType;
  storageLocation?: string;
  storageRack?: string;
  balanceAccount?: string;
  budgetCode?: string;
  notes?: string;
  categoryEnum?: 'FUEL' | 'TIRES' | 'PARTS' | 'OTHER';
  /** @deprecated Use categoryEnum='FUEL' */
  fuelTypeId?: string;
  density?: number;
  isActive: boolean;
  organizationId?: string;
  responsibleEmployeeId?: string;
  manufacturer?: string;
  expirationDate?: string;
  metadata?: Record<string, unknown>;
}

export interface StockTransactionItem {
  stockItemId: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalAmount?: number;
  serialNumber?: string;
  notes?: string;
  vehicleId?: string;
}

export interface StockTransaction {
  id: string;
  docNumber: string;
  date: string;
  type: StockTransactionType;
  items: StockTransactionItem[];
  expenseReason?: StockExpenseReason;
  vehicleId?: string;
  driverId?: string;
  issuedForEmployeeId?: string;
  isFuelCardTopUp?: boolean;
  supplier?: string;
  supplierOrganizationId?: string;
  recipientOrganizationId?: string;
  sourceStorageId?: string;
  targetStorageId?: string;
  notes?: string;
  waybillId?: string | null;
  createdByUserId?: string;
  approvedByUserId?: string;
  attachments?: Attachment[];
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  organizationId: string;
}

// --- Новые сущности для учета бланков ---

export type BlankStatus = 'available' | 'issued' | 'reserved' | 'used' | 'returned' | 'spoiled';
export type SpoilReasonCode = 'damaged' | 'misprint' | 'lost' | 'other';

export interface WaybillBlankBatch {
  id: string;
  organizationId: string;
  series: string;          // "ЧБ" (нормализуем: trim + upper)
  startNumber: number;     // 1
  endNumber: number;       // 30
  status: 'active' | 'returned' | 'closed';
  notes?: string;
}

export interface WaybillBlank {
  id: string;
  organizationId: string;
  batchId: string;
  series: string;      // UPPERCASE
  number: number;      // int
  status: BlankStatus;
  ownerEmployeeId: string | null;

  // ссылки/резерв/использование
  usedInWaybillId?: string | null;
  usedAt?: string | null;
  reservedAt?: string | null;
  reservedUntil?: string | null;
  reservedByDeviceId?: string | null;
  reservedByTabId?: string | null;
  reservedByWaybillId?: string | null;

  // списание
  spoiledAt?: string | null;
  spoiledBy?: string | null;
  spoilReasonCode?: SpoilReasonCode | null;
  spoilReasonNote?: string | null;

  // служебные
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'holiday' | 'workday' | 'short';
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Stock location from backend
 */
export interface StockLocation {
  id: string;
  organizationId: string;
  type: 'WAREHOUSE' | 'FUEL_CARD' | 'VEHICLE_TANK';
  name: string;
  warehouseId?: string;
  fuelCardId?: string;
  vehicleId?: string;
}

/**
 * Balance at a specific date
 */
export interface LocationBalance {
  locationId: string;
  locationName: string;
  locationType: string;
  stockItemId: string;
  stockItemName: string;
  balance: number;
  unit: string;
}

/**
 * Movement from backend with full details
 */
export interface StockMovementV2 {
  id: string;
  movementType: 'INCOME' | 'EXPENSE' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  stockItemId: string;
  stockItemName?: string;
  stockLocationId?: string;
  stockLocationName?: string;
  fromStockLocationId?: string;
  fromStockLocationName?: string;
  toStockLocationId?: string;
  toStockLocationName?: string;
  occurredAt: string;
  createdAt: string;
  documentType?: string;
  documentId?: string;
  externalRef?: string;
  comment?: string;
}

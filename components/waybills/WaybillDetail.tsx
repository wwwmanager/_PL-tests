import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Waybill, Route, Vehicle, Employee, WaybillStatus, Organization, SavedRoute, FuelType, SeasonSettings, Attachment, AppSettings, StockTransaction, GarageStockItem } from '../../types';
// API facades
import { getOrganizations } from '../../services/organizationApi';
import { addWaybill, updateWaybill, changeWaybillStatus, getLastWaybillForVehicle, getWaybillPrefill, getWaybillById } from '../../services/waybillApi';
import { getSavedRoutes, addSavedRoutesFromWaybill } from '../../services/routeApi';
import { getStockItems, StockItem } from '../../services/stockItemApi';
import { getSeasonSettings, getAppSettings } from '../../services/settingsApi';
import { FrontWaybillStatus } from '../../services/api/waybillStatusMap';
import { getNextBlankForDriver, useBlankForWaybill, getAvailableBlanksForDriver } from '../../services/blankApi';
// Utility functions
import { isWinterDate } from '../../services/dateUtils';
import { generateId } from '../../services/api/core';
// Stock API facade
import { getAvailableFuelExpenses, updateStockTransaction, getStockTransactions, getGarageStockItems, getNextWaybillNumber, getFuelCardBalance } from '../../services/stockApi';
import { getVehicles } from '../../services/vehicleApiFacade';
import { getEmployees } from '../../services/employeeApiFacade';
import { listDrivers, DriverListItem } from '../../services/driverApi';
import { generateRouteFromPrompt } from '../../services/geminiService';
import { TrashIcon, SparklesIcon, PrinterIcon, PaperClipIcon, ChatBubbleLeftRightIcon, UploadIcon, BanknotesIcon, PaperAirplaneIcon, CheckCircleIcon, ArrowUturnLeftIcon, XIcon, PencilIcon } from '../Icons';
import { WAYBILL_STATUS_TRANSLATIONS, WAYBILL_STATUS_COLORS } from '../../constants';
import PrintableWaybill from './PrintableWaybill';
import CollapsibleSection from '../shared/CollapsibleSection';
import { useToast } from '../../hooks/useToast';
import ConfirmationModal from '../shared/ConfirmationModal';
import { RouteImportModal } from '../dictionaries/RouteImportModal';
import { RouteSegment } from '../../services/routeParserService';
import Modal from '../shared/Modal';
import { useAuth } from '../../services/auth';
import CorrectionModal from './CorrectionModal';
import CorrectionReasonModal from './CorrectionReasonModal';


import { RouteRow } from './RouteRow';

interface WaybillDetailProps {
  waybill: Waybill | null;
  isPrefill?: boolean;
  onClose: () => void;
}

const getEmptyWaybill = (): Omit<Waybill, 'id'> => ({
  number: '', // Will be assigned by backend from blank
  date: new Date().toISOString().split('T')[0],
  vehicleId: '',
  driverId: '',
  status: WaybillStatus.DRAFT,
  odometerStart: 0,
  odometerEnd: 0,
  fuelPlanned: 0,
  fuelAtStart: 0,
  fuelFilled: 0,
  fuelAtEnd: 0,
  routes: [],
  organizationId: '',
  dispatcherEmployeeId: '',
  controllerEmployeeId: '',
  validFrom: new Date().toISOString().slice(0, 16),
  validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  attachments: [],
  reviewerComment: '',
  deviationReason: '',
  fuelCalculationMethod: 'BOILER',
  fuel: undefined
});

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
    {children}
  </div>
);

const FormInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 read-only:bg-gray-200 dark:read-only:bg-gray-800 dark:[color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`} />
);
const FormSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className="w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" />
);


// FIX: Changed component to be a named export to resolve module resolution errors.
export const WaybillDetail: React.FC<WaybillDetailProps> = ({ waybill, isPrefill, onClose }) => {
  // WB-FIX-ROUTES-001: Ensure routes is always an array to prevent iteration errors
  const initialWaybill = waybill && !isPrefill ? { ...waybill, routes: waybill.routes || [] } : getEmptyWaybill();
  const [formData, setFormData] = useState<Omit<Waybill, 'id'> | Waybill>(initialWaybill);
  const [initialFormData, setInitialFormData] = useState<Omit<Waybill, 'id'> | Waybill | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [drivers, setDrivers] = useState<DriverListItem[]>([]); // REL-010
  const [availableBlanks, setAvailableBlanks] = useState<any[]>([]); // WB-PREFILL-040

  useEffect(() => {
    if (formData.driverId) {
      getAvailableBlanksForDriver(formData.driverId)
        .then(blanks => {
          setAvailableBlanks(blanks);
          // WB-FIX-PL-001: Auto-select first available blank if not set
          // Only if status is DRAFT (creating or editing draft) and no blank selected
          if (formData.status === WaybillStatus.DRAFT && !formData.blankId && blanks.length > 0) {
            const best = blanks[0]; // First one
            setFormData(prev => ({
              ...prev,
              blankId: best.id,
              number: best.formattedNumber
            } as any));
          }
        })
        .catch(err => {
          console.error("Failed to fetch blanks", err);
          setAvailableBlanks([]);
        });
    } else {
      setAvailableBlanks([]);
    }
  }, [formData.driverId, formData.status]); // Added formData.status to dep? No actually blankId check inside prevents loop

  const handleBlankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'manual') {
      const waybill = formData as any;
      setFormData(prev => ({ ...prev, number: '', blankId: undefined }));
    } else {
      const blank = availableBlanks.find(b => b.id === val);
      if (blank) {
        setFormData(prev => ({
          ...prev,
          number: blank.formattedNumber,
          blankId: blank.id
        } as any));
      }
    }
  };

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [fuelItems, setFuelItems] = useState<StockItem[]>([]);
  const [seasonSettings, setSeasonSettings] = useState<SeasonSettings | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoFillMessage, setAutoFillMessage] = useState('');
  // Explicitly enable AI features without checking availability
  const [isAIAvailable, setIsAIAvailable] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [dayMode, setDayMode] = useState<'single' | 'multi'>('multi');
  const [minDate, setMinDate] = useState<string>('');
  const { showToast } = useToast();
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const { currentUser, can, hasRole } = useAuth();
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isCorrectionReasonModalOpen, setIsCorrectionReasonModalOpen] = useState(false);

  // Fuel migration state
  const [isGarageModalOpen, setIsGarageModalOpen] = useState(false);
  const [availableExpenses, setAvailableExpenses] = useState<StockTransaction[]>([]);
  const [stockItems, setStockItems] = useState<GarageStockItem[]>([]);
  const [linkedTxId, setLinkedTxId] = useState<string | null>(null);
  const [initialLinkedTxId, setInitialLinkedTxId] = useState<string | null>(null);

  const [fuelCardBalance, setFuelCardBalance] = useState<number | null>(null);
  const [fuelFilledError, setFuelFilledError] = useState<string | null>(null);

  const [linkedTransactions, setLinkedTransactions] = useState<StockTransaction[]>([]);

  const isDriver = useMemo(() => hasRole('driver'), [hasRole]);
  const canEdit = useMemo(() => formData.status !== WaybillStatus.POSTED && formData.status !== WaybillStatus.CANCELLED, [formData.status]);

  const isDirty = useMemo(() => {
    if (!initialFormData) return false;
    const currentData = { ...formData, linkedTxId };
    const initialData = { ...initialFormData, linkedTxId: initialLinkedTxId };
    return JSON.stringify(currentData) !== JSON.stringify(initialData);
  }, [formData, initialFormData, linkedTxId, initialLinkedTxId]);


  const COLLAPSED_SECTIONS_KEY = 'waybillDetail_collapsedSections';
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      return saved ? JSON.parse(saved) : {
        basicInfo: false,
        vehicleDriver: false,
        staff: false,
        fuelMileage: false,
        route: false,
        attachments: false,
        stockLinks: false,
      };
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // REL-010: Removed - now using real Driver list from API
  // const drivers = useMemo(() => employees.filter(e => e.employeeType === 'driver'), [employees]);

  useEffect(() => {
    const loadData = async () => {
      // REL-010: Added listDrivers() to load real Driver data with Driver.id
      const [vehiclesData, employeesData, organizationsData, driversData, savedRoutesData, fuelTypesData, settings, appSettingsData, stockItemsData, allTransactions] = await Promise.all([
        getVehicles(),
        getEmployees(),
        getOrganizations(),
        listDrivers(),
        getSavedRoutes(),
        getStockItems({ categoryEnum: 'FUEL', isActive: true }),
        getSeasonSettings(),
        getAppSettings(),
        getGarageStockItems(true),
        getStockTransactions(),
      ]);
      setVehicles(vehiclesData);
      setEmployees(employeesData);
      setOrganizations(organizationsData);
      setDrivers(driversData); // REL-010: Set real drivers
      setSavedRoutes(savedRoutesData);
      setFuelItems(fuelTypesData);
      // setIsAIAvailable is already true by default
      setSeasonSettings(settings);
      setAppSettings(appSettingsData);
      setStockItems(stockItemsData);


      let formDataToSet: Omit<Waybill, 'id'> | Waybill;

      // WB-LOAD-030: Always load full details from backend if ID exists (Edit Mode)
      let sourceWaybill = waybill;
      if (waybill && 'id' in waybill && waybill.id && !isPrefill) {
        try {
          const loaded = await getWaybillById(waybill.id);
          if (loaded) sourceWaybill = loaded;
        } catch (e) {
          console.error("Failed to load full waybill", e);
        }
      }

      if (isPrefill && waybill) {
        formDataToSet = {
          ...getEmptyWaybill(),
          vehicleId: waybill.vehicleId,
          driverId: waybill.driverId,
          odometerStart: Math.round(waybill.odometerEnd ?? 0),
          fuelAtStart: waybill.fuelAtEnd ?? 0,
        };
        if (window.confirm("Скопировать маршруты из предыдущего ПЛ?")) {
          formDataToSet.routes = waybill.routes.map(r => ({ ...r, id: generateId() }));
        }
      } else {
        // C1: Load from sourceWaybill
        if (sourceWaybill) {
          // Map flattened fuel from backend (if present) to form fields
          const f = sourceWaybill.fuel;
          formDataToSet = {
            ...sourceWaybill,
            routes: sourceWaybill.routes || [],
            date: sourceWaybill.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            fuelAtStart: f?.fuelStart ? Number(f.fuelStart) : (sourceWaybill.fuelAtStart || 0),
            fuelFilled: f?.fuelReceived ? Number(f.fuelReceived) : (sourceWaybill.fuelFilled || 0),
            fuelAtEnd: f?.fuelEnd ? Number(f.fuelEnd) : (sourceWaybill.fuelAtEnd || 0),
            fuelPlanned: f?.fuelPlanned ? Number(f.fuelPlanned) : (sourceWaybill.fuelPlanned || 0),
            // Ensure dispatcher/controller/validTo are mapped
            dispatcherEmployeeId: sourceWaybill.dispatcherEmployeeId || sourceWaybill.dispatcherId || '',
            controllerEmployeeId: sourceWaybill.controllerEmployeeId || sourceWaybill.controllerId || '',
            // WB-REG-001 FIX C: Use waybill's date as fallback, not current date
            // For existing waybills, validFrom should be preserved or derived from date, never today
            validFrom: sourceWaybill.validFrom
              ? sourceWaybill.validFrom.slice(0, 16)
              : (sourceWaybill.date ? `${sourceWaybill.date.split('T')[0]}T08:00` : ''),
            validTo: sourceWaybill.validTo
              ? sourceWaybill.validTo.slice(0, 16)
              : (sourceWaybill.date ? `${sourceWaybill.date.split('T')[0]}T18:00` : ''),
          };
        } else {
          formDataToSet = getEmptyWaybill();
        }
      }

      if (sourceWaybill && 'id' in sourceWaybill) {
        const linkedTx = allTransactions.find(tx => tx.waybillId === sourceWaybill.id);
        if (linkedTx) {
          setLinkedTxId(linkedTx.id);
          setInitialLinkedTxId(linkedTx.id);
        }
      }

      setFormData(formDataToSet);
      setInitialFormData(JSON.parse(JSON.stringify(formDataToSet)));

      if (formDataToSet.driverId) {
        getFuelCardBalance(formDataToSet.driverId)
          .then(setFuelCardBalance)
          .catch(() => setFuelCardBalance(null));
      }

      // WB-HOTFIX-UI-STATE-001: Use formDataToSet instead of waybill prop for accurate dayMode
      if (!isPrefill && formDataToSet.validFrom) { // For editing existing
        const fromDate = (formDataToSet.validFrom || formDataToSet.date || '').split('T')[0];
        const toDate = (formDataToSet.validTo || formDataToSet.date || '').split('T')[0];
        setDayMode(fromDate && toDate && fromDate !== toDate ? 'multi' : 'single');
      } else { // For new (blank or prefilled)
        setDayMode('multi');
        // WB-901: Remove auto-reserve on frontend. Number will be assigned by backend.
      }
    };
    loadData();

  }, [waybill, isPrefill, showToast]);

  useEffect(() => {
    // грузим только если есть ID ПЛ
    const loadLinkedTransactions = async () => {
      if (!formData || !('id' in formData) || !formData.id) {
        setLinkedTransactions([]);
        return;
      }

      try {
        const allTx = await getStockTransactions();

        // stockItems state is already populated from the main `loadData` effect.

        const ids = formData.linkedStockTransactionIds ?? [];
        if (!ids.length) {
          setLinkedTransactions([]);
          return;
        }

        const linked = allTx.filter(t => ids.includes(t.id));
        setLinkedTransactions(linked);
      } catch {
        setLinkedTransactions([]);
      }
    };

    loadLinkedTransactions();
  }, [formData]);

  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === formData.vehicleId), [formData.vehicleId, vehicles]);
  // REL-010: Use real Driver.id from drivers list, fallback to employee data for display
  const selectedDriver = useMemo(() => drivers.find(d => d.id === formData.driverId), [formData.driverId, drivers]);

  const selectedOrg = useMemo(() => organizations.find(o => o.id === formData.organizationId), [formData.organizationId, organizations]);
  const selectedDispatcher = useMemo(() => employees.find(e => e.id === formData.dispatcherEmployeeId), [formData.dispatcherEmployeeId, employees]);
  const selectedController = useMemo(() => employees.find(e => e.id === formData.controllerEmployeeId), [formData.controllerEmployeeId, employees]);
  const selectedFuelType = useMemo(() => fuelItems.find(f => f.id === selectedVehicle?.fuelStockItemId), [selectedVehicle, fuelItems]);


  useEffect(() => {
    // REL-304: Ensure organization and department are synced if selecting a driver for a new waybill
    if (selectedDriver && (!('id' in formData) || !formData.id || isPrefill)) {
      setFormData(prev => ({
        ...prev,
        organizationId: prev.organizationId || selectedDriver.departmentId ? organizations.find(o => o.id === selectedDriver.departmentId)?.id || prev.organizationId : prev.organizationId,
        // Department sync is more complex as it depends on Employee record
      }));
    }
  }, [selectedDriver, 'id' in formData ? (formData as any).id : undefined, isPrefill, organizations]);



  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();

    savedRoutes.forEach(route => {
      if (route.from) locations.add(route.from);
      if (route.to) locations.add(route.to);
    });

    (formData.routes || []).forEach(route => {
      if (route.from) locations.add(route.from);
      if (route.to) locations.add(route.to);
    });

    return Array.from(locations).sort();
  }, [savedRoutes, formData.routes]);


  const totalDistance = useMemo(() =>
    Math.round((formData.routes || []).reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0)),
    [formData.routes]
  );

  const actualFuelConsumption = useMemo(() => {
    const start = Number(formData.fuelAtStart) || 0;
    const filled = Number(formData.fuelFilled) || 0;
    const end = Number(formData.fuelAtEnd) || 0;
    return start + filled - end;
  }, [formData.fuelAtStart, formData.fuelFilled, formData.fuelAtEnd]);

  const fuelEconomyOrOverrun = useMemo(() => {
    const planned = Number(formData.fuelPlanned) || 0;
    if (planned === 0 && actualFuelConsumption === 0) return 0;
    return planned - actualFuelConsumption;
  }, [formData.fuelPlanned, actualFuelConsumption]);

  const calculatedFuelRate = useMemo(() => {
    if (!selectedVehicle || !seasonSettings) return 0;

    // Fallback for vehicles without fuelConsumptionRates (e.g., from backend)
    const rates = selectedVehicle.fuelConsumptionRates || { winterRate: 0, summerRate: 0 };

    const isWaybillWinter = isWinterDate(formData.date, seasonSettings);
    const baseConsumptionRate = isWaybillWinter ? (rates.winterRate || 0) : (rates.summerRate || 0);

    let totalConsumption = 0;
    let totalDistance = 0;

    for (const route of (formData.routes || [])) {
      if (!route.distanceKm || route.distanceKm === 0) continue;

      const routeDate = dayMode === 'multi' && route.date ? route.date : formData.date;
      const isWinter = isWinterDate(routeDate, seasonSettings);
      const baseRate = isWinter ? (rates.winterRate || 0) : (rates.summerRate || 0);
      let effectiveRate = baseRate;

      if (route.isCityDriving && selectedVehicle.useCityModifier && rates.cityIncreasePercent) {
        effectiveRate *= (1 + rates.cityIncreasePercent / 100);
      }
      if (route.isWarming && selectedVehicle.useWarmingModifier && rates.warmingIncreasePercent) {
        effectiveRate *= (1 + rates.warmingIncreasePercent / 100);
      }

      totalConsumption += (route.distanceKm / 100) * effectiveRate;
      totalDistance += route.distanceKm;
    }

    return totalDistance > 0 ? (totalConsumption / totalDistance) * 100 : baseConsumptionRate;
  }, [selectedVehicle, seasonSettings, formData.date, formData.routes, dayMode]);


  useEffect(() => {
    if (!selectedVehicle || !seasonSettings) {
      return;
    }

    const rates = selectedVehicle.fuelConsumptionRates || { winterRate: 0, summerRate: 0, cityIncreasePercent: 0, warmingIncreasePercent: 0 };
    const method = formData.fuelCalculationMethod || 'BOILER';
    const isWaybillWinter = isWinterDate(formData.date, seasonSettings);

    let totalPlanned = 0;

    if (method === 'BOILER') {
      const baseRate = isWaybillWinter ? (rates.winterRate || rates.summerRate || 0) : (rates.summerRate || rates.winterRate || 0);
      const distance = totalDistance;
      totalPlanned = (distance / 100) * baseRate;
    }
    else if (method === 'SEGMENTS') {
      for (const route of (formData.routes || [])) {
        const routeDate = dayMode === 'multi' && route.date ? route.date : formData.date;
        const isWinter = isWinterDate(routeDate, seasonSettings);
        const baseRate = isWinter ? (rates.winterRate || rates.summerRate || 0) : (rates.summerRate || rates.winterRate || 0);
        let effectiveRate = baseRate;

        if (route.isCityDriving && (rates.cityIncreasePercent || 0) > 0) {
          effectiveRate *= (1 + (rates.cityIncreasePercent || 0) / 100);
        }
        if (route.isWarming && (rates.warmingIncreasePercent || 0) > 0) {
          effectiveRate *= (1 + (rates.warmingIncreasePercent || 0) / 100);
        }
        totalPlanned += ((Number(route.distanceKm) || 0) / 100) * effectiveRate;
      }
    }
    else if (method === 'MIXED') {
      let totalConsRaw = 0;
      let segmentsKm = 0;

      for (const route of (formData.routes || [])) {
        const routeDate = dayMode === 'multi' && route.date ? route.date : formData.date;
        const isWinter = isWinterDate(routeDate, seasonSettings);
        const baseRate = isWinter ? (rates.winterRate || rates.summerRate || 0) : (rates.summerRate || rates.winterRate || 0);

        let coeffTotal = 0;
        if (route.isCityDriving && (rates.cityIncreasePercent || 0) > 0) {
          coeffTotal += (rates.cityIncreasePercent || 0) / 100;
        }
        if (route.isWarming && (rates.warmingIncreasePercent || 0) > 0) {
          coeffTotal += (rates.warmingIncreasePercent || 0) / 100;
        }

        const dist = Number(route.distanceKm) || 0;
        totalConsRaw += (dist / 100) * baseRate * (1 + coeffTotal);
        segmentsKm += dist;
      }

      if (segmentsKm > 0) {
        const avgRate = totalConsRaw / (segmentsKm / 100);
        totalPlanned = (totalDistance / 100) * avgRate;
      }
    }

    const startOdo = Number(formData.odometerStart) || 0;
    const newOdoEnd = startOdo + totalDistance;
    const newFuelPlanned = Math.round(totalPlanned * 100) / 100;

    const startFuel = Number(formData.fuelAtStart) || 0;
    const filledFuel = Number(formData.fuelFilled) || 0;
    const newFuelAtEnd = Math.round((startFuel + filledFuel - newFuelPlanned) * 100) / 100;

    setFormData(prev => ({
      ...prev,
      odometerEnd: Math.round(newOdoEnd),
      fuelPlanned: newFuelPlanned,
      fuelAtEnd: newFuelAtEnd,
    }));

  }, [totalDistance, formData.odometerStart, formData.fuelAtStart, formData.fuelFilled, selectedVehicle, formData.date, formData.routes, formData.fuelCalculationMethod, seasonSettings, dayMode]);

  // REL-010: Removed incorrect auto-fill of dispatcherId/controllerId
  // These are separate employees, not properties of the driver
  // useEffect(() => {
  //   if (selectedDriver) {
  //     setFormData(prev => ({
  //       ...prev,
  //       dispatcherId: ...,
  //       controllerId: ...,
  //     }));
  //   }
  // }, [selectedDriver]);


  // WB-901: Removed updateWaybillNumberForDriver as number is now assigned by backend


  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'driverId') {
      const driver = drivers.find(d => d.id === value);

      setFormData(prev => {
        const newFormData = { ...prev, driverId: value };
        // If it's a new waybill, try to sync org from driver's department (if available)
        // Since backend GET /drivers doesn't return orgId directly, we might need to rely on vehicle
        return newFormData;
      });

      if (value) {
        getFuelCardBalance(value)
          .then(bal => setFuelCardBalance(bal))
          .catch(() => setFuelCardBalance(null));
      } else {
        setFuelCardBalance(null);
      }
    } else {
      setFormData(prev => {
        let newFormData = { ...prev, [name]: value };

        if (dayMode === 'single' && name === 'validFrom') {
          const datePart = value.split('T')[0];
          const timePart = prev.validTo.split('T')[1] || '18:00';
          newFormData.validTo = `${datePart}T${timePart}`;
        }

        newFormData.date = newFormData.validFrom.split('T')[0];
        return newFormData;
      });
    }
  }, [employees, isPrefill, dayMode]);

  const handleNumericChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let numericValue = value === '' ? undefined : Number(value);

    if ((name === 'odometerStart' || name === 'odometerEnd') && numericValue !== undefined) {
      numericValue = Math.round(numericValue);
    }

    if (name === 'fuelFilled') {
      setLinkedTxId(null); // Manual change breaks the link
      if (fuelCardBalance != null && numericValue != null && !isNaN(numericValue) && numericValue > fuelCardBalance) {
        setFuelFilledError(`Введённый объём (${numericValue} л) превышает баланс на карте (${fuelCardBalance} л)`);
      } else {
        setFuelFilledError(null);
      }
    }
    setFormData(prev => ({ ...prev, [name]: numericValue }));
  }, [fuelCardBalance]);

  /* WB-PREFILL-030: Safe Prefill Logic */
  const [prefillData, setPrefillData] = useState<any>(null); // Staged prefill data
  const [isPrefillModalOpen, setIsPrefillModalOpen] = useState(false);

  const applyPrefill = (data: any, mode: 'overwrite' | 'fill-empty') => {
    setFormData(prev => {
      const newData = { ...prev };

      // Helper: apply if empty or overwrite
      const applyField = (field: keyof Waybill, value: any) => {
        const isEmpty = !newData[field] || newData[field] === 0 || newData[field] === '' || newData[field] === '0';
        if (value !== null && value !== undefined && (mode === 'overwrite' || isEmpty)) {
          // Special handling for numeric fields to avoid "0" overwrite issues if needed
          // But generally 0 is a valid value for odometer/fuel, so "isEmpty" check should be careful.
          // If existing is 0 and new is > 0, we should probably update even in fill-empty mode?
          // Let's assume 0 is "empty" for fuel/odometer in context of prefill? 
          // Usually prefill comes from last waybill, so if last waybill had 0, we apply 0.
          // If user entered 100 manually, we don't overwrite in 'fill-empty'.
          (newData as any)[field] = value;
        }
      };

      applyField('driverId', data.driverId);
      applyField('dispatcherEmployeeId', data.dispatcherEmployeeId);
      applyField('controllerEmployeeId', data.controllerEmployeeId);
      // Dispatcher/Controller are now fully migrated to EmployeeId fields
      // Legacy fields (dispatcherId/controllerId) are ignored for prefill if present

      // Odometer/Fuel: Usually strict numbers
      if (data.odometerStart !== null) {
        const currentOdo = Number(newData.odometerStart || 0);
        if (mode === 'overwrite' || currentOdo === 0) {
          newData.odometerStart = data.odometerStart;
        }
      }

      if (data.fuelStart !== null) {
        const currentFuel = Number(newData.fuelAtStart || 0);
        if (mode === 'overwrite' || currentFuel === 0) {
          newData.fuelAtStart = data.fuelStart;
        }
      }

      return newData;
    });

    // Message
    if (data.lastWaybillDate) {
      setAutoFillMessage(`Данные загружены на основе ПЛ №${data.lastWaybillNumber} от ${new Date(data.lastWaybillDate).toLocaleDateString()}.`);
      setMinDate(data.lastWaybillDate);
    } else {
      setAutoFillMessage(`Данные загружены из карточки ТС (история ПЛ не найдена).`);
      setMinDate('');
    }

    setIsPrefillModalOpen(false);
  };

  const handleVehicleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vehicleId = e.target.value;
    const selectedVehicle = vehicles.find(v => v.id === vehicleId);
    setAutoFillMessage('');
    setMinDate('');

    // Clear prefill state
    setPrefillData(null);

    if (selectedVehicle) {
      // 1. Basic update of vehicleId
      setFormData(prev => ({
        ...prev,
        vehicleId: selectedVehicle.id,
        // prefill organization if missing or empty
        organizationId: (!prev.organizationId || prev.organizationId === 'undefined') ? selectedVehicle.organizationId : prev.organizationId,
      }));

      // 2. Fetch Prefill Data (WB-PREFILL-020)
      if (!('id' in formData) || !formData.id || isPrefill) {
        try {
          // Static import used above
          const data = await getWaybillPrefill(selectedVehicle.id, formData.date); // Pass date to get relevant history

          // 3. Conflict Detection (WB-PREFILL-030)
          // Check if user has already entered data that might be overwritten
          const hasUserEnteredData =
            (formData.driverId && formData.driverId !== selectedVehicle.assignedDriverId) ||
            (Number(formData.odometerStart) > 0) ||
            (Number(formData.fuelAtStart) > 0) ||
            (Number(formData.fuelAtStart) > 0) ||
            (formData.dispatcherEmployeeId) ||
            (formData.controllerEmployeeId);

          if (hasUserEnteredData) {
            // Staging for modal
            setPrefillData(data);
            setIsPrefillModalOpen(true);
          } else {
            // Auto-apply if form is clean
            applyPrefill(data, 'fill-empty');
          }
        } catch (err) {
          console.error('Failed to load prefill data', err);
          showToast('Не удалось загрузить данные автозаполнения', 'error');
        }
      }

      const newRoutes = formData.routes.map(r => ({
        ...r,
        isCityDriving: selectedVehicle.useCityModifier ? r.isCityDriving : false,
        isWarming: selectedVehicle.useWarmingModifier ? r.isWarming : false,
      }));

      setFormData(prev => ({ ...prev, routes: newRoutes }));

    } else {
      setFormData(prev => ({
        ...prev,
        vehicleId: '',
        driverId: '',
        dispatcherId: '',
        controllerId: ''
      }));
    }
  };

  const isRouteDateValid = (routeDate?: string): boolean => {
    if (!routeDate || dayMode === 'single') return true;

    try {
      const rDate = new Date(routeDate);
      const sDate = new Date(formData.validFrom.split('T')[0]);
      const eDate = new Date(formData.validTo.split('T')[0]);

      rDate.setHours(0, 0, 0, 0);
      sDate.setHours(0, 0, 0, 0);
      eDate.setHours(0, 0, 0, 0);

      return rDate >= sDate && rDate <= eDate;
    } catch {
      return false;
    }
  };

  const handleAddRoute = useCallback(() => {
    setFormData(prev => {
      const lastRoute = prev.routes.length > 0 ? prev.routes[prev.routes.length - 1] : null;
      const newRoute = {
        id: generateId(),
        from: lastRoute ? lastRoute.to : '',
        to: '',
        distanceKm: 0,
        isCityDriving: false,
        isWarming: false,
        date: lastRoute?.date ? lastRoute.date : (dayMode === 'multi' ? prev.validFrom.split('T')[0] : undefined)
      };
      return {
        ...prev,
        routes: [...prev.routes, newRoute],
      };
    });
  }, [dayMode]);



  const savedRoutesIndex = useMemo(() => {
    const map = new Map<string, SavedRoute>();
    for (const sr of savedRoutes) {
      if (!sr.from || !sr.to) continue;
      const key = sr.from.trim().toLowerCase() + '|' + sr.to.trim().toLowerCase();
      map.set(key, sr);
    }
    return map;
  }, [savedRoutes]);

  const handleRouteChance = (id: string, field: keyof Route, value: string | number | boolean) => {
    if (field === 'date' && typeof value === 'string' && !isRouteDateValid(value)) {
      showToast(`Дата маршрута выходит за пределы диапазона путевого листа.`, 'error');
      return;
    }

    setFormData(prev => {
      let changed = false;
      const newRoutes = prev.routes.map(r => {
        if (r.id !== id) {
          return r;
        }

        const oldValue = r[field] as any;
        if (oldValue === value) return r; // Nothing changed

        changed = true;
        const updatedRoute = { ...r, [field]: value } as Route;

        if ((field === 'from' || field === 'to')) {
          const fromKey = (updatedRoute.from ?? '').trim().toLowerCase();
          const toKey = (updatedRoute.to ?? '').trim().toLowerCase();
          if (fromKey && toKey) {
            const key = fromKey + '|' + toKey;
            const matching = savedRoutesIndex.get(key);
            if (matching && typeof matching.distanceKm === 'number') {
              updatedRoute.distanceKm = matching.distanceKm;
            }
          }
        }
        return updatedRoute;
      });

      if (!changed) return prev;

      return {
        ...prev,
        routes: newRoutes,
      };
    });
  };

  const handleRemoveRoute = useCallback((id: string) => {
    setFormData(prev => ({
      ...prev,
      routes: prev.routes.filter(r => r.id !== id),
    }));
  }, []);

  const handleGenerateRoutes = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const generatedRoutes = await generateRouteFromPrompt(aiPrompt);
      setFormData(prev => ({ ...prev, routes: [...prev.routes, ...generatedRoutes] }));
      setAiPrompt('');
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDayModeChange = (mode: 'single' | 'multi') => {
    setDayMode(mode);
    if (mode === 'single') {
      const datePart = formData.validFrom.split('T')[0];
      const timePart = formData.validTo.split('T')[1] || '18:00';
      setFormData(prev => ({
        ...prev,
        validTo: `${datePart}T${timePart}`
      }));
    } else { // When switching back to 'multi'
      const fromDate = new Date(formData.validFrom);
      const toDate = new Date(formData.validTo);
      // If it's currently a single-day range, expand it to the next day
      if (fromDate.toISOString().split('T')[0] === toDate.toISOString().split('T')[0]) {
        const newToDate = new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
        setFormData(prev => ({
          ...prev,
          validTo: newToDate.toISOString().slice(0, 16)
        }));
      }
    }
  };

  const validateForm = async (): Promise<boolean> => {
    // WB-DISP-FIX: Allow DRAFT without dispatcher
    if (!formData.dispatcherEmployeeId && formData.status !== 'DRAFT') {
      showToast('Диспетчер не назначен. Пожалуйста, укажите его в карточке сотрудника или выберите вручную.', 'error');
      return false;
    }

    const method = formData.fuelCalculationMethod || 'BOILER';
    if ((method === 'SEGMENTS' || method === 'MIXED') && (formData.routes || []).length === 0) {
      showToast('Маршруты обязательны для выбранного метода расчета.', 'error');
      return false;
    }
    if ((method === 'BOILER' || method === 'MIXED') && (formData.odometerStart == null || formData.odometerEnd == null)) {
      showToast('Показания одометра обязательны для выбранного метода расчета.', 'error');
      return false;
    }

    const isNew = !('id' in formData && formData.id);
    if (!isNew && (!formData.number || formData.number === 'БЛАНКОВ НЕТ')) {
      showToast('Путевой лист должен иметь номер.', 'error');
      return false;
    }

    if (formData.fuelAtEnd !== undefined && formData.fuelAtEnd < 0) {
      showToast('Расчетный остаток топлива не может быть отрицательным.', 'error');
      return false;
    }

    if (selectedVehicle) {
      if (!selectedVehicle.disableFuelCapacityCheck && selectedVehicle.fuelTankCapacity) {
        const startFuel = Number(formData.fuelAtStart) || 0;
        const tankCapacity = Number(selectedVehicle.fuelTankCapacity) || 0;

        if (startFuel > tankCapacity) {
          showToast(`Начальный остаток топлива (${startFuel} л) не может превышать объем бака (${tankCapacity} л).`, 'error');
          return false;
        }

        const endFuel = Number(formData.fuelAtEnd) || 0;
        if (endFuel > tankCapacity) {
          // Если остаток в конце больше бака, значит в какой-то момент точно было переполнение.
          // Расход в процессе учитывается в расчете endFuel.
          showToast(`Конечный остаток топлива (${endFuel.toFixed(2)} л) не может превышать объем бака (${tankCapacity} л).`, 'error');
          return false;
        }
      }
    }

    for (const route of formData.routes) {
      if (!isRouteDateValid(route.date)) {
        const formattedRouteDate = route.date ? new Date(route.date).toLocaleDateString('ru-RU') : 'не указана';
        showToast(`Дата маршрута (${formattedRouteDate}) выходит за пределы срока действия путевого листа.`, 'error');
        return false;
      }
    }

    if ((!('id' in formData) || !formData.id) && formData.vehicleId) {
      if (selectedVehicle && Number(formData.odometerStart) < Number(selectedVehicle.mileage)) {
        showToast(`Начальный пробег (${Number(formData.odometerStart).toFixed(0)}) не может быть меньше последнего в карточке ТС (${Number(selectedVehicle.mileage).toFixed(0)}).`, 'error');
        return false;
      }

      const lastWaybill = await getLastWaybillForVehicle(formData.vehicleId);
      if (lastWaybill) {
        const waybillDate = new Date(formData.date);
        const lastWaybillDate = new Date(lastWaybill.date);
        if (waybillDate.getTime() < lastWaybillDate.getTime()) {
          showToast(`Дата ПЛ (${formData.date}) не может быть раньше даты последнего учтенного ПЛ (${lastWaybill.date}).`, 'error');
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async (suppressNotifications = false): Promise<Waybill | null> => {
    if (!(await validateForm())) return null;

    try {
      let savedWaybill: Waybill;

      // WB-FIX-PL-001: Construct payload with fuel object for aggregate upsert
      // WB-FIX-ODOMETER-001: Explicit Number conversion to avoid "expected number, received string" error
      const payload: any = {
        ...formData,
        odometerStart: formData.odometerStart != null ? Number(formData.odometerStart) : null,
        odometerEnd: formData.odometerEnd != null ? Number(formData.odometerEnd) : null,
      };

      // Check if we have fuel data to save
      // We prioritize form data. 
      if (selectedVehicle?.fuelStockItemId || Number(formData.fuelAtStart) > 0 || Number(formData.fuelFilled) > 0) {
        payload.fuel = {
          stockItemId: selectedVehicle?.fuelStockItemId || null,
          fuelStart: Number(formData.fuelAtStart) || 0,
          fuelReceived: Number(formData.fuelFilled) || 0,
          // Calculate consumption or use form if available? Form doesn't have fuelConsumed field usually, it's calc.
          // Let's pass calculated.
          fuelConsumed: actualFuelConsumption || 0,
          fuelEnd: Number(formData.fuelAtEnd) || 0,
          fuelPlanned: Number(formData.fuelPlanned) || 0,
          sourceType: linkedTxId ? 'GAS_STATION' : 'MANUAL',
          // Add timestamp if we had it, or null
          // comment: ...
        };
      }

      if ('id' in formData && formData.id) {
        // Ensure required fields for FrontWaybill are present in payload
        const updatePayload = {
          ...payload,
          // WB-FIX-PL-001: Dates are handled by mapper now (WB-DATE-060)

          // Send only new fields, rely on normalization or DTO aliases if needed
          dispatcherEmployeeId: payload.dispatcherEmployeeId || null,
          controllerEmployeeId: payload.controllerEmployeeId || null,
          // Legacy dispatcherId is removed to prevent overwriting with ''
        };
        savedWaybill = await updateWaybill(updatePayload as any);
      } else {
        const createPayload = {
          ...payload,
          // WB-FIX-PL-001
          dispatcherEmployeeId: payload.dispatcherEmployeeId || null,
          controllerEmployeeId: payload.controllerEmployeeId || null,
        };
        savedWaybill = await addWaybill(createPayload as any);
      }

      if (savedWaybill) {
        // WB-HOTFIX-UI-STATE-001: Safe date helpers
        const toDateInput = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') return val.slice(0, 10);
          return new Date(val).toISOString().slice(0, 10);
        };

        const toDateTimeInput = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') {
            // ISO -> yyyy-MM-ddTHH:mm, datetime-local already fits
            return val.includes('T') ? val.slice(0, 16) : `${val.slice(0, 10)}T00:00`;
          }
          return new Date(val).toISOString().slice(0, 16);
        };

        // WB-HOTFIX-UI-STATE-001: Use savedWaybill.fuel (flattened aggregate) instead of fuelLines[0]
        const f = (savedWaybill as any).fuel;
        const mappedFormData = {
          ...savedWaybill,
          routes: savedWaybill.routes || [],
          // Map fuel from flattened aggregate
          fuelAtStart: f?.fuelStart != null ? Number(f.fuelStart) : (savedWaybill.fuelAtStart || 0),
          fuelFilled: f?.fuelReceived != null ? Number(f.fuelReceived) : (savedWaybill.fuelFilled || 0),
          fuelAtEnd: f?.fuelEnd != null ? Number(f.fuelEnd) : (savedWaybill.fuelAtEnd || 0),
          fuelPlanned: f?.fuelPlanned != null ? Number(f.fuelPlanned) : (savedWaybill.fuelPlanned || 0),
          // Format dates for HTML inputs
          date: toDateInput(savedWaybill.date),
          validFrom: toDateTimeInput(savedWaybill.validFrom),
          validTo: toDateTimeInput(savedWaybill.validTo),
          // Preserve dispatcher/controller
          dispatcherEmployeeId: savedWaybill.dispatcherEmployeeId || '',
          controllerEmployeeId: savedWaybill.controllerEmployeeId || '',
        };

        console.log('[WB-SAVE] Mapped form data:', {
          date: mappedFormData.date,
          validFrom: mappedFormData.validFrom,
          validTo: mappedFormData.validTo,
          fuelAtStart: mappedFormData.fuelAtStart,
          fuelFilled: mappedFormData.fuelFilled
        });

        setFormData(mappedFormData as any);
        setInitialFormData(JSON.parse(JSON.stringify(mappedFormData)));

        // WB-HOTFIX-UI-STATE-001: Recalculate dayMode after save
        const fromDate = (mappedFormData.validFrom || mappedFormData.date || '').split('T')[0];
        const toDate = (mappedFormData.validTo || mappedFormData.date || '').split('T')[0];
        setDayMode(fromDate && toDate && fromDate !== toDate ? 'multi' : 'single');

        // Show toast only once
        if (!suppressNotifications) {
          showToast(
            `Путевой лист ${savedWaybill.number ? `№${savedWaybill.number} ` : ''}успешно сохранен`,
            'success'
          );
        }

        if (savedWaybill && savedWaybill.routes.length > 0) {
          await addSavedRoutesFromWaybill(savedWaybill.routes);
          const updatedRoutes = await getSavedRoutes();
          setSavedRoutes(updatedRoutes);
        }

        // Handle transaction linking
        const allTransactions = await getStockTransactions();
        const originalLinkedTx = allTransactions.find(tx => tx.id === initialLinkedTxId);

        if (originalLinkedTx && originalLinkedTx.id !== linkedTxId) {
          await updateStockTransaction({ ...originalLinkedTx, waybillId: null });
        }

        if (linkedTxId && linkedTxId !== originalLinkedTx?.id) {
          const newLinkedTx = allTransactions.find(tx => tx.id === linkedTxId);
          if (newLinkedTx) {
            await updateStockTransaction({ ...newLinkedTx, waybillId: savedWaybill.id });
          }
        }

        setInitialLinkedTxId(linkedTxId);

        return savedWaybill;
      }
      return null;
    } catch (err: any) {
      console.error('Error saving waybill:', err);
      showToast('Ошибка при сохранении: ' + (err.message || 'Неизвестная ошибка'), 'error');
      return null;
    }
  };

  const handleCloseRequest = () => {
    if (isDirty) {
      setIsConfirmationModalOpen(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setIsConfirmationModalOpen(false);
    onClose();
  };

  const handleAttachmentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const newAttachment: Attachment = {
        name: file.name,
        size: file.size,
        type: file.type,
        content: e.target?.result as string,
        userId: 'local-user',
      };
      setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), newAttachment] }));
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (name: string) => {
    setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter(att => att.name !== name) }));
  };

  const handleImportConfirm = (segments: RouteSegment[]) => {
    try {
      const newWaybillRoutes: Route[] = segments.map(seg => {
        // Convert date from dd.mm.yyyy to yyyy-mm-dd
        const dateParts = seg.date.split('.');
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : undefined;

        return {
          id: generateId(),
          from: seg.from,
          to: seg.to,
          distanceKm: seg.distanceKm,
          isCityDriving: selectedVehicle?.useCityModifier || false,
          isWarming: false, // This info is not available in the parsed file
          date: dayMode === 'multi' ? formattedDate : undefined,
        };
      });

      if (newWaybillRoutes.length > 0) {
        setFormData(prev => ({ ...prev, routes: [...prev.routes, ...newWaybillRoutes] }));
        showToast(`Добавлено ${newWaybillRoutes.length} сегментов маршрута.`, 'success');
      } else {
        showToast('Не выбрано ни одного маршрута для импорта.', 'info');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ошибка импорта', 'error');
    } finally {
      setIsImportModalOpen(false);
    }
  };

  const handleOpenGarageModal = async () => {
    if (!formData.driverId) {
      showToast('Сначала выберите водителя.', 'info');
      return;
    }
    const expenses = await getAvailableFuelExpenses(formData.driverId, 'id' in formData ? formData.id : null);
    setAvailableExpenses(expenses);
    setIsGarageModalOpen(true);
  };

  const handleSelectExpense = (tx: StockTransaction) => {
    // FIX: Use categoryEnum='FUEL' instead of fuelTypeId check. Also support legacy fuelTypeId if category missing
    const fuelItem = tx.items.find(item => {
      const stockItem = stockItems.find(si => si.id === item.stockItemId);
      return stockItem && (stockItem.categoryEnum === 'FUEL' || stockItem.fuelTypeId);
    });
    if (fuelItem) {
      setFormData(prev => ({ ...prev, fuelFilled: fuelItem.quantity }));
      setLinkedTxId(tx.id);
      setIsGarageModalOpen(false);
    } else {
      showToast('В накладной не найдено топливо.', 'error');
    }
  };

  const handleStatusChange = async (nextStatus: WaybillStatus) => {
    let savedWaybill = 'id' in formData ? formData : null;
    if (isDirty) {
      savedWaybill = await handleSave(true);
      if (!savedWaybill) return; // Save failed, stop status change
    }

    if (!savedWaybill || !('id' in savedWaybill)) {
      showToast('Сначала сохраните путевой лист.', 'error');
      return;
    }

    try {
      const frontStatus = nextStatus.toLowerCase() as FrontWaybillStatus;
      const updatedWaybill = await changeWaybillStatus(savedWaybill.id, frontStatus, {
        userId: currentUser?.id,
        appMode: appSettings?.appMode || 'driver',
      });
      setFormData(updatedWaybill as Waybill);
      setInitialFormData(JSON.parse(JSON.stringify(updatedWaybill)));
      showToast(`Статус изменен на "${WAYBILL_STATUS_TRANSLATIONS[nextStatus]}"`, 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const handleReturnToDraft = async (comment: string) => {
    // This is a conceptual action, might not be a direct status change
    // For now, we add a comment and keep it in draft
    const updatedWaybillData = { ...formData, reviewerComment: comment, status: WaybillStatus.DRAFT };
    setFormData(updatedWaybillData);
    await handleSave(true); // Save the comment
    setIsCorrectionModalOpen(false);
    showToast('Комментарий добавлен, ПЛ возвращен в черновики.', 'info');
  };

  const handleConfirmCorrection = async (reason: string) => {
    if (!('id' in formData && formData.id)) {
      return; // Should not happen for a POSTED waybill
    }

    try {
      const updatedWaybill = await changeWaybillStatus(formData.id, 'draft', {
        userId: currentUser?.id,
        appMode: appSettings?.appMode || 'driver',
        reason: reason.trim(),
      });
      setFormData(updatedWaybill as Waybill);
      setInitialFormData(JSON.parse(JSON.stringify(updatedWaybill)));
      showToast('Путевой лист возвращен в черновики для корректировки.', 'success');
      setIsCorrectionReasonModalOpen(false);
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const renderFooterActions = () => {
    const isNew = !('id' in formData && formData.id);

    return <>
      <button
        onClick={handleCloseRequest}
        className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold py-2 px-6 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        aria-label="Закрыть"
      >
        Закрыть
      </button>

      <button
        onClick={() => setIsPrintModalOpen(true)}
        className="flex items-center gap-2 bg-teal-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-teal-700 transition-colors disabled:opacity-50"
        aria-label="Печать на бланке"
        disabled={isNew}
      >
        <PrinterIcon className="h-5 w-5" />
        Печать
      </button>

      {canEdit && (
        <button onClick={() => handleSave()} className="bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-blue-700">Сохранить</button>
      )}
    </>;
  };

  const statusColors = WAYBILL_STATUS_COLORS[formData.status];

  const formattedOverrun = fuelEconomyOrOverrun.toFixed(2);
  const displayOverrun = formattedOverrun === '-0.00' ? '0.00' : formattedOverrun;
  const isOverrun = fuelEconomyOrOverrun < -0.005; // Use a small tolerance for floating point issues


  return (
    <>
      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        onConfirm={handleConfirmClose}
        title="Выйти без сохранения?"
        message="У вас есть несохраненные изменения. Вы уверены, что хотите выйти? Все изменения будут потеряны."
        confirmText="Да, выйти"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
      {/* WB-PREFILL-030: Prefill Confirmation Modal */}
      <ConfirmationModal
        isOpen={isPrefillModalOpen}
        title="Обновить данные автозаполнения?"
        message={`Для выбранного ТС найдены актуальные данные (ПЛ №${prefillData?.lastWaybillNumber || 'нет'}, пробег ${prefillData?.odometerStart || 0}). \n\nВы хотите обновить поля?`}
        confirmText="Обновить (только пустые)"
        onConfirm={() => applyPrefill(prefillData, 'fill-empty')}
        onClose={() => setIsPrefillModalOpen(false)}
      />

      {/* Custom Modal for Prefill Options if ConfirmationModal is too simple */}
      {isPrefillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Обновить данные автозаполнения?</h3>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Для выбранного ТС найдены актуальные данные:
              <ul className="list-disc pl-5 mt-2">
                <li>Водитель: {prefillData?.driverId ? 'Найден' : 'Нет'}</li>
                <li>Пробег: {prefillData?.odometerStart}</li>
                <li>Топливо: {prefillData?.fuelStart}</li>
                {prefillData?.tankBalance !== null && <li>Бак (датчик): {prefillData.tankBalance}</li>}
              </ul>
              <br />
              Текущие значения в форме будут изменены.
            </p>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => applyPrefill(prefillData, 'fill-empty')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Заполнить только пустые поля
              </button>
              <button
                onClick={() => applyPrefill(prefillData, 'overwrite')}
                className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Перезаписать все поля
              </button>
              <button
                onClick={() => setIsPrefillModalOpen(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-white"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {isCorrectionModalOpen && formData && 'id' in formData && (
        <CorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={() => setIsCorrectionModalOpen(false)}
          onSubmit={async () => {
            // Refresh logic usually handled by parent list or onClose triggers
            if (onClose) onClose();
          }}
        />
      )}

      {isCorrectionReasonModalOpen && (
        <CorrectionReasonModal
          isOpen={isCorrectionReasonModalOpen}
          onClose={() => setIsCorrectionReasonModalOpen(false)}
          onSubmit={(reason) => {
            setFormData(prev => ({ ...prev, deviationReason: reason }));
            setIsCorrectionReasonModalOpen(false);
          }}
        />
      )}
      {isPrintModalOpen && (
        <PrintableWaybill
          waybill={formData as Waybill}
          vehicle={selectedVehicle}
          driver={selectedDriver ? { fullName: selectedDriver.fullName, shortName: selectedDriver.shortName } as any : undefined} // REL-304: Pass driver data for print
          organization={selectedOrg}
          dispatcher={selectedDispatcher}
          controller={selectedController}
          // StockItem structure is compatible with FuelType expected by PrintableWaybill (id, name, code, density)
          fuelType={selectedFuelType as any}
          allOrganizations={organizations}
          onClose={() => setIsPrintModalOpen(false)}

        />
      )}
      {isImportModalOpen && <RouteImportModal onClose={() => setIsImportModalOpen(false)} onConfirm={handleImportConfirm} />}
      <Modal isOpen={isGarageModalOpen} onClose={() => setIsGarageModalOpen(false)} title="Выбрать расходную накладную">
        <div className="space-y-2">
          {availableExpenses.length > 0 ? availableExpenses.map(tx => {
            const fuelItem = tx.items.find(item => {
              // Same logic as handleSelectExpense
              const stockItem = stockItems.find(si => si.id === item.stockItemId);
              return stockItem && (stockItem.categoryEnum === 'FUEL' || stockItem.fuelTypeId);
            });
            if (!fuelItem) return null;
            const stockItemDetails = stockItems.find(si => si.id === fuelItem.stockItemId);
            return (
              <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div>
                  <p>Накладная №{tx.docNumber} от {tx.date}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{stockItemDetails?.name}: {fuelItem.quantity} {stockItemDetails?.unit}</p>
                </div>
                <button onClick={() => handleSelectExpense(tx)} className="bg-blue-600 text-white font-semibold py-1 px-3 rounded-lg">Выбрать</button>
              </div>
            )
          }) : <p>Нет доступных накладных для этого водителя.</p>}
        </div>
      </Modal>

      <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-2xl shadow-lg space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              {('id' in formData && formData.id) ? `Путевой лист №${formData.number}` : 'Новый путевой лист'}
            </h2>
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${statusColors?.bg} ${statusColors?.text}`}>
              {WAYBILL_STATUS_TRANSLATIONS[formData.status]}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium transition-colors ${dayMode === 'single' ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              Однодневный
            </span>
            <label htmlFor="dayModeToggle" className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="dayModeToggle"
                className="sr-only peer"
                checked={dayMode === 'multi'}
                onChange={(e) => handleDayModeChange(e.target.checked ? 'multi' : 'single')}
                disabled={!canEdit}
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
            <span className={`text-sm font-medium transition-colors ${dayMode === 'multi' ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              Многодневный
            </span>
          </div>
        </header>

        {formData.reviewerComment && formData.status === WaybillStatus.DRAFT && (
          <div className="p-4 bg-orange-100 dark:bg-orange-900/50 border-l-4 border-orange-500 rounded-r-lg">
            <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 font-semibold">
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
              <span>Комментарий проверяющего:</span>
            </div>
            <p className="mt-2 text-orange-700 dark:text-orange-300 ml-7">{formData.reviewerComment}</p>
          </div>
        )}

        <CollapsibleSection title="Основная информация" isCollapsed={collapsedSections.basicInfo || false} onToggle={() => toggleSection('basicInfo')}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField label="Организация"><FormSelect name="organizationId" value={formData.organizationId} onChange={handleChange} disabled={!canEdit || isDriver}><option value="">Выберите</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.shortName}</option>)}</FormSelect></FormField>
            <FormField label="Номер ПЛ">
              {availableBlanks.length > 0 && (!('id' in formData) || !formData.id || !formData.number) ? (
                <FormSelect
                  name="blankId"
                  value={(formData as any).blankId || (availableBlanks.find(b => b.formattedNumber === formData.number)?.id) || ''}
                  onChange={handleBlankChange}
                  disabled={!canEdit}
                >
                  <option value="">-- Выберите бланк --</option>
                  {availableBlanks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.series} {b.number}
                    </option>
                  ))}
                  <option value="manual">Ввести вручную / Автоматически</option>
                </FormSelect>
              ) : (
                <FormInput
                  type="text"
                  name="number"
                  value={formData.number || (('id' in formData && formData.id) ? '' : 'Автоматически')}
                  readOnly
                  className="bg-gray-100 font-semibold"
                />
              )}
            </FormField>
            <div />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            <FormField label="Дата ПЛ"><FormInput type="date" name="date" value={formData.date} readOnly className="!bg-gray-200 dark:!bg-gray-800" /></FormField>
            <FormField label="Действителен с">
              <FormInput
                type="datetime-local"
                name="validFrom"
                value={formData.validFrom}
                min={minDate ? `${minDate}T00:00` : undefined}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </FormField>
            <FormField label="Действителен по">
              <FormInput
                type={dayMode === 'single' ? 'time' : 'datetime-local'}
                name="validTo"
                value={dayMode === 'single' ? (formData.validTo?.split('T')[1] || '') : (formData.validTo || '')}
                onChange={(e) => {
                  if (dayMode === 'single') {
                    const datePart = formData.validFrom?.split('T')[0] || formData.date?.split('T')[0] || '';
                    setFormData({ ...formData, validTo: `${datePart}T${e.target.value}` });
                  } else {
                    handleChange(e);
                  }
                }}
                min={dayMode === 'multi' ? (formData.validFrom || '') : undefined}
                disabled={!canEdit}
              />
            </FormField>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="ТС и Водитель" isCollapsed={collapsedSections.vehicleDriver || false} onToggle={() => toggleSection('vehicleDriver')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Транспортное средство">
              <FormSelect name="vehicleId" value={formData.vehicleId} onChange={handleVehicleChange} disabled={!canEdit}>
                <option value="">Выберите ТС</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registrationNumber} ({v.brand})</option>)}
              </FormSelect>
              {autoFillMessage && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{autoFillMessage}</p>}
            </FormField>
            {/* REL-304: Usage of drivers list (Driver.id) instead of employees */}
            <FormField label="Водитель">
              <FormSelect
                name="driverId"
                value={formData.driverId}
                onChange={handleChange}
                disabled={!canEdit || isDriver}
              >
                <option value="">Выберите водителя...</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} {d.isActive ? '' : '(неактивен)'}
                  </option>
                ))}
              </FormSelect>

              {fuelCardBalance != null && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Доступно на карте: {fuelCardBalance.toFixed(2)} л
                </div>
              )}
            </FormField>
          </div>
        </CollapsibleSection>

        {!isDriver && (
          <CollapsibleSection title="Ответственные лица" isCollapsed={collapsedSections.staff || false} onToggle={() => toggleSection('staff')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Выезд разрешил (Диспетчер)">
                <FormSelect name="dispatcherEmployeeId" value={formData.dispatcherEmployeeId || ''} onChange={handleChange} disabled={!canEdit}>
                  <option value="">Выберите</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="Расчет произвел (Контролер/Бухгалтер)">
                <FormSelect name="controllerEmployeeId" value={formData.controllerEmployeeId || ''} onChange={handleChange} disabled={!canEdit}>
                  <option value="">Выберите</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </FormSelect>
              </FormField>
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Пробег и топливо" isCollapsed={collapsedSections.fuelMileage || false} onToggle={() => toggleSection('fuelMileage')}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <FormField label="Пробег (выезд)"><FormInput type="number" step="1" name="odometerStart" value={formData.odometerStart || ''} onChange={handleNumericChange} disabled={!canEdit} /></FormField>
              <FormField label="Пробег (возврат)"><FormInput type="number" step="1" name="odometerEnd" value={formData.odometerEnd || ''} onChange={handleNumericChange} disabled={!canEdit} /></FormField>
            </div>
            <div>
              <FormField label="Топливо (выезд)"><FormInput type="number" name="fuelAtStart" value={formData.fuelAtStart || ''} onChange={handleNumericChange} disabled={!canEdit} /></FormField>
              <FormField label="Заправлено">
                <div className="flex items-center gap-1">
                  <FormInput type="number" name="fuelFilled" value={formData.fuelFilled || ''} onChange={handleNumericChange} disabled={!canEdit} className={`${linkedTxId ? '!bg-green-100 dark:!bg-green-900' : ''} ${fuelFilledError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} />
                  <button onClick={handleOpenGarageModal} title="Заполнить из Гаража" className="p-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50" disabled={!formData.driverId}><BanknotesIcon className="h-5 w-5" /></button>
                </div>
                {fuelFilledError && (<div className="mt-1 text-xs text-red-500">{fuelFilledError}</div>)}
              </FormField>
              <FormField label="Топливо (возврат)"><FormInput type="number" name="fuelAtEnd" value={formData.fuelAtEnd || ''} onChange={handleNumericChange} disabled={!canEdit} /></FormField>
            </div>
            <div>
              <FormField label="Расход (норма)"><FormInput type="number" name="fuelPlanned" value={formData.fuelPlanned || ''} onChange={handleNumericChange} readOnly className="!bg-gray-200 dark:!bg-gray-800" /></FormField>
              <p className="text-xs text-gray-500 mt-1">Факт: {actualFuelConsumption.toFixed(2)}</p>
              <p className={`text-xs mt-1 ${fuelEconomyOrOverrun > 0.005 ? 'text-green-600' : isOverrun ? 'text-red-600' : 'text-gray-500'}`}>
                {fuelEconomyOrOverrun > 0.005 ? `Экономия: ${displayOverrun}` : isOverrun ? `Перерасход: ${Math.abs(fuelEconomyOrOverrun).toFixed(2)}` : 'Совпадает'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Пройдено, км: {totalDistance}</p>
              <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-lg text-center mb-4">
                <p className="text-xs text-green-700 dark:text-green-300">Расчетная норма</p>
                <p className="font-bold text-green-800 dark:text-green-200">{calculatedFuelRate.toFixed(2)} л/100км</p>
              </div>
              <FormField label="Метод расчета">
                <FormSelect
                  name="fuelCalculationMethod"
                  value={formData.fuelCalculationMethod || 'BOILER'}
                  onChange={handleChange}
                  disabled={!canEdit}
                >
                  <option value="BOILER">По котлу (без коэф.)</option>
                  <option value="SEGMENTS">По сегментам (с коэф.)</option>
                  <option value="MIXED">Смешанный (одометр + сегменты)</option>
                </FormSelect>
              </FormField>
            </div>
          </div>
          {isOverrun && (
            <div className="mt-4">
              <FormField label="Причина перерасхода">
                <input name="deviationReason" value={formData.deviationReason || ''} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2" />
              </FormField>
            </div>
          )}
        </CollapsibleSection>

        {('id' in formData) && formData.id && (
          <CollapsibleSection
            title="Связанные складские операции"
            isCollapsed={collapsedSections.stockLinks || false}
            onToggle={() => toggleSection('stockLinks')}
          >
            <div className="bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm">
              {linkedTransactions.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Нет связанных операций на складе.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">Дата</th>
                      <th className="p-2">Тип</th>
                      <th className="p-2">Причина</th>
                      <th className="p-2">Номенклатура</th>
                      <th className="p-2">Количество</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedTransactions.flatMap(tx => {
                      const isIncome = tx.type === 'income';
                      const reason =
                        tx.expenseReason === 'waybill'
                          ? 'Списание по ПЛ'
                          : tx.expenseReason === 'fuelCardTopUp'
                            ? 'Пополнение карты'
                            : tx.type === 'income'
                              ? 'Приход'
                              : 'Расход';
                      const rowCount = tx.items?.length || 1;

                      if (!tx.items || tx.items.length === 0) {
                        return (
                          <tr key={tx.id} className="border-t dark:border-gray-700">
                            <td className="p-2">{tx.date}</td>
                            <td className={`p-2 font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                              {isIncome ? 'Приход' : 'Расход'}
                            </td>
                            <td className="p-2">{reason}</td>
                            <td className="p-2 text-gray-400" colSpan={2}>Нет позиций в документе</td>
                          </tr>
                        );
                      }

                      return tx.items.map((item, itemIndex) => {
                        const stockItem = stockItems.find(i => i.id === item.stockItemId);
                        return (
                          <tr key={`${tx.id}-${itemIndex}`} className="border-t dark:border-gray-700">
                            {itemIndex === 0 && (
                              <>
                                <td className="p-2 align-top" rowSpan={rowCount}>{tx.date}</td>
                                <td className={`p-2 align-top font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`} rowSpan={rowCount}>
                                  {isIncome ? 'Приход' : 'Расход'}
                                </td>
                                <td className="p-2 align-top" rowSpan={rowCount}>{reason}</td>
                              </>
                            )}
                            <td className="p-2">{stockItem?.name ?? '—'}</td>
                            <td className="p-2">
                              {item.quantity != null ? `${item.quantity} ${stockItem?.unit ?? ''}` : '—'}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Маршрут" isCollapsed={collapsedSections.route || false} onToggle={() => toggleSection('route')}>
          {(isAIAvailable || appSettings?.isParserEnabled) && (
            <div className="flex gap-4 mb-4 items-center">
              {isAIAvailable && (
                <>
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Например: Гараж - Склад А - Клиент - Гараж"
                    className="flex-grow bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
                  />
                  <button
                    onClick={handleGenerateRoutes}
                    disabled={isGenerating || !aiPrompt}
                    className="flex items-center gap-2 bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    <SparklesIcon className="h-5 w-5" />
                    {isGenerating ? 'Генерация...' : 'Сгенерировать (AI)'}
                  </button>
                </>
              )}
              {appSettings?.isParserEnabled && (
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700"
                >
                  <UploadIcon className="h-5 w-5" /> Импорт из файла
                </button>
              )}
            </div>
          )}
          <div className="space-y-4">
            {(formData.routes || []).map(route => (<RouteRow
              key={route.id}
              route={route}
              dayMode={dayMode}
              selectedVehicle={selectedVehicle}
              onChange={handleRouteChance}
              onRemove={handleRemoveRoute}
            />
            ))}
          </div>
          <button onClick={handleAddRoute} className="mt-4 text-blue-600 hover:text-blue-800">
            + Добавить маршрут
          </button>
        </CollapsibleSection>

        <CollapsibleSection title="Приложения" isCollapsed={collapsedSections.attachments || false} onToggle={() => toggleSection('attachments')}>
          <div className="mt-4 space-y-2">
            {(formData.attachments || []).map(att => (
              <div key={att.name} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                <div>
                  <p className="font-medium text-gray-800 dark:text-white">{att.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{(att.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => removeAttachment(att.name)} className="text-red-500 hover:text-red-700">
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Status Actions */}
        <div className="pt-6 border-t dark:border-gray-600 flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {formData.status === WaybillStatus.DRAFT && can('waybill.submit') && appSettings?.appMode === 'central' && (
              <button onClick={() => handleStatusChange(WaybillStatus.SUBMITTED)} className="flex items-center gap-2 bg-blue-500 text-white py-2 px-4 rounded-lg shadow hover:bg-blue-600"><PaperAirplaneIcon className="h-5 w-5" /> Отправить на проверку</button>
            )}
            {formData.status === WaybillStatus.DRAFT && can('waybill.post') && (appSettings?.appMode === 'driver' || !appSettings?.appMode) && (
              <button onClick={() => handleStatusChange(WaybillStatus.POSTED)} className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg shadow hover:bg-green-700"><CheckCircleIcon className="h-5 w-5" /> Провести</button>
            )}
            {formData.status === WaybillStatus.SUBMITTED && can('waybill.post') && (
              <button onClick={() => handleStatusChange(WaybillStatus.POSTED)} className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg shadow hover:bg-green-700"><CheckCircleIcon className="h-5 w-5" /> Провести</button>
            )}
            {formData.status === WaybillStatus.SUBMITTED && can('waybill.submit') && ( // Assuming same capability for returning
              <button onClick={() => setIsCorrectionModalOpen(true)} className="flex items-center gap-2 bg-yellow-500 text-white py-2 px-4 rounded-lg shadow hover:bg-yellow-600"><ArrowUturnLeftIcon className="h-5 w-5" /> Вернуть на доработку</button>
            )}
            {formData.status === WaybillStatus.POSTED && can('waybill.correct') && (
              <button onClick={() => setIsCorrectionReasonModalOpen(true)} className="flex items-center gap-2 bg-yellow-500 text-white py-2 px-4 rounded-lg shadow hover:bg-yellow-600"><PencilIcon className="h-5 w-5" /> Скорректировать</button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {renderFooterActions()}
          </div>
        </div>
      </div >
    </>
  );
};
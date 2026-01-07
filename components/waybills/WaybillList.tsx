





import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { deleteWaybill, getWaybills, updateWaybill, getLatestWaybill, bulkDeleteWaybills, bulkChangeWaybillStatus, getWaybillById } from '../../services/api/waybillApi';
import { getVehicles } from '../../services/api/vehicleApi';
import { Waybill, WaybillStatus, Vehicle, Employee, Organization } from '../../types';
import { listDrivers, DriverListItem } from '../../services/driverApi';
import { getEmployees } from '../../services/api/employeeApi';
import { getOrganizations } from '../../services/organizationApi';
import { getStockItems, StockItem } from '../../services/stockItemApi';
import { WAYBILL_STATUS_COLORS, WAYBILL_STATUS_TRANSLATIONS } from '../../constants';
import { PlusIcon, PencilIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, StatusCompletedIcon, CalendarDaysIcon, DocumentArrowUpIcon, ClipboardCheckIcon, FunnelIcon, CheckCircleIcon, PrintIcon, CalculatorIcon } from '../Icons';
import { Button } from '../shared/Button';
import { WaybillStatusBadge } from '../shared/StatusBadges';
// FIX: Changed import to a named import to resolve module resolution error.
import { WaybillDetail } from './WaybillDetail';
import PrintableWaybill from './PrintableWaybill';
import useTable from '../../hooks/useTable';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import SeasonSettingsModal from './SeasonSettingsModal';
import BatchGeneratorModal from './BatchGeneratorModal';
import WaybillCheckModal from './WaybillCheckModal';
import { RecalculateModal } from './RecalculateModal';
import { subscribe } from '../../services/bus';
import { EmptyState, getEmptyStateFromError } from '../common/EmptyState';
import { HttpError } from '../../services/httpClient';
import { useAuth } from '../../services/auth';

// DnD Imports
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useColumnPersistence } from '../../hooks/useColumnPersistence';
import { SortableHeader } from '../shared/SortableHeader';
import { createPortal } from 'react-dom';
import { Column } from '../shared/DataTable';


type EnrichedWaybill = Waybill & { mileage?: number; rowNumber?: number; tankCapacity?: number; };

interface WaybillListProps {
  waybillToOpen: string | null;
  onWaybillOpened: () => void;
}

const getStatusIcon = (status: WaybillStatus) => {
  switch (status) {
    case WaybillStatus.DRAFT: return <PencilIcon className="h-4 w-4" />;
    case WaybillStatus.POSTED: return <StatusCompletedIcon className="h-5 w-5" />;
    default: return null;
  }
};

const VEHICLE_FILTER_KEY = 'waybillList_selectedVehicle';

const WaybillList: React.FC<WaybillListProps> = ({ waybillToOpen, onWaybillOpened }) => {
  const [waybills, setWaybills] = useState<EnrichedWaybill[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<DriverListItem[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HttpError | Error | null>(null);
  const [selectedVehicleId, setSelectedVehicleIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(VEHICLE_FILTER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [topLevelFilter, setTopLevelFilter] = useState({ dateFrom: '', dateTo: '', status: '' as WaybillStatus | '' });
  const [selectedWaybillId, setSelectedWaybillId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [waybillToPrefill, setWaybillToPrefill] = useState<Waybill | null>(null);
  const [isExtendedView, setIsExtendedView] = useState(true); // Default: extended view ON
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isRecalculateModalOpen, setIsRecalculateModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState<{
    waybill: Waybill;
    vehicle: Vehicle | undefined;
    driver: Employee | undefined;
    dispatcher: Employee | undefined;
    controller: Employee | undefined;
    organization: Organization | undefined;
    fuelType: StockItem | undefined;
    allOrganizations: Organization[];
  } | null>(null);

  // Column Definitions
  const waybillColumns: Column<EnrichedWaybill>[] = useMemo(() => {
    if (isExtendedView) {
      return [
        { key: 'rowNumber', label: '№', sortable: true, align: 'center' as const },
        { key: 'number', label: 'Номер', sortable: true, align: 'center' as const, render: (w) => <span className="font-medium text-gray-900 dark:text-white">{w.number}</span> },
        { key: 'validFrom', label: 'Выезд', sortable: true, align: 'center' as const, render: (w) => w.validFrom ? new Date(w.validFrom).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
        { key: 'validTo', label: 'Возврат', sortable: true, align: 'center' as const, render: (w) => w.validTo ? new Date(w.validTo).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
        { key: 'odometerStart', label: 'Одом. нач.', sortable: true, align: 'center' as const },
        { key: 'odometerEnd', label: 'Одом. кон.', sortable: true, align: 'center' as const, render: (w) => w.odometerEnd ?? '—' },
        { key: 'mileage', label: 'Пробег', sortable: true, align: 'center' as const },
        {
          key: 'fuelAtStart', label: 'Топл. нач.', sortable: true, align: 'right' as const, render: (w) => {
            const val = Number(w.fuelAtStart);
            const isError = val < 0 || (w.tankCapacity && val > w.tankCapacity);
            return <span className={isError ? 'text-red-600 font-semibold' : ''} title={isError ? `Ёмкость бака: ${w.tankCapacity ?? '?'} л` : undefined}>{w.fuelAtStart ?? '—'}</span>;
          }
        },
        { key: 'fuelReceived', label: 'Запр.', sortable: true, align: 'center' as const, render: (w) => <span className="text-green-600 dark:text-green-400 font-medium">{(w as any).fuelReceived > 0 ? `+${(w as any).fuelReceived}` : '—'}</span> },
        {
          key: 'fuelAtEnd', label: 'Топл. кон.', sortable: true, align: 'right' as const, render: (w) => {
            const val = Number(w.fuelAtEnd);
            const isError = val < 0 || (w.tankCapacity && val > w.tankCapacity);
            return <span className={isError ? 'text-red-600 font-semibold' : ''} title={isError ? `Ёмкость бака: ${w.tankCapacity ?? '?'} л` : undefined}>{w.fuelAtEnd ?? '—'}</span>;
          }
        },
        { key: 'status', label: 'Статус', sortable: true, align: 'center' as const, render: (w) => <WaybillStatusBadge status={w.status} /> },
      ];
    }
    return [
      { key: 'number', label: 'Номер', sortable: true, align: 'center' as const, render: (w) => <span className="font-medium text-gray-900 dark:text-white">{w.number}</span> },
      { key: 'date', label: 'Дата', sortable: true, align: 'center' as const, render: (w) => new Date(w.date).toLocaleDateString('ru-RU') },
      { key: 'vehicle', label: 'ТС', sortable: true, align: 'center' as const },
      { key: 'driver', label: 'Водитель', sortable: true, align: 'center' as const },
      { key: 'organizationId', label: 'Организация', sortable: true, align: 'center' as const },
      { key: 'status', label: 'Статус', sortable: true, align: 'center' as const, render: (w) => <WaybillStatusBadge status={w.status} /> },
    ];
  }, [isExtendedView]);

  const { columns, sensors, onDragEnd } = useColumnPersistence(
    waybillColumns,
    isExtendedView ? 'waybills-extended' : 'waybills-standard'
  );

  const activeColumn = columns.find(c => c.key === activeId);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize] = useState(50); // fixed page size

  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [modalProps, setModalProps] = useState({ title: '', message: '', confirmText: '', confirmButtonClass: '', onConfirm: () => { } });

  const { showToast } = useToast();
  const { appSettings } = useAuth();

  const setSelectedVehicleId = (vehicleId: string) => {
    setSelectedVehicleIdState(vehicleId);
    try {
      localStorage.setItem(VEHICLE_FILTER_KEY, vehicleId);
    } catch (e) {
      console.error('Failed to save vehicle filter to localStorage', e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [waybillsResponse, vehiclesData, driversData, organizationsData] = await Promise.all([
        getWaybills({
          page: currentPage,
          limit: pageSize,
          status: topLevelFilter.status || undefined,
          startDate: topLevelFilter.dateFrom || undefined,
          endDate: topLevelFilter.dateTo || undefined,
          vehicleId: selectedVehicleId || undefined,
        }),
        getVehicles(),
        listDrivers(),
        getOrganizations()
      ]);

      setWaybills(waybillsResponse.waybills);
      if (waybillsResponse.pagination) {
        setTotalPages(waybillsResponse.pagination.pages);
        setTotalRecords(waybillsResponse.pagination.total);
      }
      setVehicles(vehiclesData);
      setDrivers(driversData);
      setOrganizations(organizationsData);
    } catch (err: any) {
      console.error('Failed to fetch waybills:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = subscribe((msg) => {
      if (msg.topic === 'waybills' || msg.topic === 'employees' || msg.topic === 'vehicles' || msg.topic === 'organizations' || msg.topic === 'blanks') {
        fetchData();
      }
    });
    return unsubscribe;
  }, [currentPage, topLevelFilter.status, topLevelFilter.dateFrom, topLevelFilter.dateTo, selectedVehicleId]);

  useEffect(() => {
    if (waybillToOpen) {
      setSelectedWaybillId(waybillToOpen);
      setWaybillToPrefill(null);
      setIsDetailViewOpen(true);
      onWaybillOpened();
    }
  }, [waybillToOpen, onWaybillOpened]);

  // FIX: Reset stale vehicle filter from localStorage if it doesn't exist in current org
  useEffect(() => {
    if (!loading && vehicles.length > 0 && selectedVehicleId) {
      const exists = vehicles.some(v => v.id === selectedVehicleId);
      if (!exists) {
        console.warn('Resetting stale vehicle filter:', selectedVehicleId);
        setSelectedVehicleId('');
      }
    }
  }, [vehicles, selectedVehicleId, loading]);


  const preFilteredWaybills = useMemo(() => {
    return waybills.filter(w => {
      const date = new Date(w.date);
      const from = topLevelFilter.dateFrom ? new Date(topLevelFilter.dateFrom) : null;
      const to = topLevelFilter.dateTo ? new Date(topLevelFilter.dateTo) : null;

      if (from && date < from) return false;
      if (to && date > to) return false;
      if (topLevelFilter.status && w.status !== topLevelFilter.status) return false;
      // Client-side vehicle filtering removed as it is now handled by the backend
      // if (selectedVehicleId && w.vehicleId !== selectedVehicleId) return false;

      return true;
    });
  }, [waybills, topLevelFilter]);



  const enrichedData = useMemo(() => {
    return preFilteredWaybills.map((w, index) => {
      const driver = drivers.find(d => d.id === w.driverId);
      const vehicle = vehicles.find(v => v.id === w.vehicleId);
      const organization = organizations.find(o => o.id === w.organizationId);

      // Determine what to display in Organization column:
      // 1. If driver has departmentId (subdivision), show it
      // 2. Else if vehicle has organizationId that is a subdivision (has parentOrganizationId), show it
      // 3. Else show main organization shortName
      let organizationDisplay = organization?.shortName || w.organizationId;

      // Priority 1: Driver's department (subdivision)
      if (driver?.departmentId) {
        const subdivision = organizations.find(o => o.id === driver.departmentId);
        if (subdivision) {
          organizationDisplay = subdivision.shortName;
        }
      }
      // Priority 2: Vehicle's organization if it's a subdivision
      else if (vehicle?.organizationId) {
        const vehicleOrg = organizations.find(o => o.id === vehicle.organizationId);
        if (vehicleOrg?.parentOrganizationId) {
          // This is a subdivision
          organizationDisplay = vehicleOrg.shortName;
        }
      }

      // WB-REG-001 FIX E: Map fuelLines to display columns
      const firstFuel = (w as any).fuelLines?.[0];

      return {
        ...w,
        rowNumber: index + 1,
        mileage: (w.odometerEnd ?? w.odometerStart) - w.odometerStart,
        driver: driver?.fullName || w.driverId,
        vehicle: vehicle ? `${vehicle.brand} ${vehicle.registrationNumber}` : w.vehicleId,
        organizationId: organizationDisplay,
        // WB-REG-001: Use fuelLines data if available
        fuelAtStart: firstFuel?.fuelStart ?? w.fuelAtStart,
        fuelReceived: firstFuel?.fuelReceived ?? (w as any).fuelReceived ?? 0,
        fuelAtEnd: firstFuel?.fuelEnd ?? w.fuelAtEnd,
        // FUEL-OVERFLOW-UI: Tank capacity for overflow detection
        tankCapacity: vehicle?.fuelTankCapacity,
      };
    });
  }, [preFilteredWaybills, drivers, vehicles, organizations]);


  const {
    rows,
    sortColumn,
    sortDirection,
    handleSort,
    filters,
    handleFilterChange,
  } = useTable(enrichedData, columns as any); // cast to any to handle dynamic columns

  const handleCreateNew = async () => {
    const latestWaybill = await getLatestWaybill();
    setWaybillToPrefill(latestWaybill);
    setSelectedWaybillId(null);
    setIsDetailViewOpen(true);
  };

  const handleEdit = (waybill: Waybill) => {
    setSelectedWaybillId(waybill.id);
    setWaybillToPrefill(null);
    setIsDetailViewOpen(true);
  };

  const handleRequestDelete = (waybill: EnrichedWaybill) => {
    // BLK-DEL-ACTION-001: Ask user what to do with blank
    const hasBlank = !!waybill.blankId;

    setModalProps({
      title: 'Удаление путевого листа',
      message: hasBlank
        ? `Удалить путевой лист №${waybill.number}?\n\nЧто сделать с бланком?`
        : `Удалить путевой лист №${waybill.number}?`,
      confirmText: hasBlank ? 'Списать бланк' : 'Удалить',
      confirmButtonClass: hasBlank ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      onConfirm: () => {
        setIsConfirmationModalOpen(false);
        handleConfirmDelete(waybill.id, 'spoil');
      },
      secondaryAction: hasBlank ? {
        text: 'Вернуть водителю',
        className: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        onClick: () => {
          setIsConfirmationModalOpen(false);
          handleConfirmDelete(waybill.id, 'return');
        },
      } : undefined,
    } as any);
    setIsConfirmationModalOpen(true);
  };

  const handleConfirmDelete = async (waybillId: string, blankAction: 'return' | 'spoil') => {
    try {
      await deleteWaybill(waybillId, blankAction);
      const actionText = blankAction === 'spoil' ? 'Бланк списан.' : 'Бланк возвращён водителю.';
      showToast(`Путевой лист удалён. ${actionText}`, 'info');
      fetchData();
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  };

  // Bulk Delete Helpers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = rows.map(r => r.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    // BLK-DEL-ACTION-001: Bulk delete with blank action choice
    const onConfirmBulkDelete = async (blankAction: 'return' | 'spoil') => {
      setIsConfirmationModalOpen(false);
      try {
        const result = await bulkDeleteWaybills(Array.from(selectedIds), blankAction);
        const actionText = blankAction === 'spoil' ? 'Бланки списаны.' : 'Бланки возвращены водителям.';
        if (result.errors.length > 0) {
          showToast(`Удалено: ${result.success.length}. Ошибок: ${result.errors.length}. ${actionText}`, 'error');
          console.error('Errors during bulk delete:', result.errors);
        } else {
          showToast(`Удалено путевых листов: ${result.success.length}. ${actionText}`, 'info');
        }
        setSelectedIds(new Set());
        fetchData();
      } catch (error) {
        showToast('Ошибка массового удаления: ' + (error as Error).message, 'error');
      }
    };

    setModalProps({
      title: 'Массовое удаление',
      message: `Выбрано элементов: ${selectedIds.size}.\n\nЧто сделать с бланками?`,
      confirmText: 'Списать бланки',
      confirmButtonClass: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
      onConfirm: () => onConfirmBulkDelete('spoil'),
      secondaryAction: {
        text: 'Вернуть водителям',
        className: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        onClick: () => onConfirmBulkDelete('return'),
      },
    } as any);
    setIsConfirmationModalOpen(true);
  };

  // WB-BULK-POST: Bulk posting/submitting handler
  // In Central mode: DRAFT → SUBMITTED (send for review)
  // In Local mode: DRAFT → POSTED (direct posting)
  const isCentralMode = appSettings?.appMode === 'central';
  const targetStatus = isCentralMode ? WaybillStatus.SUBMITTED : WaybillStatus.POSTED;
  const actionLabel = isCentralMode ? 'Отправить на проверку' : 'Провести';

  const handleBulkPost = () => {
    if (selectedIds.size === 0) return;

    // Check if all selected waybills are DRAFT
    const selectedWaybills = rows.filter(w => selectedIds.has(w.id));
    const nonDraftWaybills = selectedWaybills.filter(w => w.status !== WaybillStatus.DRAFT);

    if (nonDraftWaybills.length > 0) {
      showToast(`Для ${isCentralMode ? 'отправки' : 'проведения'} выберите только черновики. Найдено не-черновиков: ${nonDraftWaybills.length}`, 'error');
      return;
    }

    const onConfirmBulkPost = async () => {
      setIsConfirmationModalOpen(false);
      try {
        const result = await bulkChangeWaybillStatus(
          Array.from(selectedIds),
          targetStatus
        );

        // WB-BULK-SEQ: Check if processing was stopped due to error
        if (result.stoppedDueToError) {
          const firstError = result.failed[0];
          const skippedCount = result.skippedIds?.length || 0;
          const errorDetail = firstError ? `${firstError.number}: ${firstError.error}` : '';
          showToast(
            `⚠️ Обработка остановлена! ${isCentralMode ? 'Отправлено' : 'Проведено'}: ${result.success}. ` +
            `Ошибка в ${firstError?.number || 'ПЛ'}: ${firstError?.error || 'неизвестная ошибка'}. ` +
            `Пропущено: ${skippedCount}.`,
            'error'
          );
          console.error('Bulk post stopped due to error:', result);
        } else if (result.failed.length > 0) {
          const firstError = result.failed[0];
          const errorDetail = firstError ? `${firstError.number}: ${firstError.error}` : '';
          showToast(`${isCentralMode ? 'Отправлено' : 'Проведено'}: ${result.success}. Ошибок: ${result.failed.length}. ${errorDetail}`, 'error');
          console.error('Errors during bulk post:', result.failed);
        } else {
          showToast(`${isCentralMode ? 'Отправлено на проверку' : 'Проведено путевых листов'}: ${result.success}`, 'success');
        }
        setSelectedIds(new Set());
        fetchData();
      } catch (error) {
        showToast(`Ошибка ${isCentralMode ? 'массовой отправки' : 'массового проведения'}: ` + (error as Error).message, 'error');
      }
    };

    setModalProps({
      title: isCentralMode ? 'Массовая отправка на проверку' : 'Массовое проведение',
      message: `Выбрано элементов: ${selectedIds.size}. ${isCentralMode ? 'Отправить на проверку' : 'Провести'}?`,
      confirmText: isCentralMode ? 'Отправить выбранные' : 'Провести выбранные',
      confirmButtonClass: isCentralMode ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      onConfirm: onConfirmBulkPost,
    } as any);
    setIsConfirmationModalOpen(true);
  };

  // WB-BULK-APPROVE: Approve SUBMITTED waybills → POSTED (Central mode only)
  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;

    const selectedWaybills = rows.filter(w => selectedIds.has(w.id));
    const nonSubmittedWaybills = selectedWaybills.filter(w => w.status !== WaybillStatus.SUBMITTED);

    if (nonSubmittedWaybills.length > 0) {
      showToast(`Для проведения выберите только отправленные на проверку. Найдено других: ${nonSubmittedWaybills.length}`, 'error');
      return;
    }

    const onConfirmBulkApprove = async () => {
      setIsConfirmationModalOpen(false);
      try {
        const result = await bulkChangeWaybillStatus(
          Array.from(selectedIds),
          WaybillStatus.POSTED
        );

        // WB-BULK-SEQ: Check if processing was stopped due to error
        if (result.stoppedDueToError) {
          const firstError = result.failed[0];
          const skippedCount = result.skippedIds?.length || 0;
          showToast(
            `⚠️ Обработка остановлена! Проведено: ${result.success}. ` +
            `Ошибка в ${firstError?.number || 'ПЛ'}: ${firstError?.error || 'неизвестная ошибка'}. ` +
            `Пропущено: ${skippedCount}.`,
            'error'
          );
          console.error('Bulk approve stopped due to error:', result);
        } else if (result.failed.length > 0) {
          const firstError = result.failed[0];
          const errorDetail = firstError ? `${firstError.number}: ${firstError.error}` : '';
          showToast(`Проведено: ${result.success}. Ошибок: ${result.failed.length}. ${errorDetail}`, 'error');
          console.error('Errors during bulk approve:', result.failed);
        } else {
          showToast(`Проведено путевых листов: ${result.success}`, 'success');
        }
        setSelectedIds(new Set());
        fetchData();
      } catch (error) {
        showToast('Ошибка массового проведения: ' + (error as Error).message, 'error');
      }
    };

    setModalProps({
      title: 'Массовое проведение',
      message: `Выбрано элементов: ${selectedIds.size}. Провести отправленные на проверку?`,
      confirmText: 'Провести выбранные',
      confirmButtonClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      onConfirm: onConfirmBulkApprove,
    } as any);
    setIsConfirmationModalOpen(true);
  };

  // WB-BULK-CORRECT: Revert POSTED waybills → DRAFT (Корректировка)
  const handleBulkCorrection = () => {
    if (selectedIds.size === 0) return;

    const selectedWbs = rows.filter(w => selectedIds.has(w.id));
    const nonPostedWaybills = selectedWbs.filter(w => w.status !== WaybillStatus.POSTED);

    if (nonPostedWaybills.length > 0) {
      showToast(`Для корректировки выберите только проведенные ПЛ. Найдено других: ${nonPostedWaybills.length}`, 'error');
      return;
    }

    const onConfirmBulkCorrection = async () => {
      setIsConfirmationModalOpen(false);
      try {
        const result = await bulkChangeWaybillStatus(
          Array.from(selectedIds),
          WaybillStatus.DRAFT,
          'Массовая корректировка'
        );

        if (result.failed.length > 0) {
          const firstError = result.failed[0];
          const errorDetail = firstError ? `${firstError.number}: ${firstError.error}` : '';
          showToast(`Откорректировано: ${result.success}. Ошибок: ${result.failed.length}. ${errorDetail}`, 'error');
          console.error('Errors during bulk correction:', result.failed);
        } else {
          showToast(`Откорректировано путевых листов: ${result.success}`, 'success');
        }
        setSelectedIds(new Set());
        fetchData();
      } catch (error) {
        showToast('Ошибка массовой корректировки: ' + (error as Error).message, 'error');
      }
    };

    setModalProps({
      title: 'Массовая корректировка',
      message: `Выбрано проведенных ПЛ: ${selectedIds.size}. Вернуть в черновик для корректировки?`,
      confirmText: 'Откорректировать выбранные',
      confirmButtonClass: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
      onConfirm: onConfirmBulkCorrection,
    } as any);
    setIsConfirmationModalOpen(true);
  };

  // WB-BULK-RETURN: Return SUBMITTED waybills → DRAFT (Вернуть на доработку) - Central mode only
  const handleBulkReturnForRevision = () => {
    if (selectedIds.size === 0) return;

    const selectedWbs = rows.filter(w => selectedIds.has(w.id));
    const nonSubmittedWaybills = selectedWbs.filter(w => w.status !== WaybillStatus.SUBMITTED);

    if (nonSubmittedWaybills.length > 0) {
      showToast(`Для возврата на доработку выберите только отправленные ПЛ. Найдено других: ${nonSubmittedWaybills.length}`, 'error');
      return;
    }

    const onConfirmBulkReturn = async () => {
      setIsConfirmationModalOpen(false);
      try {
        const result = await bulkChangeWaybillStatus(
          Array.from(selectedIds),
          WaybillStatus.DRAFT,
          'Возврат на доработку'
        );

        if (result.failed.length > 0) {
          const firstError = result.failed[0];
          const errorDetail = firstError ? `${firstError.number}: ${firstError.error}` : '';
          showToast(`Возвращено: ${result.success}. Ошибок: ${result.failed.length}. ${errorDetail}`, 'error');
          console.error('Errors during bulk return:', result.failed);
        } else {
          showToast(`Возвращено на доработку: ${result.success}`, 'success');
        }
        setSelectedIds(new Set());
        fetchData();
      } catch (error) {
        showToast('Ошибка возврата: ' + (error as Error).message, 'error');
      }
    };

    setModalProps({
      title: 'Вернуть на доработку',
      message: `Выбрано ПЛ на проверке: ${selectedIds.size}. Вернуть на доработку?`,
      confirmText: 'Вернуть на доработку',
      confirmButtonClass: 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-400',
      onConfirm: onConfirmBulkReturn,
    } as any);
    setIsConfirmationModalOpen(true);
  };

  // Calculate which bulk action buttons to show based on selected statuses
  const selectedWaybills = useMemo(() => rows.filter(w => selectedIds.has(w.id)), [rows, selectedIds]);
  const hasSelectedDrafts = selectedWaybills.some(w => w.status === WaybillStatus.DRAFT);
  const hasSelectedSubmitted = selectedWaybills.some(w => w.status === WaybillStatus.SUBMITTED);
  const hasSelectedPosted = selectedWaybills.some(w => w.status === WaybillStatus.POSTED);

  // P0-5: Parent-level navigation guard
  const [pendingClose, setPendingClose] = useState(false);
  const [canCloseCallback, setCanCloseCallback] = useState<(() => void) | null>(null);

  const handleCloseDetail = () => {
    setIsDetailViewOpen(false);
    setSelectedWaybillId(null);
    setWaybillToPrefill(null);
    fetchData(); // Refetch data after closing detail view
  };

  const handleRequestClose = () => {
    // P0-5: Request close from detail - detail will check isDirty and call callback
    if (canCloseCallback) {
      canCloseCallback();
    } else {
      // Fallback if detail doesn't use callback pattern
      handleCloseDetail();
    }
  };

  // BUGFIX-LOOP: Memoize selectedWaybill to prevent infinite re-renders of child
  // Move out of IF to follow Rules of Hooks
  const selectedWaybill = useMemo(() => {
    return selectedWaybillId
      ? { id: selectedWaybillId } as Waybill
      : waybillToPrefill;
  }, [selectedWaybillId, waybillToPrefill]);

  if (isDetailViewOpen) {
    // WB-REG-001 FIX B/D: For editing, pass only ID so WaybillDetail loads full data from backend
    // For prefill, pass the waybill data for copying
    const isPrefill = !selectedWaybillId && !!waybillToPrefill;
    // WB-REG-001 FIX B: key prop forces React to re-create component on ID change
    // BUGFIX: Use stable key for new waybills (not Date.now() which changes on every render!)
    const stableKey = selectedWaybillId || (waybillToPrefill?.id ? `prefill-${waybillToPrefill.id}` : 'new');
    return <WaybillDetail key={stableKey} waybill={selectedWaybill} isPrefill={isPrefill} onClose={handleCloseDetail} />;
  }

  const renderActionButtons = (waybill: EnrichedWaybill) => {
    // P0-F: Check if delete should be hidden for POSTED waybills
    const canDelete = waybill.status !== WaybillStatus.POSTED || appSettings?.allowDeletePostedWaybills;

    const handlePrint = async () => {
      try {
        // Fetch full waybill data
        const fullWaybill = await getWaybillById(waybill.id);

        // Fetch related data
        const [employees, orgsData, stockItemsData] = await Promise.all([
          getEmployees({}),
          getOrganizations(),
          getStockItems()
        ]);

        // Find vehicle from local state
        const vehicle = vehicles.find(v => v.id === fullWaybill.vehicleId);

        // Find driver (need to match Driver.id to Employee via drivers list)
        const driverItem = drivers.find(d => d.id === fullWaybill.driverId);
        const driver = driverItem ? employees.find(e => e.id === driverItem.employeeId) : undefined;

        // Find dispatcher/controller
        const dispatcher = employees.find(e => e.id === fullWaybill.dispatcherEmployeeId);
        const controller = employees.find(e => e.id === fullWaybill.controllerEmployeeId);

        // Find organization
        const organization = orgsData.find(o => o.id === fullWaybill.organizationId);

        // Find fuel type from vehicle's fuelStockItemId
        const fuelType = vehicle?.fuelStockItemId
          ? stockItemsData.find(si => si.id === vehicle.fuelStockItemId)
          : undefined;

        setPrintData({
          waybill: fullWaybill,
          vehicle,
          driver,
          dispatcher,
          controller,
          organization,
          fuelType,
          allOrganizations: orgsData
        });
        setIsPrintModalOpen(true);
      } catch (err) {
        showToast('Ошибка загрузки данных для печати', 'error');
        console.error('Print data fetch error:', err);
      }
    };

    return (
      <div className="px-6 py-4 flex justify-center gap-1 whitespace-nowrap">
        <button onClick={() => handleEdit(waybill)} className="p-2 text-blue-500 transition-all duration-200 transform hover:scale-110" title="Редактировать"><PencilIcon className="h-5 w-5" /></button>
        <button onClick={handlePrint} className="p-2 text-teal-600 hover:text-teal-700 dark:text-teal-500 dark:hover:text-teal-400 transition-all duration-200 transform hover:scale-110" title="Печать"><PrintIcon className="h-5 w-5" /></button>
        {canDelete && (
          <button onClick={() => handleRequestDelete(waybill)} className="p-2 text-red-500 transition-all duration-200 transform hover:scale-110" title="Удалить"><TrashIcon className="h-5 w-5" /></button>
        )}
      </div>
    );
  };

  return (
    <>
      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        {...modalProps}
      />
      <SeasonSettingsModal
        isOpen={isSeasonModalOpen}
        onClose={() => setIsSeasonModalOpen(false)}
      />
      {isBatchModalOpen && (
        <BatchGeneratorModal
          onClose={() => setIsBatchModalOpen(false)}
          onSuccess={() => { setIsBatchModalOpen(false); fetchData(); }}
        />
      )}
      {isCheckModalOpen && (
        <WaybillCheckModal
          isOpen={isCheckModalOpen}
          onClose={() => setIsCheckModalOpen(false)}
          onOpenWaybill={(id) => { setIsCheckModalOpen(false); handleEdit({ id } as any); }}
        />
      )}
      {isRecalculateModalOpen && (
        <RecalculateModal
          isOpen={isRecalculateModalOpen}
          onClose={() => setIsRecalculateModalOpen(false)}
          onSuccess={() => { setIsRecalculateModalOpen(false); fetchData(); }}
          vehicles={vehicles}
          onOpenWaybill={(id) => { setIsRecalculateModalOpen(false); handleEdit({ id } as any); }}
        />
      )}
      {isPrintModalOpen && printData && (
        <PrintableWaybill
          waybill={printData.waybill}
          vehicle={printData.vehicle}
          driver={printData.driver}
          organization={printData.organization}
          dispatcher={printData.dispatcher}
          controller={printData.controller}
          fuelType={printData.fuelType as any}
          allOrganizations={printData.allOrganizations}
          onClose={() => { setIsPrintModalOpen(false); setPrintData(null); }}
        />
      )}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        {/* Toolbar */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Путевые листы</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
              {totalRecords}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap w-full xl:w-auto">
            {selectedIds.size > 0 && (
              <>
                {/* In Central mode: show 'Отправить' for DRAFT, 'Провести' for SUBMITTED */}
                {/* In Local mode: show 'Провести' for DRAFT */}
                {hasSelectedDrafts && (
                  <Button onClick={handleBulkPost} variant={isCentralMode ? 'primary' : 'success'} size="sm" leftIcon={<CheckCircleIcon className="h-4 w-4" />}>
                    {actionLabel} ({selectedWaybills.filter(w => w.status === WaybillStatus.DRAFT).length})
                  </Button>
                )}
                {isCentralMode && hasSelectedSubmitted && (
                  <Button onClick={handleBulkApprove} variant="success" size="sm" leftIcon={<CheckCircleIcon className="h-4 w-4" />}>
                    Провести ({selectedWaybills.filter(w => w.status === WaybillStatus.SUBMITTED).length})
                  </Button>
                )}
                {isCentralMode && hasSelectedSubmitted && (
                  <Button onClick={handleBulkReturnForRevision} variant="outline" size="sm" leftIcon={<ArrowDownIcon className="h-4 w-4 rotate-90" />}>
                    Вернуть ({selectedWaybills.filter(w => w.status === WaybillStatus.SUBMITTED).length})
                  </Button>
                )}
                {hasSelectedPosted && (
                  <Button onClick={handleBulkCorrection} variant="warning" size="sm" leftIcon={<PencilIcon className="h-4 w-4" />}>
                    Корректировка ({selectedWaybills.filter(w => w.status === WaybillStatus.POSTED).length})
                  </Button>
                )}
                <Button onClick={handleBulkDelete} variant="danger" size="sm" leftIcon={<TrashIcon className="h-4 w-4" />}>
                  Удалить ({selectedIds.size})
                </Button>
              </>
            )}
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none">
              <div className="relative inline-block w-9 h-5 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" checked={isExtendedView} onChange={e => setIsExtendedView(e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 checked:right-0 checked:border-blue-600" />
                <label className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
              </div>
              <span>Расширенный</span>
            </label>
            <div className="hidden xl:block w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
            <Button onClick={() => setIsSeasonModalOpen(true)} variant="ghost" size="sm" leftIcon={<CalendarDaysIcon className="h-4 w-4 text-gray-500" />}>
              Сезоны
            </Button>
            <Button onClick={() => setIsRecalculateModalOpen(true)} variant="ghost" size="sm" leftIcon={<CalculatorIcon className="h-4 w-4 text-gray-500" />}>
              Пересчёт
            </Button>
            <Button onClick={() => setIsCheckModalOpen(true)} variant="ghost" size="sm" leftIcon={<ClipboardCheckIcon className="h-4 w-4 text-gray-500" />}>
              Проверка
            </Button>
            <Button onClick={() => setIsBatchModalOpen(true)} variant="outline" size="sm" leftIcon={<DocumentArrowUpIcon className="h-4 w-4" />}>
              Пакетная
            </Button>
            <Button onClick={handleCreateNew} variant="primary" size="sm" leftIcon={<PlusIcon className="h-4 w-4" />}>
              Создать новый
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-3 items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mr-2">
            <FunnelIcon className="h-4 w-4" /> Фильтры:
          </div>
          <input type="date" value={topLevelFilter.dateFrom} onChange={e => setTopLevelFilter({ ...topLevelFilter, dateFrom: e.target.value })} className="p-2 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Дата с" />
          <span className="text-gray-400 text-sm">–</span>
          <input type="date" value={topLevelFilter.dateTo} onChange={e => setTopLevelFilter({ ...topLevelFilter, dateTo: e.target.value })} className="p-2 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Дата по" />
          <select value={topLevelFilter.status} onChange={e => setTopLevelFilter({ ...topLevelFilter, status: e.target.value as WaybillStatus })} className="p-2 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-w-[120px]">
            <option value="">Все статусы</option>
            {Object.entries(WAYBILL_STATUS_TRANSLATIONS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} className="p-2 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-w-[120px]">
            <option value="">Все ТС</option>
            {vehicles.map(vehicle => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.brand} {vehicle.registrationNumber}
              </option>
            ))}
          </select>
          <select value={filters.driverId || ''} onChange={e => handleFilterChange('driverId', e.target.value)} className="p-2 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-w-[120px]">
            <option value="">Все водители</option>
            {drivers.map(driver => (
              <option key={driver.id} value={driver.id}>
                {driver.fullName}
              </option>
            ))}
          </select>
          {/* Reset filters button */}
          {(topLevelFilter.dateFrom || topLevelFilter.dateTo || topLevelFilter.status || selectedVehicleId || filters.driverId) && (
            <button
              onClick={() => {
                setTopLevelFilter({ dateFrom: '', dateTo: '', status: '' });
                setSelectedVehicleId('');
                handleFilterChange('driverId', '');
              }}
              className="ml-auto text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              Сбросить
            </button>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => { setActiveId(null); onDragEnd(e); }}
          onDragStart={(e) => setActiveId(String(e.active.id))}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="p-4 bg-gray-50 dark:bg-gray-700 sticky left-0 z-10">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        checked={rows.length > 0 && selectedIds.size === rows.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                      <label className="sr-only">Выбрать все</label>
                    </div>
                  </th>
                  <SortableContext items={columns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
                    {columns.map(col => (
                      <SortableHeader
                        key={col.key}
                        id={col.key}
                        asTh
                        className={`px-6 py-3 cursor-pointer bg-gray-50 dark:bg-gray-700 ${col.sortable ? 'hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors' : ''}`}
                        onClick={() => col.sortable && handleSort(col.key as any)}
                      >
                        <div className={`flex items-center gap-1 w-full ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                          {col.label}
                          {sortColumn === col.key && (sortDirection === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />)}
                        </div>
                      </SortableHeader>
                    ))}
                  </SortableContext>
                  <th scope="col" className="px-6 py-3 text-center bg-gray-50 dark:bg-gray-700 sticky right-0 z-10">Действия</th>
                </tr>
                {!isExtendedView && (
                  <tr>
                    <th className="bg-gray-50 dark:bg-gray-700 sticky left-0 z-10" />
                    {columns.map(col => (
                      <th key={`${col.key}-filter`} className="px-2 py-1 bg-gray-50 dark:bg-gray-700">
                        <input
                          type="text"
                          value={filters[col.key as string] || ''}
                          onChange={e => handleFilterChange(col.key as any, e.target.value)}
                          placeholder={`Поиск...`}
                          className="w-full text-xs p-1 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded"
                        />
                      </th>
                    ))}
                    <th className="px-2 py-1 bg-gray-50 dark:bg-gray-700 sticky right-0 z-10"></th>
                  </tr>
                )}
              </thead>
              <tbody>
                {loading || error || rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="p-0">
                      <EmptyState
                        reason={error ? getEmptyStateFromError(error) : (loading ? { type: 'loading' } : { type: 'empty', entityName: 'путевые листы' })}
                        onRetry={fetchData}
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map(w => {
                    return (
                      <tr key={w.id} className={'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-600 border-b dark:border-gray-700'}>
                        <td className="w-4 p-4 sticky left-0 bg-inherit z-10">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                              checked={selectedIds.has(w.id)}
                              onChange={(e) => handleSelectRow(w.id, e.target.checked)}
                            />
                          </div>
                        </td>
                        {columns.map(col => (
                          <td key={col.key} className={`px-6 py-4 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}>
                            {col.render ? col.render(w) : (w as any)[col.key]}
                          </td>
                        ))}
                        <td className="sticky right-0 bg-inherit z-10 text-center">
                          {renderActionButtons(w)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {typeof document !== 'undefined' && createPortal(
            <DragOverlay>
              {activeColumn ? (
                <div className="bg-white dark:bg-gray-800 shadow-xl p-4 rounded-lg border-2 border-blue-500 dark:border-blue-400 font-bold opacity-90 cursor-grabbing text-xs uppercase text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  {activeColumn.label}
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>

        {/* Pagination Controls - Innovations Style */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Страница <span className="font-semibold text-gray-700 dark:text-gray-200">{currentPage}</span> из <span className="font-semibold text-gray-700 dark:text-gray-200">{totalPages}</span>
            <span className="mx-2">|</span>
            Всего: <span className="font-semibold text-gray-700 dark:text-gray-200">{totalRecords}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Назад
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Вперед
            </button>
          </div>
        </div>
      </div >
    </>
  );
};

export default WaybillList;
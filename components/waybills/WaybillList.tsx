





import React, { useState, useEffect, useMemo, useRef } from 'react';
import { deleteWaybill, getWaybills, updateWaybill, getLatestWaybill, bulkDeleteWaybills, bulkChangeWaybillStatus } from '../../services/api/waybillApi';
import { getVehicles } from '../../services/api/vehicleApi';
import { Waybill, WaybillStatus, Vehicle } from '../../types';
import { listDrivers, DriverListItem } from '../../services/driverApi';
import { WAYBILL_STATUS_COLORS, WAYBILL_STATUS_TRANSLATIONS } from '../../constants';
import { PlusIcon, PencilIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, StatusCompletedIcon, CalendarDaysIcon, DocumentArrowUpIcon, ClipboardCheckIcon, FunnelIcon, CheckCircleIcon } from '../Icons';
import { Button } from '../shared/Button';
import { WaybillStatusBadge } from '../shared/StatusBadges';
// FIX: Changed import to a named import to resolve module resolution error.
import { WaybillDetail } from './WaybillDetail';
import useTable from '../../hooks/useTable';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import SeasonSettingsModal from './SeasonSettingsModal';
import BatchGeneratorModal from './BatchGeneratorModal';
import WaybillCheckModal from './WaybillCheckModal';
import { subscribe } from '../../services/bus';
import { EmptyState, getEmptyStateFromError } from '../common/EmptyState';
import { HttpError } from '../../services/httpClient';
import { useAuth } from '../../services/auth';


type EnrichedWaybill = Waybill & { mileage?: number; rowNumber?: number; };

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
      const [waybillsResponse, vehiclesData, driversData] = await Promise.all([
        getWaybills({
          page: currentPage,
          limit: pageSize,
          status: topLevelFilter.status || undefined,
          startDate: topLevelFilter.dateFrom || undefined,
          endDate: topLevelFilter.dateTo || undefined,
        }),
        getVehicles(),
        listDrivers()
      ]);

      setWaybills(waybillsResponse.waybills);
      if (waybillsResponse.pagination) {
        setTotalPages(waybillsResponse.pagination.pages);
        setTotalRecords(waybillsResponse.pagination.total);
      }
      setVehicles(vehiclesData);
      setDrivers(driversData);
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
  }, [currentPage, topLevelFilter.status, topLevelFilter.dateFrom, topLevelFilter.dateTo]);

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
      if (selectedVehicleId && w.vehicleId !== selectedVehicleId) return false;

      return true;
    });
  }, [waybills, topLevelFilter, selectedVehicleId]);

  const columns = useMemo(() => {
    if (isExtendedView) {
      return [
        { key: 'rowNumber', label: '№ п/п' },
        { key: 'number', label: '№ ПЛ' },
        { key: 'validFrom', label: 'Дата Выезда' },
        { key: 'validTo', label: 'Дата Возвращения' },
        { key: 'odometerStart', label: 'Пробег Начальный' },
        { key: 'odometerEnd', label: 'Пробег Конечный' },
        { key: 'mileage', label: 'Пробег по ПЛ' },
        { key: 'fuelAtStart', label: 'Топливо (выезд)' },
        { key: 'fuelReceived', label: 'Заправлено' },
        { key: 'fuelAtEnd', label: 'Топливо (возврат)' },
        { key: 'status', label: 'Статус' },
      ];
    }
    return [
      { key: 'number', label: '№ Путевого листа' },
      { key: 'date', label: 'Дата' },
      { key: 'vehicle', label: 'ТС' },
      { key: 'driver', label: 'Водитель' },
      { key: 'organization', label: 'Организация' },
      { key: 'status', label: 'Статус' },
    ];
  }, [isExtendedView]);

  const enrichedData = useMemo(() => {
    return preFilteredWaybills.map((w, index) => {
      const driver = drivers.find(d => d.id === w.driverId);
      const vehicle = vehicles.find(v => v.id === w.vehicleId);
      // WB-REG-001 FIX E: Map fuelLines to display columns
      const firstFuel = (w as any).fuelLines?.[0];

      return {
        ...w,
        rowNumber: index + 1,
        mileage: (w.odometerEnd ?? w.odometerStart) - w.odometerStart,
        driver: driver?.fullName || w.driverId,
        vehicle: vehicle ? `${vehicle.brand} ${vehicle.registrationNumber}` : w.vehicleId,
        // WB-REG-001: Use fuelLines data if available
        fuelAtStart: firstFuel?.fuelStart ?? w.fuelAtStart,
        fuelReceived: firstFuel?.fuelReceived ?? (w as any).fuelReceived ?? 0,
        fuelAtEnd: firstFuel?.fuelEnd ?? w.fuelAtEnd,
      };
    });
  }, [preFilteredWaybills, drivers, vehicles]);


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
    const onConfirmDelete = (markAsSpoiled: boolean) => {
      setIsConfirmationModalOpen(false);
      handleConfirmDelete(waybill.id, markAsSpoiled);
    };

    setModalProps({
      title: 'Подтвердить удаление',
      message: `Вы уверены, что хотите удалить путевой лист №${waybill.number}? Пометить бланк как испорченный?`,
      confirmText: 'Да, пометить испорченным',
      confirmButtonClass: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
      onConfirm: () => onConfirmDelete(true),
      // We'll add a second button for the "No" case
      secondaryAction: {
        text: 'Нет, вернуть в пачку',
        className: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        onClick: () => onConfirmDelete(false),
      },
    } as any);
    setIsConfirmationModalOpen(true);
  };

  const handleConfirmDelete = async (waybillId: string, markAsSpoiled: boolean) => {
    try {
      await deleteWaybill(waybillId);
      showToast('Путевой лист удален.', 'info');
      fetchData();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setIsConfirmationModalOpen(false);
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

    const onConfirmBulkDelete = async () => {
      setIsConfirmationModalOpen(false);
      try {
        const result = await bulkDeleteWaybills(Array.from(selectedIds));
        if (result.errors.length > 0) {
          showToast(`Удалено: ${result.success.length}. Ошибок: ${result.errors.length}`, 'error');
          console.error('Errors during bulk delete:', result.errors);
        } else {
          showToast(`Удалено путевых листов: ${result.success.length}`, 'info');
        }
        setSelectedIds(new Set());
        fetchData();
      } catch (error) {
        showToast('Ошибка массового удаления: ' + (error as Error).message, 'error');
      }
    };

    setModalProps({
      title: 'Массовое удаление',
      message: `Выбрано элементов: ${selectedIds.size}. Удалить их?`,
      confirmText: 'Удалить выбранные',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      onConfirm: onConfirmBulkDelete,
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

        if (result.failed.length > 0) {
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

        if (result.failed.length > 0) {
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

    return (
      <td className="px-6 py-4 text-center whitespace-nowrap">
        <button onClick={() => handleEdit(waybill)} className="p-2 text-blue-500 transition-all duration-200 transform hover:scale-110" title="Редактировать"><PencilIcon className="h-5 w-5" /></button>
        {canDelete && (
          <button onClick={() => handleRequestDelete(waybill)} className="p-2 text-red-500 transition-all duration-200 transform hover:scale-110" title="Удалить"><TrashIcon className="h-5 w-5" /></button>
        )}
      </td>
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="p-4">
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
                {columns.map(col => (
                  <th key={col.key as string} scope="col" className="px-6 py-3 cursor-pointer" onClick={() => handleSort(col.key as any)}>
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortColumn === col.key && (sortDirection === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />)}
                    </div>
                  </th>
                ))}
                <th scope="col" className="px-6 py-3 text-center">Действия</th>
              </tr>
              {!isExtendedView && (
                <tr>
                  <th />
                  {columns.map(col => (
                    <th key={`${col.key}-filter`} className="px-2 py-1">
                      <input
                        type="text"
                        value={filters[col.key as string] || ''}
                        onChange={e => handleFilterChange(col.key as any, e.target.value)}
                        placeholder={`Поиск...`}
                        className="w-full text-xs p-1 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded"
                      />
                    </th>
                  ))}
                  <th className="px-2 py-1"></th>
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
                  const colors = WAYBILL_STATUS_COLORS[w.status];
                  return (
                    <tr key={w.id} className={'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-600 border-b dark:border-gray-700'}>
                      <td className="w-4 p-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            checked={selectedIds.has(w.id)}
                            onChange={(e) => handleSelectRow(w.id, e.target.checked)}
                          />
                        </div>
                      </td>
                      {isExtendedView ? (
                        <>
                          <td className="px-6 py-4">{w.rowNumber}</td>
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{w.number}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{w.validFrom ? new Date(w.validFrom).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{w.validTo ? new Date(w.validTo).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td className="px-6 py-4">{w.odometerStart}</td>
                          <td className="px-6 py-4">{w.odometerEnd ?? '—'}</td>
                          <td className="px-6 py-4">{w.mileage}</td>
                          <td className={`px-6 py-4 ${Number(w.fuelAtStart) < 0 ? 'text-red-600' : ''}`}>{w.fuelAtStart ?? '—'}</td>
                          <td className="px-6 py-4 text-green-600 dark:text-green-400 font-medium">{(w as any).fuelReceived > 0 ? `+${(w as any).fuelReceived}` : '—'}</td>
                          <td className={`px-6 py-4 ${Number(w.fuelAtEnd) < 0 ? 'text-red-600' : ''}`}>{w.fuelAtEnd ?? '—'}</td>
                          <td className="px-6 py-4">
                            <WaybillStatusBadge status={w.status} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{w.number}</td>
                          <td className="px-6 py-4">{new Date(w.date).toLocaleDateString('ru-RU')}</td>
                          <td className="px-6 py-4">{w.vehicle}</td>
                          <td className="px-6 py-4">{w.driver}</td>
                          <td className="px-6 py-4">{w.organizationId}</td>
                          <td className="px-6 py-4">
                            <WaybillStatusBadge status={w.status} />
                          </td>
                        </>
                      )}
                      {renderActionButtons(w)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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
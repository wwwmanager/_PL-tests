import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Vehicle, Employee, VehicleStatus, Organization } from '../../types';
import { VehicleModel, getVehicleModels } from '../../services/api/vehicleModelApi';
import { getVehicles, updateVehicle, deleteVehicle } from '../../services/api/vehicleApi';
import { getEmployees } from '../../services/api/employeeApi';
import { getStockItems, StockItem } from '../../services/stockItemApi';
import { getOrganizations } from '../../services/organizationApi';
import { PencilIcon, TrashIcon, PlusIcon, ArchiveBoxIcon, ArrowUpTrayIcon, TruckIcon } from '../Icons';
import DataTable, { Column } from '../shared/DataTable';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import { EmptyState, getEmptyStateFromError, type EmptyStateReason } from '../common/EmptyState';
import { VEHICLE_STATUS_TRANSLATIONS } from '../../constants';
import { VehicleEditModal } from './VehicleEditModal';

// --- Main Component ---
export const VehicleList: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [fuelItems, setFuelItems] = useState<StockItem[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [models, setModels] = useState<VehicleModel[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<EmptyStateReason | null>(null);
    const [actionModal, setActionModal] = useState<{ isOpen: boolean; type?: 'delete' | 'archive' | 'unarchive'; item?: Vehicle }>({ isOpen: false });
    const [showArchived, setShowArchived] = useState(false);
    const { showToast } = useToast();

    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    // const { showToast } = useToast(); // Duplicate declaration removed

    // Sections logic removed


    const fetchData = async () => {
        console.log('🔍 [VehicleList] fetchData called');
        try {
            setIsLoading(true);
            setLoadError(null);
            console.log('🔍 [VehicleList] Calling getVehicles()...');
            const [vehiclesData, fuelItemsData, employeesData, organizationsData, modelsData] = await Promise.all([
                getVehicles(),
                getStockItems({ categoryEnum: 'FUEL', isActive: true }),
                getEmployees(),
                getOrganizations(),
                getVehicleModels()
            ]);
            console.log('🔍 [VehicleList] Received data:', { vehiclesCount: vehiclesData.length });
            setVehicles(vehiclesData);
            setFuelItems(fuelItemsData);
            setEmployees(employeesData.filter(e => e.employeeType === 'driver'));
            setOrganizations(organizationsData);
            setModels(modelsData);
        } catch (e: any) {
            console.error('❌ [VehicleList] Error in fetchData:', e);
            setLoadError(getEmptyStateFromError(e));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [showToast]);

    const enrichedData = useMemo(() => {
        if (!vehicles || !employees) return [];
        return vehicles
            .filter(v => showArchived || v.status !== VehicleStatus.ARCHIVED)
            .map(v => ({
                ...v,
                driverName: employees.find(d => d.id === v.assignedDriverId)?.shortName || 'Не назначен',
            }));
    }, [vehicles, employees, showArchived]);


    type EnrichedVehicle = typeof enrichedData[0];

    const columns: Column<EnrichedVehicle>[] = useMemo(() => [
        { key: 'registrationNumber', label: 'Гос. номер', sortable: true, align: 'center' },
        {
            key: 'brand',
            label: 'Марка и модель',
            sortable: true,
            align: 'center',
            render: (v) => (
                <div className="flex flex-col items-center">
                    <span>{v.brand || v.model ? `${v.brand} ${v.model}`.trim() : '-'}</span>
                    {v.vehicleModel && (
                        <span className="text-xs text-gray-500">{v.vehicleModel.name}</span>
                    )}
                </div>
            )
        },
        { key: 'driverName', label: 'Водитель', sortable: true, align: 'center' },
        {
            key: 'mileage',
            label: 'Пробег, км',
            sortable: true,
            align: 'center',
            render: (v) => v.mileage?.toLocaleString('ru-RU')
        },
        {
            key: 'currentFuel',
            label: 'Текущий остаток, л',
            sortable: true,
            align: 'center',
            render: (v) => v.currentFuel !== undefined && v.currentFuel !== null
                ? v.currentFuel.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '-'
        },
        {
            key: 'status',
            label: 'Статус',
            sortable: true,
            align: 'center',
            render: (v) => (
                <Badge variant={v.status === VehicleStatus.ACTIVE ? 'success' : v.status === VehicleStatus.ARCHIVED ? 'neutral' : 'warning'}>
                    {VEHICLE_STATUS_TRANSLATIONS[v.status]}
                </Badge>
            )
        },
    ], []);

    const handleAddNew = () => {
        setSelectedVehicle(null);
        setIsModalOpen(true);
    };

    const handleEdit = (item: Vehicle) => {
        setSelectedVehicle(item);
        setIsModalOpen(true);
    };

    const handleCancel = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const handleSave = () => {
        fetchData();
        setIsModalOpen(false);
    };

    const openActionModal = (type: 'delete' | 'archive' | 'unarchive', item: Vehicle) => {
        setActionModal({ isOpen: true, type, item });
    };

    const closeActionModal = () => setActionModal({ isOpen: false });

    const handleConfirmAction = async () => {
        const { type, item } = actionModal;
        if (!item) return;

        try {
            if (type === 'delete') {
                await deleteVehicle(item.id);
                showToast(`ТС "${item.registrationNumber}" удалено.`, 'info');
            } else if (type === 'archive') {
                await updateVehicle({ ...item, status: VehicleStatus.ARCHIVED });
                showToast(`ТС "${item.registrationNumber}" архивировано.`, 'info');
            } else if (type === 'unarchive') {
                await updateVehicle({ ...item, status: VehicleStatus.ACTIVE });
                showToast(`ТС "${item.registrationNumber}" восстановлено.`, 'info');
            }
            fetchData();
        } catch (error) {
            showToast(`Не удалось выполнить действие.`, 'error');
        } finally {
            closeActionModal();
        }
    };

    const modalConfig = useMemo(() => {
        const { type, item } = actionModal;
        if (!type || !item) return { title: '', message: '', confirmText: '', confirmButtonClass: '' };

        switch (type) {
            case 'delete': return { title: 'Подтвердить удаление', message: `Удалить ТС "${item.registrationNumber}"?`, confirmText: 'Удалить', confirmButtonClass: 'bg-red-600 hover:bg-red-700' };
            case 'archive': return { title: 'Подтвердить архивацию', message: `Архивировать "${item.registrationNumber}"?`, confirmText: 'Архивировать', confirmButtonClass: 'bg-purple-600 hover:bg-purple-700' };
            case 'unarchive': return { title: 'Подтвердить восстановление', message: `Восстановить "${item.registrationNumber}" из архива?`, confirmText: 'Восстановить', confirmButtonClass: 'bg-green-600 hover:bg-green-700' };
            default: return { title: '', message: '', confirmText: '', confirmButtonClass: '' };
        }
    }, [actionModal]);


    return (
        <>
            <ConfirmationModal isOpen={actionModal.isOpen} onClose={closeActionModal} onConfirm={handleConfirmAction} {...modalConfig} />
            <VehicleEditModal
                isOpen={isModalOpen}
                onClose={handleCancel}
                onSave={handleSave}
                vehicle={selectedVehicle}
                employees={employees}
                organizations={organizations}
                fuelItems={fuelItems}
                models={models}
            />

            <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <TruckIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Транспорт</h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                            {enrichedData.length}
                        </span>
                    </div>
                    <Button onClick={handleAddNew} variant="primary" size="sm" leftIcon={<PlusIcon className="h-4 w-4" />}>
                        Добавить
                    </Button>
                </div>

                <DataTable
                    tableId="vehicle-list"
                    columns={columns}
                    data={enrichedData}
                    keyField="id"
                    searchable={true}
                    isLoading={isLoading}
                    error={loadError}
                    onRetry={fetchData}
                    actions={[
                        {
                            icon: <PencilIcon className="h-4 w-4" />,
                            onClick: (v) => handleEdit(v),
                            title: "Редактировать",
                            className: "text-blue-600 hover:text-blue-800"
                        },
                        {
                            icon: <ArchiveBoxIcon className="h-4 w-4" />,
                            onClick: (v) => openActionModal('archive', v),
                            title: "Архивировать",
                            className: "text-purple-600 hover:text-purple-800",
                            show: (v: any) => v.status === VehicleStatus.ACTIVE
                        },
                        {
                            icon: <ArrowUpTrayIcon className="h-4 w-4" />,
                            onClick: (v) => openActionModal('unarchive', v),
                            title: "Восстановить",
                            className: "text-green-600 hover:text-green-800",
                            show: (v: any) => v.status === VehicleStatus.ARCHIVED
                        },
                        {
                            icon: <TrashIcon className="h-4 w-4" />,
                            onClick: (v) => openActionModal('delete', v),
                            title: "Удалить",
                            className: "text-red-600 hover:text-red-800"
                        }
                    ]}
                />
            </div>
        </>
    );
};

export default VehicleList;

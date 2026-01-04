import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Vehicle, FuelType, Employee, VehicleStatus, MaintenanceRecord, Organization } from '../../types';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getVehicles, createVehicle as addVehicle, updateVehicle, deleteVehicle } from '../../services/api/vehicleApi';
import { getEmployees } from '../../services/api/employeeApi';
import { getStockItems, StockItem } from '../../services/stockItemApi';
import { getOrganizations } from '../../services/organizationApi';
import { validation } from '../../services/faker';
import { PencilIcon, TrashIcon, PlusIcon, ArchiveBoxIcon, ArrowUpTrayIcon, TruckIcon } from '../Icons';
import DataTable, { Column } from '../shared/DataTable';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import Modal from '../shared/Modal';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import CollapsibleSection from '../shared/CollapsibleSection';
import { EmptyState, getEmptyStateFromError, type EmptyStateReason } from '../common/EmptyState';
// FIX: Import VEHICLE_STATUS_COLORS and VEHICLE_STATUS_TRANSLATIONS to resolve compilation errors.
import { VEHICLE_STATUS_COLORS, VEHICLE_STATUS_TRANSLATIONS } from '../../constants';
import { FormField, FormInput, FormSelect, FormTextarea, FormCheckbox } from '../shared/FormComponents';

// --- Zod Schema for Validation ---
// FIX: Removed 'invalid_type_error' as it is not a recognized property in this context, causing a compilation error.
// Zod will still provide a default type error message.
const fuelConsumptionRatesSchema = z.object({
    summerRate: z.number().positive('Норма должна быть > 0'),
    winterRate: z.number().positive('Норма должна быть > 0'),
    cityIncreasePercent: z.number().min(0, "Надбавка не может быть отрицательной").optional().nullable(),
    warmingIncreasePercent: z.number().min(0, "Надбавка не может быть отрицательной").optional().nullable(),
});

const maintenanceRecordSchema = z.object({
    id: z.string().optional(),
    date: z.string().min(1, "Дата обязательна"),
    workType: z.string().min(1, "Тип работ обязателен"),
    mileage: z.number().min(0),
    description: z.string().optional().nullable(),
    performer: z.string().optional().nullable(),
    cost: z.number().optional().nullable(),
});

const vehicleSchema = z.object({
    id: z.string().optional(),
    registrationNumber: z.string().min(1, "Гос. номер обязателен").superRefine((val, ctx) => {
        const error = validation.registrationNumber(val);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    brand: z.string().min(1, "Марка/модель обязательна"),
    vin: z.string().min(1, "VIN обязателен").superRefine((val, ctx) => {
        const error = validation.vin(val);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    // FIX: Removed `required_error` which was causing a compilation issue. The field is still required by default.
    mileage: z.number().min(0, "Пробег не может быть отрицательным"),
    fuelStockItemId: z.string().min(1, "Тип топлива обязателен"),
    fuelTypeId: z.any().optional(), // Deprecated
    fuelConsumptionRates: fuelConsumptionRatesSchema,
    assignedDriverId: z.string().nullable(),
    organizationId: z.string().optional().nullable(),
    currentFuel: z.number().min(0).optional().nullable(),
    year: z.number().optional().nullable(),
    vehicleType: z.enum(['Легковой', 'Тягач', 'Прицеп', 'Автобус', 'Спецтехника']).optional().nullable(),
    status: z.nativeEnum(VehicleStatus),
    notes: z.string().optional().nullable(),
    ptsType: z.enum(['PTS', 'EPTS']).optional().nullable(),
    ptsSeries: z.string().optional().nullable(),
    ptsNumber: z.string().optional().nullable(),
    eptsNumber: z.string().optional().nullable(),
    diagnosticCardNumber: z.string().optional().nullable(),
    diagnosticCardIssueDate: z.string().optional().nullable(),
    diagnosticCardExpiryDate: z.string().optional().nullable(),
    maintenanceHistory: z.array(maintenanceRecordSchema).optional().nullable(),
    useCityModifier: z.boolean().optional(),
    useWarmingModifier: z.boolean().optional(),
    fuelTankCapacity: z.number().min(0).optional().nullable(),
    disableFuelCapacityCheck: z.boolean().optional(),
    osagoSeries: z.string().optional().nullable(),
    osagoNumber: z.string().optional().nullable(),
    osagoStartDate: z.string().optional().nullable(),
    osagoEndDate: z.string().optional().nullable(),
    storageLocationId: z.string().optional().nullable(),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

// --- Main Component ---
export const VehicleList: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [fuelItems, setFuelItems] = useState<StockItem[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<EmptyStateReason | null>(null);
    const [actionModal, setActionModal] = useState<{ isOpen: boolean; type?: 'delete' | 'archive' | 'unarchive'; item?: Vehicle }>({ isOpen: false });
    const [showArchived, setShowArchived] = useState(false);
    const { showToast } = useToast();

    const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<VehicleFormData>({
        resolver: zodResolver(vehicleSchema),
    });

    const currentId = watch("id");
    const currentregistrationNumber = watch("registrationNumber");

    const COLLAPSED_SECTIONS_KEY = 'vehicleList_collapsedSections';
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    useEffect(() => {
        localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(collapsedSections));
    }, [collapsedSections]);

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const fetchData = async () => {
        console.log('🔍 [VehicleList] fetchData called');
        try {
            setIsLoading(true);
            setLoadError(null);
            console.log('🔍 [VehicleList] Calling getVehicles()...');
            const [vehiclesData, fuelItemsData, employeesData, organizationsData] = await Promise.all([
                getVehicles(),
                getStockItems({ categoryEnum: 'FUEL', isActive: true }),
                getEmployees(),
                getOrganizations()
            ]);
            console.log('🔍 [VehicleList] Received data:', { vehiclesCount: vehiclesData.length });
            setVehicles(vehiclesData);
            setFuelItems(fuelItemsData);
            setEmployees(employeesData.filter(e => e.employeeType === 'driver'));
            setOrganizations(organizationsData);
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
        { key: 'brand', label: 'Марка и модель', sortable: true, align: 'center' },
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
        reset({
            status: VehicleStatus.ACTIVE,
            fuelConsumptionRates: { summerRate: 0, winterRate: 0 },
            assignedDriverId: null,
            organizationId: '',
        });
        setIsModalOpen(true);
    };

    const handleEdit = (item: Vehicle) => {
        reset(item);
        setIsModalOpen(true);
    };

    const handleCancel = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const onSubmit = async (data: VehicleFormData) => {
        // Логика нормализации status/isActive перенесена в sanitizeVehiclePayload (vehicleApi.ts)
        const dataToSave = {
            ...data,
            organizationId: data.organizationId === '' ? null : data.organizationId,
        };

        try {
            console.log('🔥 [VehicleList] SAVING:', JSON.stringify(dataToSave, null, 2));
            if (dataToSave.id) {
                await updateVehicle(dataToSave as Vehicle);
            } else {
                await addVehicle(dataToSave as Omit<Vehicle, 'id'>);
            }
            showToast("Изменения сохранены");
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            showToast("Не удалось сохранить изменения.", 'error');
        }
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
            <Modal
                isOpen={isModalOpen}
                onClose={handleCancel}
                isDirty={isDirty}
                title={currentId ? `Редактирование: ${currentregistrationNumber}` : 'Добавить ТС'}
                footer={
                    <>
                        <button onClick={handleCancel} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Отмена</button>
                        <button onClick={handleSubmit(onSubmit)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">Сохранить</button>
                    </>
                }
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <CollapsibleSection title="Основная информация" isCollapsed={collapsedSections.basic || false} onToggle={() => toggleSection('basic')}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField label="Гос. номер" error={errors.registrationNumber?.message} required><FormInput {...register("registrationNumber")} /></FormField>
                            <FormField label="Марка, модель" error={errors.brand?.message} required><FormInput {...register("brand")} /></FormField>
                            <FormField label="Организация" error={errors.organizationId?.message}>
                                <FormSelect {...register("organizationId")}>
                                    <option value="">-</option>
                                    {organizations.map(o => <option key={o.id} value={o.id}>{o.shortName}</option>)}
                                </FormSelect>
                            </FormField>
                            <FormField label="VIN" error={errors.vin?.message} required><FormInput {...register("vin")} /></FormField>
                            <FormField label="Год выпуска"><FormInput type="number" {...register("year", { valueAsNumber: true })} /></FormField>
                            <FormField label="Тип ТС"><FormSelect {...register("vehicleType")}><option value="">-</option><option>Легковой</option><option>Тягач</option><option>Прицеп</option><option>Автобус</option><option>Спецтехника</option></FormSelect></FormField>
                            <FormField label="Статус"><FormSelect {...register("status")}>{Object.values(VehicleStatus).map(s => <option key={s} value={s}>{VEHICLE_STATUS_TRANSLATIONS[s]}</option>)}</FormSelect></FormField>
                            <FormField label="Водитель"><FormSelect {...register("assignedDriverId")}><option value="">Не назначен</option>{employees.map(e => <option key={e.id} value={e.id}>{e.shortName}</option>)}</FormSelect></FormField>
                        </div>
                    </CollapsibleSection>
                    <CollapsibleSection title="Топливо и пробег" isCollapsed={collapsedSections.fuel || false} onToggle={() => toggleSection('fuel')}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                            <FormField label="Тип топлива" error={errors.fuelStockItemId?.message} required><FormSelect {...register("fuelStockItemId")}><option value="">-</option>{fuelItems.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</FormSelect></FormField>
                            <FormField label="Объем бака, л"><FormInput type="number" step="0.01" {...register("fuelTankCapacity", { valueAsNumber: true, setValueAs: v => v || null })} /></FormField>
                            <FormField label="Текущий остаток, л"><FormInput type="number" step="0.01" {...register("currentFuel", { valueAsNumber: true, setValueAs: v => v || null })} /></FormField>
                            <FormField label="Пробег, км" error={errors.mileage?.message} required><FormInput type="number" {...register("mileage", { valueAsNumber: true })} /></FormField>

                            <div className="md:col-span-3 grid grid-cols-2 gap-4">
                                <FormField label="Летняя норма" error={errors.fuelConsumptionRates?.summerRate?.message} required><FormInput type="number" step="0.1" {...register("fuelConsumptionRates.summerRate", { valueAsNumber: true })} /></FormField>
                                <FormField label="Зимняя норма" error={errors.fuelConsumptionRates?.winterRate?.message} required><FormInput type="number" step="0.1" {...register("fuelConsumptionRates.winterRate", { valueAsNumber: true })} /></FormField>
                            </div>

                            <div className="md:col-span-3 mt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 border rounded-lg dark:border-gray-600">
                                        <label className="flex items-center gap-2 mb-2">
                                            <FormCheckbox {...register("useCityModifier")} />
                                            <span className="font-medium text-gray-700 dark:text-gray-200">Городской цикл</span>
                                        </label>
                                        <FormField label="Надбавка, %" error={errors.fuelConsumptionRates?.cityIncreasePercent?.message}>
                                            <FormInput
                                                type="number"
                                                step="0.1"
                                                {...register("fuelConsumptionRates.cityIncreasePercent", { setValueAs: v => v === "" ? null : parseFloat(v) })}
                                                disabled={!watch("useCityModifier")}
                                            />
                                        </FormField>
                                    </div>
                                    <div className="p-4 border rounded-lg dark:border-gray-600">
                                        <label className="flex items-center gap-2 mb-2">
                                            <FormCheckbox {...register("useWarmingModifier")} />
                                            <span className="font-medium text-gray-700 dark:text-gray-200">Прогрев и работа на месте</span>
                                        </label>
                                        <FormField label="Надбавка, %" error={errors.fuelConsumptionRates?.warmingIncreasePercent?.message}>
                                            <FormInput
                                                type="number"
                                                step="0.1"
                                                {...register("fuelConsumptionRates.warmingIncreasePercent", { setValueAs: v => v === "" ? null : parseFloat(v) })}
                                                disabled={!watch("useWarmingModifier")}
                                            />
                                        </FormField>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-3 mt-2">
                                <label className="flex items-center gap-2">
                                    <FormCheckbox {...register("disableFuelCapacityCheck")} />
                                    <span className="text-sm text-gray-700 dark:text-gray-200">Отключить проверку на превышение объема бака</span>
                                </label>
                            </div>
                        </div>
                    </CollapsibleSection>
                </form>
            </Modal>

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

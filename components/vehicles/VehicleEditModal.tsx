import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Vehicle, VehicleStatus, Employee, Organization } from '../../types';
import { VehicleModel } from '../../services/api/vehicleModelApi';
import { StockItem } from '../../services/stockItemApi';
import { createVehicle, updateVehicle } from '../../services/api/vehicleApi';
import { getVehicleSets, VehicleSet } from '../../services/vehicleSetApi';
import { getVehicleAssets, VehicleAsset } from '../../services/vehicleAssetApi';
import { validation } from '../../services/faker';
import { useToast } from '../../hooks/useToast';
import Modal from '../shared/Modal';
import CollapsibleSection from '../shared/CollapsibleSection';
import { FormField, FormInput, FormSelect, FormCheckbox } from '../shared/FormComponents';
import { VEHICLE_STATUS_TRANSLATIONS } from '../../constants';
import { VehicleSetList } from './tabs/VehicleSetList';
import { VehicleAssetList } from './tabs/VehicleAssetList';

// --- Types & Schemas ---

const fuelConsumptionRatesSchema = z.object({
    summerRate: z.number().positive('Норма должна быть > 0').optional().nullable(),
    winterRate: z.number().positive('Норма должна быть > 0').optional().nullable(),
    cityIncreasePercent: z.number().min(0, "Надбавка не может быть отрицательной").optional().nullable(),
    warmingIncreasePercent: z.number().min(0, "Надбавка не может быть отрицательной").optional().nullable(),
    // COEF-MOUNTAIN-001: Горная местность
    mountainIncreasePercent: z.number().min(0, "Надбавка не может быть отрицательной").optional().nullable(),
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
    brand: z.string().min(1, "Марка обязательна"),
    model: z.string().optional().nullable(),
    vin: z.string().min(1, "VIN обязателен").superRefine((val, ctx) => {
        const error = validation.vin(val);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    mileage: z.number().min(0, "Пробег не может быть отрицательным"),
    fuelStockItemId: z.string().min(1, "Тип топлива обязателен"),
    vehicleModelId: z.string().optional().nullable(),
    fuelTypeId: z.any().optional(),
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
    // COEF-MOUNTAIN-001: Горная местность
    useMountainModifier: z.boolean().optional(),
    fuelTankCapacity: z.number().min(0).optional().nullable(),
    disableFuelCapacityCheck: z.boolean().optional(),
    osagoSeries: z.string().optional().nullable(),
    osagoNumber: z.string().optional().nullable(),
    osagoStartDate: z.string().optional().nullable(),
    osagoEndDate: z.string().optional().nullable(),
    storageLocationId: z.string().optional().nullable(),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface VehicleEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void; // Callback to refresh list
    vehicle?: Vehicle | null;
    employees: Employee[];
    organizations: Organization[];
    fuelItems: StockItem[];
    models: VehicleModel[];
}

export const VehicleEditModal: React.FC<VehicleEditModalProps> = ({
    isOpen,
    onClose,
    onSave,
    vehicle,
    employees,
    organizations,
    fuelItems,
    models
}) => {
    const { showToast } = useToast();
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const [sets, setSets] = useState<VehicleSet[]>([]);
    const [assets, setAssets] = useState<VehicleAsset[]>([]);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<VehicleFormData>({
        resolver: zodResolver(vehicleSchema),
    });

    const fetchSetsAndAssets = async (vehicleId: string) => {
        try {
            const [s, a] = await Promise.all([
                getVehicleSets(vehicleId),
                getVehicleAssets(vehicleId)
            ]);
            setSets(s);
            setAssets(a);
        } catch (error) {
            console.error(error);
            showToast("Не удалось загрузить комплекты/активы", "error");
        }
    };

    // Reset form when vehicle changes
    useEffect(() => {
        if (isOpen) {
            if (vehicle) {
                reset(vehicle);
                fetchSetsAndAssets(vehicle.id);
            } else {
                // Full reset for new vehicle - clear ALL fields
                reset({
                    id: undefined,
                    registrationNumber: '',
                    brand: '',
                    model: '',
                    vin: '',
                    mileage: 0,
                    fuelStockItemId: '',
                    vehicleModelId: '',
                    fuelTypeId: undefined,
                    fuelConsumptionRates: { summerRate: null, winterRate: null, cityIncreasePercent: null, warmingIncreasePercent: null, mountainIncreasePercent: null },
                    assignedDriverId: null,
                    organizationId: '',
                    currentFuel: 0,
                    year: null,
                    vehicleType: null,
                    status: VehicleStatus.ACTIVE,
                    notes: '',
                    ptsType: null,
                    ptsSeries: '',
                    ptsNumber: '',
                    eptsNumber: '',
                    diagnosticCardNumber: '',
                    diagnosticCardIssueDate: '',
                    diagnosticCardExpiryDate: '',
                    maintenanceHistory: [],
                    useCityModifier: false,
                    useWarmingModifier: false,
                    useMountainModifier: false,  // COEF-MOUNTAIN-001
                    fuelTankCapacity: null,
                    disableFuelCapacityCheck: false,
                    osagoSeries: '',
                    osagoNumber: '',
                    osagoStartDate: '',
                    osagoEndDate: '',
                    storageLocationId: null,
                } as any);
                setSets([]);
                setAssets([]);
            }
        }
    }, [isOpen, vehicle, reset]);

    const onSubmit = async (data: VehicleFormData) => {
        const dataToSave = {
            ...data,
            organizationId: data.organizationId === '' ? null : data.organizationId,
        };

        try {
            if (dataToSave.id) {
                await updateVehicle(dataToSave as Vehicle);
            } else {
                await createVehicle(dataToSave as Omit<Vehicle, 'id'>);
            }
            showToast("Изменения сохранены");
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            showToast("Не удалось сохранить изменения.", 'error');
        }
    };

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            isDirty={isDirty}
            title={vehicle ? `Редактирование: ${vehicle.registrationNumber}` : 'Добавить ТС'}
            footer={
                <>
                    <button onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Отмена</button>
                    <button onClick={handleSubmit(onSubmit)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">Сохранить</button>
                </>
            }
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <CollapsibleSection title="Основная информация" isCollapsed={collapsedSections.basic || false} onToggle={() => toggleSection('basic')}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField label="Гос. номер" error={errors.registrationNumber?.message} required><FormInput {...register("registrationNumber")} /></FormField>
                        <FormField label="Марка" error={errors.brand?.message} required><FormInput {...register("brand")} /></FormField>
                        <FormField label="Модель" error={errors.model?.message}><FormInput {...register("model")} /></FormField>
                        <FormField label="Организация" error={errors.organizationId?.message}>
                            <FormSelect {...register("organizationId")}>
                                <option value="">-</option>
                                {organizations.map(o => <option key={o.id} value={o.id}>{o.shortName}</option>)}
                            </FormSelect>
                        </FormField>
                        <FormField label="VIN" error={errors.vin?.message} required><FormInput {...register("vin")} /></FormField>

                        <FormField label="Марка ТС (конфигурация)">
                            <FormSelect
                                {...register("vehicleModelId")}
                                onChange={(e) => {
                                    register("vehicleModelId").onChange(e);
                                    const m = models.find(x => x.id === e.target.value);
                                    if (m) {
                                        // Auto-fill brand and model
                                        setValue("brand", m.brand);
                                        setValue("model", m.model);
                                        // Auto-fill vehicle type from model
                                        if (m.type) {
                                            setValue("vehicleType", m.type as any);
                                        }
                                        // Auto-fill fuel type from model
                                        if (m.fuelStockItemId) {
                                            setValue("fuelStockItemId", m.fuelStockItemId);
                                        }
                                        // Auto-fill tank capacity (default from model, user can override)
                                        if (m.tankCapacity) {
                                            setValue("fuelTankCapacity", m.tankCapacity);
                                        }
                                        // Auto-fill consumption rates as default (user can override)
                                        if (m.summerRate) {
                                            setValue("fuelConsumptionRates.summerRate", m.summerRate);
                                        }
                                        if (m.winterRate) {
                                            setValue("fuelConsumptionRates.winterRate", m.winterRate);
                                        }
                                    }
                                }}
                            >
                                <option value="">- Произвольная конфигурация -</option>
                                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </FormSelect>
                        </FormField>

                        <FormField label="Год выпуска"><FormInput type="number" {...register("year", { valueAsNumber: true })} /></FormField>
                        <FormField label="Тип ТС"><FormSelect {...register("vehicleType")}><option value="">-</option><option>Легковой</option><option>Тягач</option><option>Прицеп</option><option>Автобус</option><option>Спецтехника</option></FormSelect></FormField>
                        <FormField label="Статус"><FormSelect {...register("status")}>{Object.values(VehicleStatus).map(s => <option key={s} value={s}>{VEHICLE_STATUS_TRANSLATIONS[s]}</option>)}</FormSelect></FormField>
                        <FormField label="Водитель"><FormSelect {...register("assignedDriverId")}><option value="">Не назначен</option>{employees.map(e => <option key={e.id} value={e.id}>{e.shortName}</option>)}</FormSelect></FormField>
                    </div>
                </CollapsibleSection>
                <CollapsibleSection title="Топливо и пробег" isCollapsed={collapsedSections.fuel || false} onToggle={() => toggleSection('fuel')}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        <FormField label="Тип топлива" error={errors.fuelStockItemId?.message} required><FormSelect {...register("fuelStockItemId")}><option value="">-</option>{fuelItems.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</FormSelect></FormField>
                        <FormField
                            label={`Объем бака, л${watch("vehicleModelId") ? " (пусто = из модели)" : ""}`}
                            error={errors.fuelTankCapacity?.message}
                        >
                            <FormInput
                                type="number"
                                step="0.01"
                                placeholder={watch("vehicleModelId") ? models.find(m => m.id === watch("vehicleModelId"))?.tankCapacity?.toString() : ""}
                                {...register("fuelTankCapacity", { valueAsNumber: true, setValueAs: v => v === "" ? null : parseFloat(v) })}
                            />
                        </FormField>
                        <FormField label="Текущий остаток, л"><FormInput type="number" step="0.01" {...register("currentFuel", { valueAsNumber: true, setValueAs: v => v || null })} /></FormField>
                        <FormField label="Пробег, км" error={errors.mileage?.message} required><FormInput type="number" {...register("mileage", { valueAsNumber: true })} /></FormField>

                        <div className="md:col-span-3 grid grid-cols-2 gap-4">
                            <FormField
                                label={`Летняя норма${watch("vehicleModelId") ? " (пусто = из модели)" : ""}`}
                                error={errors.fuelConsumptionRates?.summerRate?.message}
                                required={!watch("vehicleModelId")}
                            >
                                <FormInput
                                    type="number"
                                    step="0.1"
                                    placeholder={watch("vehicleModelId") ? models.find(m => m.id === watch("vehicleModelId"))?.summerRate?.toString() : ""}
                                    {...register("fuelConsumptionRates.summerRate", { valueAsNumber: true, setValueAs: v => v === "" ? null : parseFloat(v) })}
                                />
                            </FormField>
                            <FormField
                                label={`Зимняя норма${watch("vehicleModelId") ? " (пусто = из модели)" : ""}`}
                                error={errors.fuelConsumptionRates?.winterRate?.message}
                                required={!watch("vehicleModelId")}
                            >
                                <FormInput
                                    type="number"
                                    step="0.1"
                                    placeholder={watch("vehicleModelId") ? models.find(m => m.id === watch("vehicleModelId"))?.winterRate?.toString() : ""}
                                    {...register("fuelConsumptionRates.winterRate", { valueAsNumber: true, setValueAs: v => v === "" ? null : parseFloat(v) })}
                                />
                            </FormField>
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
                                {/* COEF-MOUNTAIN-001: Горная местность */}
                                <div className="p-4 border rounded-lg dark:border-gray-600">
                                    <label className="flex items-center gap-2 mb-2">
                                        <FormCheckbox {...register("useMountainModifier")} />
                                        <span className="font-medium text-gray-700 dark:text-gray-200">Горная местность</span>
                                    </label>
                                    <FormField label="Надбавка, %" error={(errors.fuelConsumptionRates as any)?.mountainIncreasePercent?.message}>
                                        <FormInput
                                            type="number"
                                            step="0.1"
                                            {...register("fuelConsumptionRates.mountainIncreasePercent", { setValueAs: v => v === "" ? null : parseFloat(v) })}
                                            disabled={!watch("useMountainModifier")}
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

                {/* Sets and Assets */}
                {vehicle && (
                    <>
                        <CollapsibleSection title="Комплекты (Шины/Диски)" isCollapsed={collapsedSections.sets || false} onToggle={() => toggleSection('sets')}>
                            <VehicleSetList
                                vehicleId={vehicle.id}
                                sets={sets}
                                onRefresh={() => vehicle && fetchSetsAndAssets(vehicle.id)}
                            />
                        </CollapsibleSection>

                        <CollapsibleSection title="Активы (АКБ, Агрегаты)" isCollapsed={collapsedSections.assets || false} onToggle={() => toggleSection('assets')}>
                            <VehicleAssetList
                                vehicleId={vehicle.id}
                                assets={assets}
                                onRefresh={() => vehicle && fetchSetsAndAssets(vehicle.id)}
                            />
                        </CollapsibleSection>
                    </>
                )}
            </form>
        </Modal>
    );
};

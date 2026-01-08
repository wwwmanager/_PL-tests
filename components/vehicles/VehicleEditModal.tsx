import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Vehicle, VehicleStatus, Employee, Organization } from '../../types';
import { VehicleModel } from '../../services/api/vehicleModelApi';
import { StockItem } from '../../services/stockItemApi';
import { createVehicle, updateVehicle } from '../../services/api/vehicleApi';

import { validation } from '../../services/faker';
import { useToast } from '../../hooks/useToast';
import Modal from '../shared/Modal';
import CollapsibleSection from '../shared/CollapsibleSection';
import { FormField, FormInput, FormSelect, FormCheckbox } from '../shared/FormComponents';
import { VEHICLE_STATUS_TRANSLATIONS } from '../../constants';


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
    diagnosticCardNumber: z.string().optional().nullable().refine(
        (val) => !val || /^\d{15}$/.test(val),
        { message: "Рег. номер должен содержать 15 цифр" }
    ),
    diagnosticCardIssueDate: z.string().optional().nullable(),
    diagnosticCardExpiryDate: z.string().optional().nullable(),
    maintenanceHistory: z.array(maintenanceRecordSchema).optional().nullable(),
    useCityModifier: z.boolean().optional(),
    useWarmingModifier: z.boolean().optional(),
    // COEF-MOUNTAIN-001: Горная местность
    useMountainModifier: z.boolean().optional(),
    fuelTankCapacity: z.number().min(0).optional().nullable(),
    disableFuelCapacityCheck: z.boolean().optional(),
    osagoSeries: z.string().optional().nullable().refine(
        (val) => !val || /^[A-ZА-ЯЁ]{3}$/.test(val),
        { message: "Серия должна содержать 3 заглавных буквы" }
    ),
    osagoNumber: z.string().optional().nullable().refine(
        (val) => !val || /^\d{10}$/.test(val),
        { message: "Номер должен содержать 10 цифр" }
    ),
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



    const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<VehicleFormData>({
        resolver: zodResolver(vehicleSchema),
    });



    // Reset form when vehicle changes
    useEffect(() => {
        if (isOpen) {
            if (vehicle) {
                reset(vehicle);
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

                {/* Documents Section */}
                <CollapsibleSection title="Документы" isCollapsed={collapsedSections.documents || false} onToggle={() => toggleSection('documents')}>
                    <div className="space-y-6">
                        {/* OSAGO Policy */}
                        <div className="p-4 border rounded-lg dark:border-gray-600">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Полис ОСАГО</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <FormField label="Серия" error={errors.osagoSeries?.message}>
                                    <FormInput
                                        {...register("osagoSeries")}
                                        placeholder="XXX"
                                        maxLength={3}
                                        onChange={(e) => {
                                            const value = e.target.value.toUpperCase().replace(/[^A-ZА-ЯЁ]/g, '');
                                            setValue("osagoSeries", value);
                                        }}
                                    />
                                </FormField>
                                <FormField label="Номер" error={errors.osagoNumber?.message}>
                                    <FormInput
                                        {...register("osagoNumber")}
                                        placeholder="1234567890"
                                        maxLength={10}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '');
                                            setValue("osagoNumber", value);
                                        }}
                                    />
                                </FormField>
                                <FormField label="Дата начала" error={errors.osagoStartDate?.message}>
                                    <FormInput
                                        type="date"
                                        {...register("osagoStartDate")}
                                        onChange={(e) => {
                                            const startDate = e.target.value;
                                            setValue("osagoStartDate", startDate);
                                            if (startDate) {
                                                // Calculate end date: start + 1 year - 1 day
                                                const start = new Date(startDate);
                                                const end = new Date(start);
                                                end.setFullYear(end.getFullYear() + 1);
                                                end.setDate(end.getDate() - 1);
                                                setValue("osagoEndDate", end.toISOString().split('T')[0]);
                                            }
                                        }}
                                    />
                                </FormField>
                                <FormField label="Дата окончания" error={errors.osagoEndDate?.message}>
                                    <FormInput
                                        type="date"
                                        {...register("osagoEndDate")}
                                    />
                                </FormField>
                            </div>
                        </div>

                        {/* Diagnostic Card */}
                        <div className="p-4 border rounded-lg dark:border-gray-600">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Диагностическая карта ТС</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField label="Рег. номер карты" error={errors.diagnosticCardNumber?.message}>
                                    <FormInput
                                        {...register("diagnosticCardNumber")}
                                        placeholder="123456789012345"
                                        maxLength={15}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '');
                                            setValue("diagnosticCardNumber", value);
                                        }}
                                    />
                                </FormField>
                                <FormField label="Дата выдачи" error={errors.diagnosticCardIssueDate?.message}>
                                    <FormInput
                                        type="date"
                                        {...register("diagnosticCardIssueDate")}
                                        onChange={(e) => {
                                            const issueDate = e.target.value;
                                            setValue("diagnosticCardIssueDate", issueDate);
                                            if (issueDate) {
                                                const vehicleYear = watch("year");
                                                const currentYear = new Date().getFullYear();
                                                const vehicleAge = vehicleYear ? currentYear - vehicleYear : 0;

                                                // Calculate expiry based on vehicle age
                                                // < 4 years: no inspection required (don't set expiry)
                                                // 4-10 years: every 24 months
                                                // > 10 years: every 12 months
                                                const issue = new Date(issueDate);
                                                const expiry = new Date(issue);

                                                if (vehicleAge >= 10) {
                                                    expiry.setMonth(expiry.getMonth() + 12);
                                                } else if (vehicleAge >= 4) {
                                                    expiry.setMonth(expiry.getMonth() + 24);
                                                } else {
                                                    // Under 4 years - set 24 months as default
                                                    expiry.setMonth(expiry.getMonth() + 24);
                                                }
                                                expiry.setDate(expiry.getDate() - 1);
                                                setValue("diagnosticCardExpiryDate", expiry.toISOString().split('T')[0]);
                                            }
                                        }}
                                    />
                                </FormField>
                                <FormField label="Срок действия до" error={errors.diagnosticCardExpiryDate?.message}>
                                    <FormInput
                                        type="date"
                                        {...register("diagnosticCardExpiryDate")}
                                    />
                                </FormField>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

            </form>
        </Modal>
    );
};

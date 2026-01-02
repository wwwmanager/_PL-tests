import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Organization, OrganizationStatus } from '../../types';
import { getOrganizations, addOrganization, updateOrganization, deleteOrganization } from '../../services/organizationApi';
import { lockStockPeriod, unlockStockPeriod } from '../../services/adminApi';
import { validation } from '../../services/faker'; // Валидация все еще нужна для схемы
import { PencilIcon, TrashIcon, PlusIcon, ArchiveBoxIcon, ArrowUpTrayIcon, EyeIcon, BuildingOffice2Icon } from '../Icons';
import DataTable, { Column } from '../shared/DataTable';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { ORGANIZATION_STATUS_COLORS, ORGANIZATION_STATUS_TRANSLATIONS } from '../../constants';
import Modal from '../shared/Modal';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../services/auth';  // RLS-ORG-FE-010
import CollapsibleSection from '../shared/CollapsibleSection';
import { FormField, FormInput, FormSelect, FormTextarea } from '../shared/FormComponents';
import { createRequiredProps } from '../../utils/schemaHelpers';


// --- 2. Определяем схему валидации Zod ---
const organizationSchema = z.object({
    id: z.string().optional(),
    fullName: z.string().nullish(),
    shortName: z.string().min(1, "Краткое наименование обязательно"),
    address: z.string().nullish(),
    // ORG-HIERARCHY-001: INN/OGRN optional when parentOrganizationId is set
    inn: z.string().nullish().superRefine((val, ctx) => {
        if (val) {
            const error = validation.inn(val);
            if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
        }
    }),
    kpp: z.string().nullish().superRefine((val, ctx) => {
        const error = validation.kpp(val || '');
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    ogrn: z.string().nullish().superRefine((val, ctx) => {
        if (val) {
            const error = validation.ogrn(val);
            if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
        }
    }),
    registrationDate: z.string().nullish(),
    contactPerson: z.string().nullish(),
    phone: z.string().nullish(),
    email: z.string().email("Неверный формат email").nullish().or(z.literal('')),

    bankAccount: z.string().nullish().superRefine((val, ctx) => {
        const error = validation.bankAccount(val || '');
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    correspondentAccount: z.string().nullish().superRefine((val, ctx) => {
        const error = validation.correspondentAccount(val || '');
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    bankName: z.string().nullish(),
    bankBik: z.string().nullish().superRefine((val, ctx) => {
        const error = validation.bankBik(val || '');
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    accountCurrency: z.string().nullish(),
    paymentPurpose: z.string().nullish(),

    status: z.nativeEnum(OrganizationStatus),
    group: z.string().nullish(),
    notes: z.string().nullish(),

    medicalLicenseNumber: z.string().nullish(),
    medicalLicenseIssueDate: z.string().nullish(),
    stockLockedAt: z.string().nullish(),
    isOwn: z.boolean().optional(),  // OWN-ORG-FE-030
    parentOrganizationId: z.string().nullish(),  // ORG-HIERARCHY-001
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

const defaultValues: OrganizationFormData = {
    fullName: '', shortName: '', address: '', inn: '', kpp: '', ogrn: '',
    status: OrganizationStatus.ACTIVE,
    registrationDate: '', contactPerson: '', phone: '', email: '',
    bankAccount: '', correspondentAccount: '', bankName: '', bankBik: '',
    accountCurrency: '', paymentPurpose: '', group: '', notes: '',
    medicalLicenseIssueDate: '', medicalLicenseNumber: '',
    stockLockedAt: '',
    isOwn: false,  // OWN-ORG-FE-030
    parentOrganizationId: null,  // ORG-HIERARCHY-001
};


const OrganizationManagement = () => {
    const [organizations, setOrganizations] = useState<(Organization & { _canEdit?: boolean })[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [actionModal, setActionModal] = useState<{ isOpen: boolean; type?: 'delete' | 'archive' | 'unarchive'; item?: Organization }>({ isOpen: false });
    const [lockDate, setLockDate] = useState<string>('');
    const { showToast } = useToast();
    const { currentUser } = useAuth();  // RLS-ORG-FE-010
    const isDriver = currentUser?.role === 'driver';  // RLS-ORG-FE-010

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: {
            errors,
            isDirty
        }
    } = useForm<OrganizationFormData>({
        resolver: zodResolver(organizationSchema),
        defaultValues: defaultValues
    });

    // Automatically determine required fields from schema
    const requiredProps = useMemo(() => createRequiredProps(organizationSchema), []);

    const watchedGroup = watch("group");
    const currentId = watch("id");
    const currentShortName = watch("shortName");
    const currentStockLockedAt = watch("stockLockedAt");

    const COLLAPSED_SECTIONS_KEY = 'orgManagement_collapsedSections';
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
            return saved ? JSON.parse(saved) : {};
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

    type EnrichedOrganization = Organization & { _canEdit?: boolean };

    const columns: Column<EnrichedOrganization>[] = useMemo(() => [
        {
            key: 'shortName',
            label: 'Краткое наименование',
            sortable: true,
            render: (o) => (
                <>
                    {o.shortName}
                    {o.isOwn && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded-full">
                            СВОЯ
                        </span>
                    )}
                </>
            )
        },
        { key: 'inn', label: 'ИНН', sortable: true, align: 'center' },
        { key: 'address', label: 'Адрес', sortable: true },
        {
            key: 'status',
            label: 'Статус',
            sortable: true,
            align: 'center',
            render: (o) => (
                <Badge variant={o.status === OrganizationStatus.ACTIVE ? 'success' : 'neutral'}>
                    {ORGANIZATION_STATUS_TRANSLATIONS[o.status]}
                </Badge>
            )
        },
    ], []);

    const fetchData = async () => {
        setIsLoading(true);
        const data = await getOrganizations();
        setOrganizations(data);
        setIsLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleAddNew = () => {
        reset(defaultValues);
        setIsModalOpen(true);
    };

    const handleEdit = (item: Organization) => {
        reset(item);
        setLockDate('');
        setIsModalOpen(true);
    };

    const handleLockPeriod = async () => {
        if (!currentId || !lockDate) return;
        try {
            await lockStockPeriod(currentId, new Date(lockDate).toISOString());
            showToast("Период заблокирован");
            fetchData();
            // Update local state to show change immediately in modal
            const updatedOrg = organizations.find(o => o.id === currentId);
            if (updatedOrg) {
                reset({ ...updatedOrg, stockLockedAt: new Date(lockDate).toISOString() });
            }
        } catch (error) {
            showToast("Не удалось заблокировать период", "error");
        }
    };

    const handleUnlockPeriod = async () => {
        if (!currentId) return;
        try {
            await unlockStockPeriod(currentId);
            showToast("Период разблокирован");
            fetchData();
            const updatedOrg = organizations.find(o => o.id === currentId);
            if (updatedOrg) {
                reset({ ...updatedOrg, stockLockedAt: undefined });
            }
        } catch (error) {
            showToast("Не удалось разблокировать период", "error");
        }
    };

    const handleCancel = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const onSubmit = async (data: OrganizationFormData) => {
        try {
            if (data.id) {
                await updateOrganization(data as Organization);
            } else {
                await addOrganization(data as Omit<Organization, 'id'>);
            }
            showToast("Изменения сохранены");
            setIsModalOpen(false);
            fetchData();
        } catch (error: any) {
            // OWN-ORG-FE-030: Handle 400 error for isOwn uniqueness validation
            const message = error?.response?.data?.error
                || error?.message
                || "Не удалось сохранить изменения.";
            showToast(message, 'error');
        }
    };

    const openActionModal = (type: 'delete' | 'archive' | 'unarchive', item: Organization) => {
        setActionModal({ isOpen: true, type, item });
    };

    const closeActionModal = () => setActionModal({ isOpen: false });

    const handleConfirmAction = async () => {
        const { type, item } = actionModal;
        if (!item) return;

        try {
            if (type === 'delete') {
                await deleteOrganization(item.id);
                showToast(`Организация "${item.shortName}" удалена.`, 'info');
            } else if (type === 'archive') {
                await updateOrganization({ ...item, status: OrganizationStatus.ARCHIVED });
                showToast(`Организация "${item.shortName}" архивирована.`, 'info');
            } else if (type === 'unarchive') {
                await updateOrganization({ ...item, status: OrganizationStatus.ACTIVE });
                showToast(`Организация "${item.shortName}" восстановлена.`, 'info');
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
            case 'delete': return { title: 'Подтвердить удаление', message: `Удалить организацию "${item.shortName}"?`, confirmText: 'Удалить', confirmButtonClass: 'bg-red-600 hover:bg-red-700' };
            case 'archive': return { title: 'Подтвердить архивацию', message: `Архивировать "${item.shortName}"?`, confirmText: 'Архивировать', confirmButtonClass: 'bg-purple-600 hover:bg-purple-700' };
            case 'unarchive': return { title: 'Подтвердить восстановление', message: `Восстановить "${item.shortName}" из архива?`, confirmText: 'Восстановить', confirmButtonClass: 'bg-green-600 hover:bg-green-700' };
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
                title={currentId ? `Редактирование: ${currentShortName}` : 'Добавить организацию'}
                footer={
                    <>
                        <button onClick={handleCancel} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Отмена</button>
                        <button onClick={handleSubmit(onSubmit)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">Сохранить</button>
                    </>
                }
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <CollapsibleSection title="Основная информация" isCollapsed={collapsedSections.basic || false} onToggle={() => toggleSection('basic')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Краткое наименование" error={errors.shortName?.message} required={requiredProps.shortName}><FormInput {...register("shortName")} /></FormField>
                            <FormField label="Полное наименование" required={requiredProps.fullName}><FormInput {...register("fullName")} /></FormField>
                            <FormField label="Группа" required={requiredProps.group}><FormSelect {...register("group")}><option value="">Без группы</option><option value="Перевозчик">Перевозчик</option><option value="Заказчик">Заказчик</option><option value="Филиал">Филиал</option><option value="Мед. учреждение">Мед. учреждение</option></FormSelect></FormField>
                            <FormField label="Статус" required={requiredProps.status}><FormSelect {...register("status")}>{Object.values(OrganizationStatus).map(s => <option key={s} value={s}>{ORGANIZATION_STATUS_TRANSLATIONS[s]}</option>)}</FormSelect></FormField>
                            {/* ORG-HIERARCHY-001: Головная организация */}
                            <FormField label="Головная организация">
                                <FormSelect {...register("parentOrganizationId")}>
                                    <option value="">— Нет (головная) —</option>
                                    {organizations
                                        .filter(o => o.id !== currentId && !o.parentOrganizationId) // Only head orgs, exclude self
                                        .map(o => <option key={o.id} value={o.id}>{o.shortName}</option>)}
                                </FormSelect>
                            </FormField>
                            <div className="md:col-span-2"><FormField label="Юридический адрес"><FormInput {...register("address")} /></FormField></div>
                            {/* OWN-ORG-FE-030: Checkbox for Own Organization */}
                            {(() => {
                                // OWN-ORG-UX-031: Disable checkbox if another org is already marked as own
                                const existingOwnOrg = organizations.find(o => o.isOwn && o.id !== currentId);
                                const isDisabled = !!existingOwnOrg;
                                return (
                                    <div className="md:col-span-2">
                                        <label className={`flex items-center gap-2 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                            <input
                                                type="checkbox"
                                                {...register("isOwn")}
                                                disabled={isDisabled}
                                                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                            />
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                Собственная организация
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {isDisabled
                                                    ? `(уже выбрана: ${existingOwnOrg?.shortName})`
                                                    : '(только одна организация может быть собственной)'}
                                            </span>
                                        </label>
                                    </div>
                                );
                            })()}
                        </div>
                    </CollapsibleSection>
                    {watchedGroup === 'Мед. учреждение' && (
                        <CollapsibleSection title="Данные мед. учреждения" isCollapsed={collapsedSections.medical || false} onToggle={() => toggleSection('medical')}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField label="Номер лицензии"><FormInput {...register("medicalLicenseNumber")} /></FormField>
                                <FormField label="Дата выдачи лицензии"><FormInput type="date" {...register("medicalLicenseIssueDate")} /></FormField>
                            </div>
                        </CollapsibleSection>
                    )}
                    <CollapsibleSection title="Реквизиты" isCollapsed={collapsedSections.requisites || false} onToggle={() => toggleSection('requisites')}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField label="ИНН" error={errors.inn?.message} required={requiredProps.inn}><FormInput {...register("inn")} /></FormField>
                            <FormField label="КПП" error={errors.kpp?.message}><FormInput {...register("kpp")} /></FormField>
                            <FormField label="ОГРН" error={errors.ogrn?.message} required={requiredProps.ogrn}><FormInput {...register("ogrn")} /></FormField>
                        </div>
                    </CollapsibleSection>
                    <CollapsibleSection title="Банковские реквизиты" isCollapsed={collapsedSections.bank || false} onToggle={() => toggleSection('bank')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Расчетный счет" error={errors.bankAccount?.message}><FormInput {...register("bankAccount")} /></FormField>
                            <FormField label="Корреспондентский счет" error={errors.correspondentAccount?.message}><FormInput {...register("correspondentAccount")} /></FormField>
                            <FormField label="Наименование банка"><FormInput {...register("bankName")} /></FormField>
                            <FormField label="БИК" error={errors.bankBik?.message}><FormInput {...register("bankBik")} /></FormField>
                        </div>
                    </CollapsibleSection>

                    {currentId && (
                        <CollapsibleSection title="Управление периодом (Stock Period Lock)" isCollapsed={collapsedSections.periodLock || false} onToggle={() => toggleSection('periodLock')}>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {currentStockLockedAt
                                                ? `Период закрыт до: ${new Date(currentStockLockedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                                : 'Период открыт'}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Закрытие периода запрещает создание и изменение движений в закрытом периоде.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {currentStockLockedAt ? (
                                            <button
                                                type="button"
                                                onClick={handleUnlockPeriod}
                                                className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded hover:bg-green-200"
                                            >
                                                Открыть период
                                            </button>
                                        ) : (
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="date"
                                                    className="text-xs p-1 rounded border border-gray-300 dark:bg-gray-600 dark:text-white"
                                                    onChange={(e) => setLockDate(e.target.value)}
                                                    value={lockDate}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleLockPeriod}
                                                    disabled={!lockDate}
                                                    className="px-3 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                                                >
                                                    Закрыть до
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CollapsibleSection>
                    )}
                </form>
            </Modal>

            <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <BuildingOffice2Icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Организации</h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                            {organizations.length}
                        </span>
                    </div>
                    {/* RLS-ORG-FE-010: Hide Add button for drivers */}
                    {!isDriver && (
                        <Button onClick={handleAddNew} variant="primary" leftIcon={<PlusIcon className="h-5 w-5" />}>
                            Добавить организацию
                        </Button>
                    )}
                </div>

                <DataTable
                    tableId="organization-list"
                    columns={columns}
                    data={organizations}
                    keyField="id"
                    searchable={true}
                    isLoading={isLoading}
                    actions={[
                        {
                            icon: <EyeIcon className="h-4 w-4" />,
                            onClick: (o) => handleEdit(o),
                            title: "Просмотр (только чтение)",
                            className: "text-gray-600 hover:text-gray-800",
                            show: (o: any) => o._canEdit === false
                        },
                        {
                            icon: <PencilIcon className="h-4 w-4" />,
                            onClick: (o) => handleEdit(o),
                            title: "Редактировать",
                            className: "text-blue-600 hover:text-blue-800",
                            show: (o: any) => o._canEdit !== false
                        },
                        {
                            icon: <ArchiveBoxIcon className="h-4 w-4" />,
                            onClick: (o) => openActionModal('archive', o),
                            title: "Архивировать",
                            className: "text-purple-600 hover:text-purple-800",
                            show: (o: any) => o._canEdit !== false && o.status === OrganizationStatus.ACTIVE
                        },
                        {
                            icon: <ArrowUpTrayIcon className="h-4 w-4" />,
                            onClick: (o) => openActionModal('unarchive', o),
                            title: "Восстановить",
                            className: "text-green-600 hover:text-green-800",
                            show: (o: any) => o._canEdit !== false && o.status === OrganizationStatus.ARCHIVED
                        },
                        {
                            icon: <TrashIcon className="h-4 w-4" />,
                            onClick: (o) => openActionModal('delete', o),
                            title: "Удалить",
                            className: "text-red-600 hover:text-red-800",
                            show: (o: any) => o._canEdit !== false
                        }
                    ]}
                />
            </div>
        </>
    );
};

export default OrganizationManagement;

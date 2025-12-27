import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Organization, OrganizationStatus } from '../../types';
import { getOrganizations, addOrganization, updateOrganization, deleteOrganization } from '../../services/organizationApi';
import { lockStockPeriod, unlockStockPeriod } from '../../services/adminApi';
import { validation } from '../../services/faker'; // Валидация все еще нужна для схемы
import { PencilIcon, TrashIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon, ArchiveBoxIcon, ArrowUpTrayIcon } from '../Icons';
import useTable from '../../hooks/useTable';
import { ORGANIZATION_STATUS_COLORS, ORGANIZATION_STATUS_TRANSLATIONS } from '../../constants';
import Modal from '../shared/Modal';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import CollapsibleSection from '../shared/CollapsibleSection';
import { FormField, FormInput, FormSelect, FormTextarea } from '../shared/FormComponents';
import { createRequiredProps } from '../../utils/schemaHelpers';


// --- 2. Определяем схему валидации Zod ---
const organizationSchema = z.object({
    id: z.string().optional(),
    fullName: z.string().nullish(),
    shortName: z.string().min(1, "Краткое наименование обязательно"),
    address: z.string().nullish(),
    inn: z.string().min(1, "ИНН обязателен").superRefine((val, ctx) => {
        const error = validation.inn(val || '');
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    kpp: z.string().nullish().superRefine((val, ctx) => {
        const error = validation.kpp(val || '');
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    ogrn: z.string().min(1, "ОГРН обязателен").superRefine((val, ctx) => {
        const error = validation.ogrn(val || '');
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
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
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

const defaultValues: OrganizationFormData = {
    fullName: '', shortName: '', address: '', inn: '', kpp: '', ogrn: '',
    status: OrganizationStatus.ACTIVE,
    registrationDate: '', contactPerson: '', phone: '', email: '',
    bankAccount: '', correspondentAccount: '', bankName: '', bankBik: '',
    accountCurrency: '', paymentPurpose: '', group: '', notes: '',
    medicalLicenseIssueDate: '', medicalLicenseNumber: '',
    stockLockedAt: ''
};


const OrganizationManagement = () => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showArchived, setShowArchived] = useState(false);
    const [actionModal, setActionModal] = useState<{ isOpen: boolean; type?: 'delete' | 'archive' | 'unarchive'; item?: Organization }>({ isOpen: false });
    const [lockDate, setLockDate] = useState<string>('');
    const { showToast } = useToast();

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

    const filteredOrganizations = useMemo(() => {
        return organizations.filter(o => showArchived || o.status !== OrganizationStatus.ARCHIVED);
    }, [organizations, showArchived]);

    const columns: { key: keyof Organization; label: string }[] = [
        { key: 'shortName', label: 'Краткое наименование' },
        { key: 'inn', label: 'ИНН' },
        { key: 'address', label: 'Адрес' },
        { key: 'status', label: 'Статус' },
    ];

    const { rows, sortColumn, sortDirection, handleSort, filters, handleFilterChange } = useTable(filteredOrganizations, columns);

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
        } catch (error) {
            showToast("Не удалось сохранить изменения.", 'error');
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
                            <div className="md:col-span-2"><FormField label="Юридический адрес"><FormInput {...register("address")} /></FormField></div>
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

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Справочник: Организации</h3>
                    <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-colors">
                        <PlusIcon className="h-5 w-5" /> Добавить
                    </button>
                </div>
                <label className="flex items-center text-sm text-gray-600 dark:text-gray-300 cursor-pointer my-4">
                    <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500" />
                    <span className="ml-2">Показать архивные</span>
                </label>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                {columns.map(col => (<th key={col.key} scope="col" className="px-6 py-3 cursor-pointer" onClick={() => handleSort(col.key)}><div className="flex items-center gap-1">{col.label}{sortColumn === col.key && (sortDirection === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />)}</div></th>))}
                                <th scope="col" className="px-6 py-3 text-center">Действия</th>
                            </tr>
                            <tr>
                                {columns.map(col => (<th key={`${col.key}-filter`} className="px-2 py-1"><input type="text" value={filters[col.key] || ''} onChange={e => handleFilterChange(col.key, e.target.value)} placeholder={`Поиск...`} className="w-full text-xs p-1 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded" /></th>))}
                                <th className="px-2 py-1"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (<tr><td colSpan={columns.length + 1} className="text-center p-4">Загрузка...</td></tr>)
                                : rows.map(o => (
                                    <tr key={o.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{o.shortName}</td>
                                        <td className="px-6 py-4">{o.inn}</td>
                                        <td className="px-6 py-4">{o.address}</td>
                                        <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${ORGANIZATION_STATUS_COLORS[o.status]}`}>{ORGANIZATION_STATUS_TRANSLATIONS[o.status]}</span></td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleEdit(o)} className="p-2 text-blue-500" title="Редактировать"><PencilIcon className="h-5 w-5" /></button>
                                            {o.status === OrganizationStatus.ACTIVE ? <button onClick={() => openActionModal('archive', o)} className="p-2 text-purple-500" title="Архивировать"><ArchiveBoxIcon className="h-5 w-5" /></button> : <button onClick={() => openActionModal('unarchive', o)} className="p-2 text-green-500" title="Восстановить"><ArrowUpTrayIcon className="h-5 w-5" /></button>}
                                            <button onClick={() => openActionModal('delete', o)} className="p-2 text-red-500" title="Удалить"><TrashIcon className="h-5 w-5" /></button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default OrganizationManagement;

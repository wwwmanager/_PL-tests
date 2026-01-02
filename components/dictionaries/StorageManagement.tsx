import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Organization, Employee, StorageType } from '../../types';
import { fetchStorages, addStorage, updateStorage, deleteStorage, Storage } from '../../services/warehouseApi';
import { getOrganizations } from '../../services/organizationApi';
import { getEmployees } from '../../services/api/employeeApi';
import { PencilIcon, TrashIcon, PlusIcon, ArchiveBoxIcon, ArrowUpTrayIcon, EyeIcon, HomeModernIcon } from '../Icons';
import DataTable, { Column } from '../shared/DataTable';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { STORAGE_TYPE_TRANSLATIONS, STORAGE_STATUS_TRANSLATIONS, STORAGE_STATUS_COLORS } from '../../constants';
import Modal from '../shared/Modal';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../services/auth';  // RLS-WAREHOUSE-FE-010

const FormField: React.FC<{ label: string; children: React.ReactNode; error?: string }> = ({ label, children, error }) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
        {children}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
);

const FormInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} className="w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200" />
);
const FormSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className="w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200" />;
const FormTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} rows={3} className="w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200" />;


const storageSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Наименование обязательно"),
    type: z.enum(['centralWarehouse', 'remoteWarehouse', 'vehicleTank', 'contractorWarehouse']),
    organizationId: z.string().min(1, "Организация обязательна"),
    address: z.string().optional().nullable(),
    // FIX: Changed from responsiblePerson (string) to responsibleEmployeeId (UUID)
    responsibleEmployeeId: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    status: z.enum(['active', 'archived']),
});

type StorageFormData = z.infer<typeof storageSchema>;

const StorageManagement = () => {
    const [storages, setStorages] = useState<Storage[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [actionModal, setActionModal] = useState<{ isOpen: boolean; type?: 'delete' | 'archive' | 'unarchive'; item?: Storage }>({ isOpen: false });
    const { showToast } = useToast();
    const { currentUser } = useAuth();  // RLS-WAREHOUSE-FE-010
    const isDriver = currentUser?.role === 'driver';  // RLS-WAREHOUSE-FE-010

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isDirty }
    } = useForm<StorageFormData>({
        resolver: zodResolver(storageSchema)
    });

    const currentId = watch("id");
    const currentName = watch("name");

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [storagesData, orgsData, employeesData] = await Promise.all([
                fetchStorages(),
                getOrganizations(),
                getEmployees()
            ]);
            setStorages(storagesData);
            setOrganizations(orgsData);
            setEmployees(employeesData);
        } catch (error) {
            showToast('Не удалось загрузить данные.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    type EnrichedStorage = Storage & {
        organizationName: string;
        typeName: string;
        _canEdit?: boolean;
    };

    const enrichedData: EnrichedStorage[] = useMemo(() => {
        return storages.map(s => ({
            ...s,
            organizationName: organizations.find(o => o.id === s.organizationId)?.shortName || 'N/A',
            typeName: s.type ? STORAGE_TYPE_TRANSLATIONS[s.type] : '',
        }));
    }, [storages, organizations]);

    const columns: Column<EnrichedStorage>[] = useMemo(() => [
        { key: 'name', label: 'Наименование', sortable: true, align: 'center' },
        { key: 'typeName', label: 'Тип', sortable: true, align: 'center' },
        { key: 'organizationName', label: 'Организация', sortable: true, align: 'center' },
        { key: 'address', label: 'Адрес', sortable: true },
        {
            key: 'status',
            label: 'Статус',
            sortable: true,
            align: 'center',
            render: (s) => (
                <Badge variant={s.status === 'active' ? 'success' : 'neutral'}>
                    {s.status === 'active' ? 'Активна' : 'Архив'}
                </Badge>
            )
        },
    ], []);

    const handleAddNew = () => {
        reset({
            name: '',
            type: 'centralWarehouse',
            organizationId: organizations[0]?.id || '',
            address: '',
            responsibleEmployeeId: '',
            description: '',
            status: 'active',
        });
        setIsModalOpen(true);
    };

    const handleEdit = (item: Storage) => {
        reset(item);
        setIsModalOpen(true);
    };

    const handleCancel = useCallback(() => setIsModalOpen(false), []);

    const onSubmit = async (data: StorageFormData) => {
        try {
            if (data.id) {
                await updateStorage(data as Storage);
            } else {
                await addStorage(data as Omit<Storage, 'id'>);
            }
            showToast("Изменения сохранены");
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            showToast("Не удалось сохранить изменения.", 'error');
        }
    };

    const openActionModal = (type: 'delete' | 'archive' | 'unarchive', item: Storage) => {
        setActionModal({ isOpen: true, type, item });
    };

    const closeActionModal = () => setActionModal({ isOpen: false });

    const handleConfirmAction = async () => {
        const { type, item } = actionModal;
        if (!item) return;

        try {
            if (type === 'delete') {
                await deleteStorage(item.id);
                showToast(`Место хранения "${item.name}" удалено.`, 'info');
            } else if (type === 'archive') {
                await updateStorage({ ...item, status: 'archived' });
                showToast(`Место хранения "${item.name}" архивировано.`, 'info');
            } else if (type === 'unarchive') {
                await updateStorage({ ...item, status: 'active' });
                showToast(`Место хранения "${item.name}" восстановлено.`, 'info');
            }
            fetchData();
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            closeActionModal();
        }
    };

    const modalConfig = useMemo(() => {
        const { type, item } = actionModal;
        if (!type || !item) return { title: '', message: '', confirmText: '', confirmButtonClass: '' };

        switch (type) {
            case 'delete': return { title: 'Подтвердить удаление', message: `Удалить место хранения "${item.name}" ? `, confirmText: 'Удалить', confirmButtonClass: 'bg-red-600 hover:bg-red-700' };
            case 'archive': return { title: 'Подтвердить архивацию', message: `Архивировать "${item.name}" ? `, confirmText: 'Архивировать', confirmButtonClass: 'bg-purple-600 hover:bg-purple-700' };
            case 'unarchive': return { title: 'Подтвердить восстановление', message: `Восстановить "${item.name}" из архива ? `, confirmText: 'Восстановить', confirmButtonClass: 'bg-green-600 hover:bg-green-700' };
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
                title={currentId ? `Редактирование: ${currentName} ` : 'Добавить место хранения'}
                footer={
                    <>
                        <button onClick={handleCancel} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Отмена</button>
                        <button onClick={handleSubmit(onSubmit)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">Сохранить</button>
                    </>
                }
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Наименование" error={errors.name?.message}><FormInput {...register("name")} /></FormField>
                        <FormField label="Тип" error={errors.type?.message}>
                            <FormSelect {...register("type")}>
                                {Object.entries(STORAGE_TYPE_TRANSLATIONS).map(([key, label]) =>
                                    <option key={key} value={key}>{label}</option>
                                )}
                            </FormSelect>
                        </FormField>
                        <FormField label="Организация" error={errors.organizationId?.message}>
                            <FormSelect {...register("organizationId")}>
                                <option value="">Выберите</option>
                                {organizations.map(o => <option key={o.id} value={o.id}>{o.shortName}</option>)}
                            </FormSelect>
                        </FormField>
                        <FormField label="Ответственное лицо" error={errors.responsibleEmployeeId?.message}>
                            <FormSelect {...register("responsibleEmployeeId")}>
                                <option value="">Выберите</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                            </FormSelect>
                        </FormField>
                        <div className="md:col-span-2"><FormField label="Адрес" error={errors.address?.message}><FormInput {...register("address")} /></FormField></div>
                        <div className="md:col-span-2"><FormField label="Описание/примечания" error={errors.description?.message}><FormTextarea {...register("description")} /></FormField></div>
                    </div>
                </form>
            </Modal>

            <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <HomeModernIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Места хранения</h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                            {storages.length}
                        </span>
                    </div>
                    {/* RLS-WAREHOUSE-FE-010: Hide Add button for drivers */}
                    {!isDriver && (
                        <Button onClick={handleAddNew} variant="primary" leftIcon={<PlusIcon className="h-5 w-5" />}>
                            Добавить место хранения
                        </Button>
                    )}
                </div>

                <DataTable
                    tableId="storage-list"
                    columns={columns}
                    data={enrichedData}
                    keyField="id"
                    searchable={true}
                    isLoading={isLoading}
                    actions={[
                        {
                            icon: <EyeIcon className="h-4 w-4" />,
                            onClick: (s) => handleEdit(s),
                            title: "Просмотр (только чтение)",
                            className: "text-gray-600 hover:text-gray-800",
                            show: (s: any) => s._canEdit === false
                        },
                        {
                            icon: <PencilIcon className="h-4 w-4" />,
                            onClick: (s) => handleEdit(s),
                            title: "Редактировать",
                            className: "text-blue-600 hover:text-blue-800",
                            show: (s: any) => s._canEdit !== false
                        },
                        {
                            icon: <ArchiveBoxIcon className="h-4 w-4" />,
                            onClick: (s) => openActionModal('archive', s),
                            title: "Архивировать",
                            className: "text-purple-600 hover:text-purple-800",
                            show: (s: any) => s._canEdit !== false && s.status === 'active'
                        },
                        {
                            icon: <ArrowUpTrayIcon className="h-4 w-4" />,
                            onClick: (s) => openActionModal('unarchive', s),
                            title: "Восстановить",
                            className: "text-green-600 hover:text-green-800",
                            show: (s: any) => s._canEdit !== false && s.status === 'archived'
                        },
                        {
                            icon: <TrashIcon className="h-4 w-4" />,
                            onClick: (s) => openActionModal('delete', s),
                            title: "Удалить",
                            className: "text-red-600 hover:text-red-800",
                            show: (s: any) => s._canEdit !== false
                        }
                    ]}
                />
            </div>
        </>
    );
};

export default StorageManagement;

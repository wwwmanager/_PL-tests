import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Role, Capability, Organization } from '../../types';
import { userApi } from '../../services/userApi';
import { transferUser, TransferUserResponse } from '../../services/adminApi';
import { getOrganizations } from '../../services/organizationApi';
import { useAuth } from '../../services/auth';
import { PencilIcon, TrashIcon, PlusIcon, ArrowsRightLeftIcon } from '../Icons';
import Modal from '../shared/Modal';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import { ROLE_TRANSLATIONS, CAPABILITY_TRANSLATIONS } from '../../constants';

const userSchema = z.object({
    id: z.string().optional(),
    displayName: z.string().min(1, 'Имя пользователя обязательно'),
    email: z.string().optional(),
    password: z.string().optional(),
    role: z.enum(['admin', 'dispatcher', 'auditor', 'driver', 'mechanic', 'reviewer', 'accountant', 'viewer']),
    extraCaps: z.array(z.string()).optional(),
});
type UserFormData = z.infer<typeof userSchema>;

const FormField: React.FC<{ label: string; children: React.ReactNode; error?: string }> = ({ label, children, error }) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
        {children}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
);
const FormInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className="w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2" />;
const FormSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className="w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2" />;

const UserManagement: React.FC = () => {
    const { can, allCaps, rolePolicies, currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [currentItem, setCurrentItem] = useState<Partial<User> | null>(null);
    const [deleteModal, setDeleteModal] = useState<User | null>(null);
    const [transferModal, setTransferModal] = useState<User | null>(null);
    const [transferMode, setTransferMode] = useState<'existing' | 'new'>('existing');
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgShortName, setNewOrgShortName] = useState('');
    const [transferring, setTransferring] = useState(false);
    const [transferAllData, setTransferAllData] = useState(false);
    const { showToast } = useToast();

    const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<UserFormData>({ resolver: zodResolver(userSchema) });
    const watchedRole = watch('role');

    const fetchData = useCallback(async () => {
        try {
            const [userData, orgData] = await Promise.all([
                userApi.getUsers(),
                getOrganizations()
            ]);
            setUsers(userData);
            setOrganizations(orgData);
        } catch (e) {
            console.error(e);
            showToast('Не удалось загрузить данные', 'error');
        }
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEdit = (item: User) => { reset(item); setCurrentItem(item); };
    const handleAddNew = () => { reset({ displayName: '', email: '', password: '', role: 'dispatcher', extraCaps: [] }); setCurrentItem({}); };
    const handleCancel = () => setCurrentItem(null);

    const onSubmit = async (data: UserFormData) => {
        try {
            if (data.id) {
                await userApi.updateUser(data as User);
            } else {
                await userApi.addUser(data as Omit<User, 'id'>);
            }
            showToast('Пользователь сохранен');
            handleCancel();
            fetchData();
        } catch (e) {
            console.error(e);
            showToast('Не удалось сохранить', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deleteModal) return;
        if (deleteModal.id === currentUser?.id) {
            showToast('Нельзя удалить текущего пользователя.', 'error');
            setDeleteModal(null);
            return;
        }
        try {
            await userApi.deleteUser(deleteModal.id);
            showToast('Пользователь удален');
            setDeleteModal(null);
            fetchData();
        } catch (e) { showToast('Не удалось удалить', 'error'); }
    };

    const handleTransfer = async () => {
        if (!transferModal) return;
        setTransferring(true);
        try {
            let result: TransferUserResponse;
            if (transferMode === 'new' && newOrgName) {
                result = await transferUser({
                    userId: transferModal.id,
                    createOrganization: { name: newOrgName, shortName: newOrgShortName || newOrgName },
                    transferAllData
                });
            } else if (transferMode === 'existing' && selectedOrgId) {
                result = await transferUser({
                    userId: transferModal.id,
                    targetOrganizationId: selectedOrgId,
                    transferAllData
                });
            } else {
                showToast('Выберите организацию или создайте новую', 'error');
                setTransferring(false);
                return;
            }

            if (result.success) {
                showToast(result.message, 'success');
                if (result.data?.canDeleteSourceOrg) {
                    showToast('Старая организация теперь пуста и может быть удалена', 'info');
                }
                setTransferModal(null);
                setNewOrgName('');
                setNewOrgShortName('');
                setSelectedOrgId('');
                setTransferAllData(false);
                fetchData();
            } else {
                showToast(result.message || 'Ошибка переноса', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Ошибка переноса', 'error');
        } finally {
            setTransferring(false);
        }
    };

    const openTransferModal = (user: User) => {
        setTransferModal(user);
        setTransferMode('existing');
        setSelectedOrgId('');
        setNewOrgName('');
        setNewOrgShortName('');
        setTransferAllData(false);
    };

    const roleCaps = useMemo(() => watchedRole ? rolePolicies[watchedRole] : [], [watchedRole, rolePolicies]);

    if (!can('admin.panel')) {
        return <div className="p-4 text-gray-500">Доступ к управлению пользователями есть только у администратора.</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Управление пользователями</h3>
                <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md"><PlusIcon className="h-5 w-5" /> Добавить</button>
            </div>

            <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-600 dark:text-gray-300"><th className="p-2">Имя</th><th className="p-2">Роль</th><th className="p-2">Доп. права</th><th className="p-2">Действия</th></tr></thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id} className="border-t dark:border-gray-700">
                            <td className="p-2 font-medium text-gray-800 dark:text-gray-100">{user.displayName}</td>
                            <td className="p-2">{ROLE_TRANSLATIONS[user.role] ?? user.role}</td>
                            <td className="p-2 text-xs text-gray-500">{(user.extraCaps || []).map(c => CAPABILITY_TRANSLATIONS[c as Capability] ?? c).join(', ')}</td>
                            <td className="p-2 flex gap-1">
                                <button onClick={() => handleEdit(user)} className="p-1" title="Редактировать"><PencilIcon className="h-5 w-5 text-blue-500" /></button>
                                <button onClick={() => openTransferModal(user)} className="p-1" title="Перенести в другую организацию">
                                    <ArrowsRightLeftIcon className="h-5 w-5 text-green-500" />
                                </button>
                                <button onClick={() => setDeleteModal(user)} className="p-1" title="Удалить"><TrashIcon className="h-5 w-5 text-red-500" /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Edit/Add Modal */}
            <Modal isOpen={!!currentItem} onClose={handleCancel} isDirty={isDirty} title={currentItem?.id ? "Редактировать" : "Новый пользователь"} footer={<><button onClick={handleCancel}>Отмена</button><button onClick={handleSubmit(onSubmit)}>Сохранить</button></>}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FormField label="Отображаемое имя (логин)" error={errors.displayName?.message}><FormInput {...register("displayName")} placeholder="Степаненко" /></FormField>
                    <FormField label="Email (опционально)" error={errors.email?.message}><FormInput {...register("email")} type="email" placeholder="user@example.com" /></FormField>
                    {!currentItem?.id && <FormField label="Пароль" error={errors.password?.message}><FormInput {...register("password")} type="password" placeholder="Минимум 4 символа" /></FormField>}
                    <FormField label="Роль" error={errors.role?.message}>
                        <FormSelect {...register("role")}>
                            {(Object.keys(rolePolicies) as Role[]).map(r => <option key={r} value={r}>{ROLE_TRANSLATIONS[r] ?? r}</option>)}
                        </FormSelect>
                    </FormField>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Дополнительные привилегии</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-md dark:border-gray-600 max-h-48 overflow-y-auto">
                            {allCaps.map(cap => (
                                <label key={cap} className="flex items-center gap-2">
                                    <input type="checkbox"
                                        {...register('extraCaps')}
                                        value={cap}
                                        disabled={roleCaps.includes(cap)}
                                        defaultChecked={currentItem?.extraCaps?.includes(cap) || roleCaps.includes(cap)}
                                    />
                                    <span className={`text-sm ${roleCaps.includes(cap) ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>{CAPABILITY_TRANSLATIONS[cap] ?? cap}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmationModal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} onConfirm={handleDelete} title="Удалить пользователя?" message={`Вы уверены, что хотите удалить "${deleteModal?.displayName}"?`} confirmText="Удалить" />

            {/* Transfer Modal */}
            <Modal
                isOpen={!!transferModal}
                onClose={() => setTransferModal(null)}
                title={`Перенести пользователя "${transferModal?.displayName}"`}
                footer={
                    <>
                        <button onClick={() => setTransferModal(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Отмена</button>
                        <button
                            onClick={handleTransfer}
                            disabled={transferring || (transferMode === 'existing' && !selectedOrgId) || (transferMode === 'new' && !newOrgName)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                        >
                            {transferring ? 'Перенос...' : 'Перенести'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="flex gap-4 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={transferMode === 'existing'}
                                onChange={() => setTransferMode('existing')}
                                className="w-4 h-4"
                            />
                            <span>Существующая организация</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={transferMode === 'new'}
                                onChange={() => setTransferMode('new')}
                                className="w-4 h-4"
                            />
                            <span>Создать новую</span>
                        </label>
                    </div>

                    {transferMode === 'existing' ? (
                        <FormField label="Выберите организацию">
                            <FormSelect value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)}>
                                <option value="">-- Выберите --</option>
                                {organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.shortName || org.fullName}</option>
                                ))}
                            </FormSelect>
                        </FormField>
                    ) : (
                        <>
                            <FormField label="Название организации *">
                                <FormInput
                                    value={newOrgName}
                                    onChange={e => setNewOrgName(e.target.value)}
                                    placeholder="ООО Новая Компания"
                                />
                            </FormField>
                            <FormField label="Краткое название">
                                <FormInput
                                    value={newOrgShortName}
                                    onChange={e => setNewOrgShortName(e.target.value)}
                                    placeholder="НоваяКомп"
                                />
                            </FormField>
                        </>
                    )}

                    <label className="flex items-center gap-2 mt-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={transferAllData}
                            onChange={e => setTransferAllData(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Перенести все данные организации (сотрудники, транспорт, бланки, ПЛ)
                        </span>
                    </label>

                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                        ⚠️ После переноса пользователя старая организация станет пустой и её можно будет удалить через "Очистить данные".
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UserManagement;
// components/admin/IntegrityManagement.tsx
// PERIOD-LOCK-001: UI for period locking and integrity verification

import React, { useState, useEffect } from 'react';
import { getPeriodLocks, closePeriod, verifyPeriod, deletePeriodLock, PeriodLock, VerifyResult } from '../../services/adminApi';
import { useToast } from '../../hooks/useToast';
import { ShieldCheckIcon, TrashIcon, PlusIcon } from '../Icons';

const IntegrityManagement: React.FC = () => {
    const [locks, setLocks] = useState<PeriodLock[]>([]);
    const [loading, setLoading] = useState(false);
    const [newPeriod, setNewPeriod] = useState('');
    const [notes, setNotes] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const { showToast } = useToast();

    const loadLocks = async () => {
        setLoading(true);
        try {
            const response = await getPeriodLocks();
            setLocks(response.data || []);
        } catch (err: any) {
            showToast('Ошибка загрузки: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLocks();
    }, []);

    const handleClosePeriod = async () => {
        if (!newPeriod || !/^\d{4}-\d{2}$/.test(newPeriod)) {
            showToast('Введите период в формате ГГГГ-ММ', 'error');
            return;
        }
        setIsClosing(true);
        try {
            await closePeriod(newPeriod, notes);
            showToast(`Период ${newPeriod} успешно закрыт`, 'success');
            setNewPeriod('');
            setNotes('');
            loadLocks();
        } catch (err: any) {
            showToast('Ошибка: ' + err.message, 'error');
        } finally {
            setIsClosing(false);
        }
    };

    const handleVerify = async (lockId: string) => {
        setVerifyingId(lockId);
        try {
            const response = await verifyPeriod(lockId);
            setVerifyResults(prev => ({ ...prev, [lockId]: response.data }));
            if (response.data.isValid) {
                showToast('Данные корректны ✓', 'success');
            } else {
                showToast('НАРУШЕНИЕ ЦЕЛОСТНОСТИ!', 'error');
            }
        } catch (err: any) {
            showToast('Ошибка проверки: ' + err.message, 'error');
        } finally {
            setVerifyingId(null);
        }
    };

    const handleDelete = async (lockId: string, period: string) => {
        if (!confirm(`Снять блокировку с периода ${period}? Документы станут доступны для редактирования.`)) {
            return;
        }
        try {
            await deletePeriodLock(lockId);
            showToast(`Блокировка периода ${period} снята`, 'info');
            loadLocks();
        } catch (err: any) {
            showToast('Ошибка: ' + err.message, 'error');
        }
    };

    const formatHash = (hash: string) => hash.substring(0, 12) + '...';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
                        Целостность данных
                    </h3>
                    <p className="text-sm text-gray-500">
                        Управление закрытыми периодами и контроль неизменности исторических данных
                    </p>
                </div>
            </div>

            {/* Close Period Form */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold mb-3">Закрыть период</h4>
                <div className="flex gap-3 items-end flex-wrap">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Год</label>
                        <select
                            value={newPeriod.split('-')[0] || ''}
                            onChange={e => {
                                const year = e.target.value;
                                const month = newPeriod.split('-')[1] || '01';
                                setNewPeriod(year ? `${year}-${month}` : '');
                            }}
                            className="w-24 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        >
                            <option value="">Год</option>
                            {Array.from({ length: 5 }, (_, i) => {
                                const year = new Date().getFullYear() - i;
                                return <option key={year} value={year}>{year}</option>;
                            })}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Месяц</label>
                        <select
                            value={newPeriod.split('-')[1] || ''}
                            onChange={e => {
                                const year = newPeriod.split('-')[0] || String(new Date().getFullYear());
                                const month = e.target.value;
                                setNewPeriod(month ? `${year}-${month}` : '');
                            }}
                            className="w-32 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        >
                            <option value="">Месяц</option>
                            {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m, i) => {
                                const names = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
                                return <option key={m} value={m}>{names[i]}</option>;
                            })}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Примечание</label>
                        <input
                            type="text"
                            placeholder="Причина закрытия..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>
                    <button
                        onClick={handleClosePeriod}
                        disabled={isClosing || !newPeriod || !/^\d{4}-\d{2}$/.test(newPeriod)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <PlusIcon className="h-4 w-4" />
                        {isClosing ? 'Закрытие...' : 'Закрыть период'}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="px-4 py-3 text-left">Период</th>
                            <th className="px-4 py-3 text-left">Дата закрытия</th>
                            <th className="px-4 py-3 text-left">Автор</th>
                            <th className="px-4 py-3 text-left">Хэш</th>
                            <th className="px-4 py-3 text-center">Записей</th>
                            <th className="px-4 py-3 text-center">Статус</th>
                            <th className="px-4 py-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Загрузка...</td></tr>
                        ) : locks.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Нет закрытых периодов</td></tr>
                        ) : locks.map(lock => {
                            const result = verifyResults[lock.id];
                            const isBusy = verifyingId === lock.id;

                            return (
                                <tr key={lock.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-4 py-3 font-semibold">{lock.period}</td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {new Date(lock.lockedAt).toLocaleDateString('ru-RU')}
                                    </td>
                                    <td className="px-4 py-3">{lock.lockedByUser?.fullName || lock.lockedByUserId}</td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded" title={lock.dataHash}>
                                            {formatHash(lock.dataHash)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">{lock.recordCount}</td>
                                    <td className="px-4 py-3 text-center">
                                        {isBusy ? (
                                            <span className="text-indigo-600">Проверка...</span>
                                        ) : result ? (
                                            result.isValid ? (
                                                <span className="text-green-600 font-bold">✓ Целостность OK</span>
                                            ) : (
                                                <span className="text-red-600 font-bold">✗ Нарушение!</span>
                                            )
                                        ) : lock.lastVerifyResult !== null ? (
                                            lock.lastVerifyResult ? (
                                                <span className="text-green-500 text-xs">✓ Проверен</span>
                                            ) : (
                                                <span className="text-red-500 text-xs">✗ Ошибка</span>
                                            )
                                        ) : (
                                            <span className="text-gray-400 text-xs">Не проверялся</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleVerify(lock.id)}
                                                disabled={isBusy}
                                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-50"
                                                title="Проверить целостность"
                                            >
                                                <ShieldCheckIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(lock.id, lock.period)}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                title="Снять блокировку"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default IntegrityManagement;

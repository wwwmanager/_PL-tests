import React, { useState, useEffect, useMemo } from 'react';
import {
    getTopUpRules,
    getResetRules,
    runTopUpJob,
    runResetRules,
    createTopUpRule,
    getFuelCards,
    type TopUpRule,
    type ResetRule,
    type FuelCard,
} from '../../services/stockApi';
import DataTable from '../shared/DataTable';
import Modal from '../shared/Modal';
import { useToast } from '../../hooks/useToast';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';
import { PlusIcon, ArrowUturnLeftIcon, StatusActiveIcon } from '../Icons';

// ==================== CREATE TOPUP RULE MODAL ====================

interface CreateTopUpRuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

function CreateTopUpRuleModal({ isOpen, onClose, onSuccess }: CreateTopUpRuleModalProps) {
    const [cards, setCards] = useState<FuelCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState('');
    const [scheduleType, setScheduleType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
    const [amountLiters, setAmountLiters] = useState('');
    const [minBalanceLiters, setMinBalanceLiters] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getFuelCards()
                .then(setCards)
                .finally(() => setLoading(false));
            setSelectedCardId('');
            setScheduleType('DAILY');
            setAmountLiters('');
            setMinBalanceLiters('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCardId) {
            showToast('Выберите топливную карту', 'error');
            return;
        }
        const amount = parseFloat(amountLiters);
        if (isNaN(amount) || amount <= 0) {
            showToast('Введите корректное количество литров', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await createTopUpRule(selectedCardId, {
                scheduleType,
                amountLiters: amount,
                minBalanceLiters: minBalanceLiters ? parseFloat(minBalanceLiters) : undefined,
                isActive: true,
            });
            showToast('Правило автопополнения создано', 'success');
            onSuccess();
            onClose();
        } catch (err: any) {
            showToast('Ошибка создания правила: ' + (err.message || 'Неизвестная ошибка'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedCard = cards.find(c => c.id === selectedCardId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Создание правила автопополнения">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Топливная карта *
                    </label>
                    <select
                        value={selectedCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                    >
                        <option value="">Выберите карту...</option>
                        {cards.map((card) => (
                            <option key={card.id} value={card.id}>
                                {card.cardNumber} {card.provider ? `(${card.provider})` : ''}
                            </option>
                        ))}
                    </select>
                    {selectedCard?.assignedToDriver && (
                        <p className="text-sm text-gray-500 mt-1">
                            Водитель: {selectedCard.assignedToDriver.fullName}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Расписание *
                    </label>
                    <select
                        value={scheduleType}
                        onChange={(e) => setScheduleType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                        <option value="DAILY">Ежедневно</option>
                        <option value="WEEKLY">Еженедельно</option>
                        <option value="MONTHLY">Ежемесячно</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Количество литров *
                    </label>
                    <input
                        type="number"
                        value={amountLiters}
                        onChange={(e) => setAmountLiters(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="100"
                        min="0"
                        step="0.1"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Мин. баланс для пополнения (опционально)
                    </label>
                    <input
                        type="number"
                        value={minBalanceLiters}
                        onChange={(e) => setMinBalanceLiters(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Пополнять при балансе ниже..."
                        min="0"
                        step="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Если указано, пополнение произойдёт только если баланс карты ниже этого значения
                    </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || loading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                        {submitting ? 'Создание...' : 'Создать правило'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ==================== RULES COMPONENT ====================

const FuelRules: React.FC = () => {
    const [topUpRules, setTopUpRules] = useState<TopUpRule[]>([]);
    const [resetRules, setResetRules] = useState<ResetRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [runningJob, setRunningJob] = useState(false);
    const [createRuleModalOpen, setCreateRuleModalOpen] = useState(false);
    const { showToast } = useToast();

    const loadRules = async () => {
        setLoading(true);
        try {
            const [topUp, reset] = await Promise.all([
                getTopUpRules(),
                getResetRules(),
            ]);
            setTopUpRules(topUp);
            setResetRules(reset);
        } catch (err: any) {
            showToast('Ошибка загрузки правил: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRules();
    }, []);

    const handleRunTopUp = async () => {
        setRunningJob(true);
        try {
            const result = await runTopUpJob();
            showToast(`Обработано: ${result.processed}, пополнено: ${result.toppedUp}, пропущено: ${result.skipped}`, 'success');
            await loadRules();
        } catch (err: any) {
            showToast('Ошибка запуска пополнения: ' + err.message, 'error');
        } finally {
            setRunningJob(false);
        }
    };

    const handleRunReset = async () => {
        setRunningJob(true);
        try {
            const result = await runResetRules();
            showToast(`Обработано: ${result.processed}, обнулено: ${result.reset}, пропущено: ${result.skipped}`, 'success');
            await loadRules();
        } catch (err: any) {
            showToast('Ошибка запуска обнуления: ' + err.message, 'error');
        } finally {
            setRunningJob(false);
        }
    };

    const topUpColumns = useMemo(() => [
        { key: 'fuelCardNumber', label: 'Карта', sortable: true },
        {
            key: 'isActive',
            label: 'Активно',
            render: (row: TopUpRule) => row.isActive ? '✅' : '❌'
        },
        { key: 'scheduleType', label: 'Расписание', sortable: true },
        { key: 'amountLiters', label: 'Кол-во (л)', sortable: true },
        { key: 'minBalanceLiters', label: 'Мин. баланс', sortable: true },
        {
            key: 'nextRunAt',
            label: 'След. запуск',
            render: (row: TopUpRule) => row.nextRunAt ? new Date(row.nextRunAt).toLocaleString('ru-RU') : '-'
        },
    ], []);

    const resetColumns = useMemo(() => [
        { key: 'name', label: 'Название', sortable: true },
        {
            key: 'isActive',
            label: 'Активно',
            render: (row: ResetRule) => row.isActive ? '✅' : '❌'
        },
        { key: 'frequency', label: 'Частота', sortable: true },
        { key: 'scope', label: 'Область', sortable: true },
        {
            key: 'mode',
            label: 'Режим',
            render: (row: ResetRule) => row.mode === 'TRANSFER_TO_WAREHOUSE' ? '↩️ На склад' : '🔥 Сгорание'
        },
        {
            key: 'nextRunAt',
            label: 'След. запуск',
            render: (row: ResetRule) => row.nextRunAt ? new Date(row.nextRunAt).toLocaleString('ru-RU') : '-'
        },
    ], []);

    return (
        <div className="p-0 space-y-8">
            {/* Top-Up Rules */}
            <section className="space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Правила автопополнения</h3>
                        <p className="text-sm text-gray-500">Автоматическое зачисление ГСМ на карты по расписанию</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleRunTopUp}
                            disabled={runningJob}
                            variant="success"
                            size="sm"
                            leftIcon={<StatusActiveIcon className="h-4 w-4" />}
                        >
                            {runningJob ? 'Выполняется...' : 'Запустить сейчас'}
                        </Button>
                        <Button
                            onClick={() => setCreateRuleModalOpen(true)}
                            variant="primary"
                            size="sm"
                            leftIcon={<PlusIcon className="h-4 w-4" />}
                        >
                            Создать правило
                        </Button>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                    <DataTable
                        tableId="fuel-topup-rules"
                        columns={topUpColumns}
                        data={topUpRules}
                        keyField="id"
                        isLoading={loading}
                        emptyMessage="Нет правил автопополнения"
                        searchable={true}
                    />
                </div>
            </section>

            {/* Reset Rules */}
            <section className="space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Правила обнуления</h3>
                        <p className="text-sm text-gray-500">Автоматический сброс остатков на картах в конце дня/смены</p>
                    </div>
                    <Button
                        onClick={handleRunReset}
                        disabled={runningJob}
                        variant="warning"
                        size="sm"
                        leftIcon={<ArrowUturnLeftIcon className="h-4 w-4" />}
                    >
                        {runningJob ? 'Выполняется...' : 'Запустить обнуление'}
                    </Button>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                    <DataTable
                        tableId="fuel-reset-rules"
                        columns={resetColumns}
                        data={resetRules}
                        keyField="id"
                        isLoading={loading}
                        emptyMessage="Нет правил обнуления"
                        searchable={true}
                    />
                </div>
            </section>

            <CreateTopUpRuleModal
                isOpen={createRuleModalOpen}
                onClose={() => setCreateRuleModalOpen(false)}
                onSuccess={loadRules}
            />
        </div>
    );
};

export default FuelRules;

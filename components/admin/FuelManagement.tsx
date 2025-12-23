/**
 * REL-107: Fuel Management UI
 * 
 * Tabs:
 * - Balances: View balances at specific date by location
 * - Movements: View stock movements journal with filters
 * - Fuel Cards: Manage cards and assignments
 * - Rules: Manage top-up and reset rules
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
    getBalancesAt,
    getMovementsV2,
    getFuelCards,
    getStockLocations,
    getTopUpRules,
    getResetRules,
    runTopUpJob,
    runResetRules,
    previewResetRules,
    getOrCreateFuelCardLocation,
    getFuelTypes,
    getWarehouses,
    createTransferMovement,
    createFuelCard,
    type LocationBalance,
    type StockMovementV2,
    type FuelCard,
    type StockLocation,
    type TopUpRule,
    type ResetRule,
    type StockItemOption,
} from '../../services/stockApi';
import DataTable from '../shared/DataTable';
import CollapsibleSection from '../shared/CollapsibleSection';
import Modal from '../shared/Modal';
import { useToast } from '../../hooks/useToast';

// ==================== BALANCES TAB ====================

function BalancesTab() {
    const [asOf, setAsOf] = useState<string>(new Date().toISOString().slice(0, 16));
    const [balances, setBalances] = useState<LocationBalance[]>([]);
    const [loading, setLoading] = useState(false);
    const [locationFilter, setLocationFilter] = useState<string>('');
    const { showToast } = useToast();

    const loadBalances = async () => {
        setLoading(true);
        try {
            const date = new Date(asOf);
            const data = await getBalancesAt(date);
            setBalances(data);
        } catch (err: any) {
            showToast('Ошибка загрузки балансов: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBalances();
    }, []);

    const filteredBalances = useMemo(() => {
        if (!locationFilter) return balances;
        return balances.filter(b =>
            b.locationName.toLowerCase().includes(locationFilter.toLowerCase()) ||
            b.locationType.toLowerCase().includes(locationFilter.toLowerCase())
        );
    }, [balances, locationFilter]);

    const columns = [
        { key: 'locationName', label: 'Локация', sortable: true },
        {
            key: 'locationType',
            label: 'Тип',
            sortable: true,
            render: (row: LocationBalance) => {
                const typeLabels: Record<string, string> = {
                    'WAREHOUSE': '🏭 Склад',
                    'FUEL_CARD': '💳 Карта',
                    'VEHICLE_TANK': '🚛 Бак ТС',
                };
                return typeLabels[row.locationType] || row.locationType;
            }
        },
        { key: 'stockItemName', label: 'Товар', sortable: true },
        {
            key: 'balance',
            label: 'Баланс',
            sortable: true,
            render: (row: LocationBalance) => (
                <span className={row.balance < 0 ? 'text-red-600 font-bold' : row.balance > 0 ? 'text-green-600' : ''}>
                    {Number(row.balance).toFixed(2)} {row.unit}
                </span>
            )
        },
    ];

    return (
        <div className="space-y-4">
            <CollapsibleSection title="Фильтры" defaultOpen>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            На дату/время
                        </label>
                        <input
                            type="datetime-local"
                            value={asOf}
                            onChange={(e) => setAsOf(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Поиск по локации
                        </label>
                        <input
                            type="text"
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            placeholder="Введите название..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={loadBalances}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Загрузка...' : 'Обновить'}
                        </button>
                    </div>
                </div>
            </CollapsibleSection>

            <DataTable
                columns={columns}
                data={filteredBalances}
                keyField="locationId"
                emptyMessage="Нет данных о балансах"
            />
        </div>
    );
}

// ==================== MOVEMENTS TAB ====================

function MovementsTab() {
    const [movements, setMovements] = useState<StockMovementV2[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
        movementType: '',
    });
    const { showToast } = useToast();

    const loadMovements = async () => {
        setLoading(true);
        try {
            const data = await getMovementsV2({
                from: new Date(filters.from),
                to: new Date(filters.to),
                movementType: filters.movementType || undefined,
            });
            setMovements(data);
        } catch (err: any) {
            showToast('Ошибка загрузки движений: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMovements();
    }, []);

    const columns = [
        {
            key: 'occurredAt',
            label: 'Дата операции',
            sortable: true,
            render: (row: StockMovementV2) => new Date(row.occurredAt).toLocaleString('ru-RU')
        },
        {
            key: 'movementType',
            label: 'Тип',
            sortable: true,
            render: (row: StockMovementV2) => {
                const typeLabels: Record<string, { label: string; color: string }> = {
                    'INCOME': { label: 'Приход', color: 'bg-green-100 text-green-800' },
                    'EXPENSE': { label: 'Расход', color: 'bg-red-100 text-red-800' },
                    'ADJUSTMENT': { label: 'Корр.', color: 'bg-yellow-100 text-yellow-800' },
                    'TRANSFER': { label: 'Перемещ.', color: 'bg-blue-100 text-blue-800' },
                };
                const type = typeLabels[row.movementType] || { label: row.movementType, color: 'bg-gray-100' };
                return <span className={`px-2 py-1 rounded text-xs ${type.color}`}>{type.label}</span>;
            }
        },
        { key: 'stockItemName', label: 'Товар', sortable: true },
        {
            key: 'quantity',
            label: 'Кол-во',
            sortable: true,
            render: (row: StockMovementV2) => Number(row.quantity).toFixed(2)
        },
        {
            key: 'stockLocationName',
            label: 'Локация',
            sortable: true,
            render: (row: StockMovementV2) => {
                if (row.movementType === 'TRANSFER') {
                    return `${row.fromStockLocationName || '?'} → ${row.toStockLocationName || '?'}`;
                }
                return row.stockLocationName || '-';
            }
        },
        { key: 'documentType', label: 'Документ', sortable: true },
        { key: 'comment', label: 'Комментарий' },
        {
            key: 'createdAt',
            label: 'Создано',
            sortable: true,
            render: (row: StockMovementV2) => new Date(row.createdAt).toLocaleString('ru-RU')
        },
    ];

    return (
        <div className="space-y-4">
            <CollapsibleSection title="Фильтры" defaultOpen>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">С</label>
                        <input
                            type="date"
                            value={filters.from}
                            onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">По</label>
                        <input
                            type="date"
                            value={filters.to}
                            onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                        <select
                            value={filters.movementType}
                            onChange={(e) => setFilters(f => ({ ...f, movementType: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="">Все</option>
                            <option value="INCOME">Приход</option>
                            <option value="EXPENSE">Расход</option>
                            <option value="TRANSFER">Перемещение</option>
                            <option value="ADJUSTMENT">Корректировка</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={loadMovements}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Загрузка...' : 'Применить'}
                        </button>
                    </div>
                </div>
            </CollapsibleSection>

            <DataTable
                columns={columns}
                data={movements}
                keyField="id"
                emptyMessage="Нет движений за выбранный период"
            />
        </div>
    );
}

// ==================== MANUAL TOP-UP MODAL ====================

interface ManualTopUpModalProps {
    card: FuelCard;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

function ManualTopUpModal({ card, isOpen, onClose, onSuccess }: ManualTopUpModalProps) {
    const [fuelTypes, setFuelTypes] = useState<StockItemOption[]>([]);
    const [warehouses, setWarehouses] = useState<StockLocation[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        stockItemId: '',
        fromLocationId: '',
        quantity: '',
        occurredAt: new Date().toISOString().slice(0, 16),
        comment: '',
    });

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            Promise.all([getFuelTypes(), getWarehouses()])
                .then(([fuels, whs]) => {
                    setFuelTypes(fuels);
                    setWarehouses(whs);
                    if (fuels.length > 0) setFormData(f => ({ ...f, stockItemId: fuels[0].id }));
                    if (whs.length > 0) setFormData(f => ({ ...f, fromLocationId: whs[0].id }));
                })
                .catch(err => showToast('Ошибка загрузки данных: ' + err.message, 'error'))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.stockItemId || !formData.fromLocationId || !formData.quantity) {
            showToast('Заполните все обязательные поля', 'error');
            return;
        }

        const qty = parseFloat(formData.quantity);
        if (isNaN(qty) || qty <= 0) {
            showToast('Количество должно быть положительным числом', 'error');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Get or create fuel card location
            const cardLocation = await getOrCreateFuelCardLocation(card.id);
            console.log('📡 [ManualTopUp] Card location:', cardLocation);

            // 2. Create TRANSFER movement
            const externalRef = `MANUAL_TOPUP:${crypto.randomUUID()}`;
            const occurredAt = new Date(formData.occurredAt).toISOString();

            await createTransferMovement({
                stockItemId: formData.stockItemId,
                quantity: qty,
                fromLocationId: formData.fromLocationId,
                toLocationId: cardLocation.id,
                occurredAt,
                externalRef,
                comment: formData.comment || `Ручное пополнение карты ${card.cardNumber}`,
            });

            showToast(`Карта ${card.cardNumber} пополнена на ${qty} л`, 'success');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('[ManualTopUp] Error:', err);
            showToast('Ошибка пополнения: ' + (err.message || 'Неизвестная ошибка'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Пополнить карту ${card.cardNumber}`}>
            {loading ? (
                <div className="text-center py-8">Загрузка...</div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Тип топлива *
                        </label>
                        <select
                            value={formData.stockItemId}
                            onChange={(e) => setFormData(f => ({ ...f, stockItemId: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            required
                        >
                            <option value="">Выберите...</option>
                            {fuelTypes.map(ft => (
                                <option key={ft.id} value={ft.id}>{ft.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Склад-источник *
                        </label>
                        <select
                            value={formData.fromLocationId}
                            onChange={(e) => setFormData(f => ({ ...f, fromLocationId: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            required
                        >
                            <option value="">Выберите...</option>
                            {warehouses.map(wh => (
                                <option key={wh.id} value={wh.id}>{wh.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Количество (л) *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={formData.quantity}
                            onChange={(e) => setFormData(f => ({ ...f, quantity: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="например: 50.00"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Дата/время операции
                        </label>
                        <input
                            type="datetime-local"
                            value={formData.occurredAt}
                            onChange={(e) => setFormData(f => ({ ...f, occurredAt: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Комментарий
                        </label>
                        <input
                            type="text"
                            value={formData.comment}
                            onChange={(e) => setFormData(f => ({ ...f, comment: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Необязательно"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            disabled={submitting}
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                            {submitting ? 'Пополнение...' : '💳 Пополнить'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}

// ==================== CREATE FUEL CARD MODAL ====================

interface CreateFuelCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

function CreateFuelCardModal({ isOpen, onClose, onSuccess }: CreateFuelCardModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        cardNumber: '',
        provider: '',
        isActive: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.cardNumber.trim()) {
            showToast('Введите номер карты', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await createFuelCard({
                cardNumber: formData.cardNumber.trim(),
                provider: formData.provider.trim() || undefined,
                isActive: formData.isActive,
            });

            showToast(`Карта ${formData.cardNumber} создана`, 'success');
            setFormData({ cardNumber: '', provider: '', isActive: true });
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('[CreateFuelCard] Error:', err);
            showToast('Ошибка создания карты: ' + (err.message || 'Неизвестная ошибка'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Создать топливную карту">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Номер карты *
                    </label>
                    <input
                        type="text"
                        value={formData.cardNumber}
                        onChange={(e) => setFormData(f => ({ ...f, cardNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="например: 1234-5678-9012"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Поставщик
                    </label>
                    <input
                        type="text"
                        value={formData.provider}
                        onChange={(e) => setFormData(f => ({ ...f, provider: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="например: Роснефть, Газпромнефть"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(f => ({ ...f, isActive: e.target.checked }))}
                        className="w-4 h-4"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">
                        Активна
                    </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        disabled={submitting}
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {submitting ? 'Создание...' : '➕ Создать'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ==================== FUEL CARDS TAB ====================

function FuelCardsTab() {
    const [cards, setCards] = useState<FuelCard[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCard, setSelectedCard] = useState<FuelCard | null>(null);
    const [topUpModalOpen, setTopUpModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const { showToast } = useToast();

    const loadCards = async () => {
        setLoading(true);
        try {
            const data = await getFuelCards();
            setCards(data);
        } catch (err: any) {
            showToast('Ошибка загрузки карт: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCards();
    }, []);

    const handleTopUp = (card: FuelCard) => {
        setSelectedCard(card);
        setTopUpModalOpen(true);
    };

    const handleTopUpSuccess = () => {
        loadCards();
        // Note: Balance will be visible in Balances tab (ledger source of truth)
    };

    const columns = [
        { key: 'cardNumber', label: 'Номер карты', sortable: true },
        { key: 'provider', label: 'Поставщик', sortable: true },
        {
            key: 'isActive',
            label: 'Статус',
            sortable: true,
            render: (row: FuelCard) => (
                <span className={`px-2 py-1 rounded text-xs ${row.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {row.isActive ? 'Активна' : 'Неактивна'}
                </span>
            )
        },
        // FUEL-TOPUP-006: Removed balanceLiters column - use Balances tab for accurate ledger data
        {
            key: 'actions',
            label: 'Действия',
            render: (row: FuelCard) => (
                <button
                    onClick={() => handleTopUp(row)}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                    title="Пополнить карту"
                >
                    💳 Пополнить
                </button>
            )
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Топливные карты</h3>
                    <p className="text-sm text-gray-500">
                        💡 Баланс карт смотрите во вкладке <strong>"Балансы"</strong> (данные из ledger)
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                        ➕ Создать карту
                    </button>
                    <button
                        onClick={loadCards}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Загрузка...' : 'Обновить'}
                    </button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={cards}
                keyField="id"
                emptyMessage="Нет топливных карт. Нажмите «Создать карту» чтобы добавить."
            />

            {selectedCard && (
                <ManualTopUpModal
                    card={selectedCard}
                    isOpen={topUpModalOpen}
                    onClose={() => {
                        setTopUpModalOpen(false);
                        setSelectedCard(null);
                    }}
                    onSuccess={handleTopUpSuccess}
                />
            )}

            <CreateFuelCardModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSuccess={loadCards}
            />
        </div>
    );
}


// ==================== RULES TAB ====================

function RulesTab() {
    const [topUpRules, setTopUpRules] = useState<TopUpRule[]>([]);
    const [resetRules, setResetRules] = useState<ResetRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [runningJob, setRunningJob] = useState(false);
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

    const topUpColumns = [
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
    ];

    const resetColumns = [
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
    ];

    return (
        <div className="space-y-6">
            {/* Top-Up Rules */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Правила автопополнения</h3>
                    <button
                        onClick={handleRunTopUp}
                        disabled={runningJob}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                        {runningJob ? 'Выполняется...' : '▶ Запустить сейчас'}
                    </button>
                </div>
                <DataTable
                    columns={topUpColumns}
                    data={topUpRules}
                    keyField="id"
                    emptyMessage="Нет правил автопополнения"
                />
            </div>

            {/* Reset Rules */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Правила обнуления</h3>
                    <button
                        onClick={handleRunReset}
                        disabled={runningJob}
                        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                    >
                        {runningJob ? 'Выполняется...' : '▶ Запустить обнуление'}
                    </button>
                </div>
                <DataTable
                    columns={resetColumns}
                    data={resetRules}
                    keyField="id"
                    emptyMessage="Нет правил обнуления"
                />
            </div>
        </div>
    );
}

// ==================== MAIN COMPONENT ====================

type FuelTab = 'balances' | 'movements' | 'cards' | 'rules';

export default function FuelManagement() {
    const [activeTab, setActiveTab] = useState<FuelTab>('balances');

    const TabButton = ({ tab, label, icon }: { tab: FuelTab; label: string; icon: string }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${activeTab === tab
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
        >
            <span>{icon}</span>
            <span>{label}</span>
        </button>
    );

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Управление топливом</h2>

            <div className="flex gap-2 mb-4 border-b border-gray-200">
                <TabButton tab="balances" label="Балансы" icon="📊" />
                <TabButton tab="movements" label="Журнал движений" icon="📋" />
                <TabButton tab="cards" label="Топливные карты" icon="💳" />
                <TabButton tab="rules" label="Правила" icon="⚙️" />
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
                {activeTab === 'balances' && <BalancesTab />}
                {activeTab === 'movements' && <MovementsTab />}
                {activeTab === 'cards' && <FuelCardsTab />}
                {activeTab === 'rules' && <RulesTab />}
            </div>
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import {
    getFuelCards,
    getTopUpRules,
    getOrCreateFuelCardLocation,
    getFuelTypes,
    getWarehouses,
    createTransferMovement,
    createFuelCard,
    assignFuelCard,
    searchDrivers,
    deleteFuelCard,
    resetFuelCard,
    type FuelCard,
    type StockLocation,
    type StockItemOption,
    type DriverSearchResult,
} from '../../services/stockApi';
import DataTable from '../shared/DataTable';
import Modal from '../shared/Modal';
import { useToast } from '../../hooks/useToast';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';
import { PlusIcon, ArrowUturnLeftIcon, BanknotesIcon, UserGroupIcon, TrashIcon, FuelCardIcon } from '../Icons';

// ... (in the return of FuelCards)
// I'll place the header inside the return below line 751


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
                            onWheel={(e) => e.currentTarget.blur()}
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

// ==================== ASSIGN DRIVER MODAL ====================

interface AssignDriverModalProps {
    card: FuelCard;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

function AssignDriverModal({ card, isOpen, onClose, onSuccess }: AssignDriverModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [drivers, setDrivers] = useState<DriverSearchResult[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<DriverSearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    // Debounced search
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setLoading(true);
                try {
                    const results = await searchDrivers(searchQuery);
                    setDrivers(results);
                } catch (err) {
                    console.error('Driver search error:', err);
                } finally {
                    setLoading(false);
                }
            } else if (searchQuery.length === 0) {
                // Load all drivers when empty
                setLoading(true);
                try {
                    const results = await searchDrivers('');
                    setDrivers(results);
                } catch (err) {
                    console.error('Driver search error:', err);
                } finally {
                    setLoading(false);
                }
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSelectedDriver(null);
            setDrivers([]);
        }
    }, [isOpen]);

    const handleAssign = async () => {
        if (!selectedDriver) {
            showToast('Выберите водителя', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await assignFuelCard(card.id, selectedDriver.id);
            showToast(`Карта ${card.cardNumber} привязана к ${selectedDriver.fullName}`, 'success');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Assign error:', err);
            showToast('Ошибка привязки: ' + (err.message || 'Неизвестная ошибка'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUnassign = async () => {
        setSubmitting(true);
        try {
            await assignFuelCard(card.id, null);
            showToast(`Карта ${card.cardNumber} отвязана от водителя`, 'success');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Unassign error:', err);
            showToast('Ошибка отвязки: ' + (err.message || 'Неизвестная ошибка'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Привязка карты ${card.cardNumber}`}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Поиск водителя по ФИО
                    </label>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSelectedDriver(null);
                        }}
                        placeholder="Введите часть ФИО..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {loading && (
                    <div className="text-center text-gray-500 py-2">Поиск...</div>
                )}

                {!loading && drivers.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                        {drivers.map((driver) => (
                            <div
                                key={driver.id}
                                onClick={() => setSelectedDriver(driver)}
                                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${selectedDriver?.id === driver.id ? 'bg-blue-100 font-medium' : ''
                                    }`}
                            >
                                {driver.fullName}
                            </div>
                        ))}
                    </div>
                )}

                {!loading && searchQuery.length >= 2 && drivers.length === 0 && (
                    <div className="text-center text-gray-500 py-2">Водители не найдены</div>
                )}

                {selectedDriver && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                        <strong>Выбран:</strong> {selectedDriver.fullName}
                    </div>
                )}

                <div className="flex justify-between gap-2 pt-4">
                    <button
                        type="button"
                        onClick={handleUnassign}
                        disabled={submitting}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50"
                    >
                        Отвязать от водителя
                    </button>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                        >
                            Отмена
                        </button>
                        <button
                            type="button"
                            onClick={handleAssign}
                            disabled={!selectedDriver || submitting}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting ? 'Сохранение...' : 'Привязать'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

// ==================== RESET CARD MODAL ====================

interface ResetCardModalProps {
    card: FuelCard;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

function ResetCardModal({ card, isOpen, onClose, onSuccess }: ResetCardModalProps) {
    const [fuelTypes, setFuelTypes] = useState<StockItemOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        stockItemId: '',
        reason: 'Ручное обнуление баланса карты',
        mode: 'EXPIRE_EXPENSE' as 'EXPIRE_EXPENSE' | 'TRANSFER_TO_WAREHOUSE',
    });

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getFuelTypes()
                .then((fuels) => {
                    setFuelTypes(fuels);
                    if (fuels.length > 0) setFormData(f => ({ ...f, stockItemId: fuels[0].id }));
                })
                .catch(err => showToast('Ошибка загрузки типов топлива: ' + err.message, 'error'))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.stockItemId) {
            showToast('Выберите тип топлива', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const result = await resetFuelCard(card.id, {
                stockItemId: formData.stockItemId,
                reason: formData.reason || 'Ручное обнуление',
                mode: formData.mode,
            });

            if (result.previousBalance !== 0) {
                if (result.previousBalance > 0) {
                    showToast(`Карта ${card.cardNumber} обнулена. Списано: ${result.previousBalance.toFixed(2)} л`, 'success');
                } else {
                    showToast(`Карта ${card.cardNumber} восстановлена. Покрыт долг: ${Math.abs(result.previousBalance).toFixed(2)} л`, 'success');
                }
            } else {
                showToast(`Карта ${card.cardNumber} уже имеет нулевой баланс`, 'info');
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('[ResetCard] Error:', err);
            showToast('Ошибка обнуления: ' + (err.message || 'Неизвестная ошибка'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Обнулить карту ${card.cardNumber}`}>
            {loading ? (
                <div className="text-center py-8">Загрузка...</div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-sm text-yellow-800">
                            ⚠️ Текущий баланс карты: <strong>{Number(card.balanceLiters || 0).toFixed(2)} л</strong>
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                            Баланс будет списан и обнулён.
                        </p>
                    </div>

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
                            Режим обнуления
                        </label>
                        <select
                            value={formData.mode}
                            onChange={(e) => setFormData(f => ({ ...f, mode: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="EXPIRE_EXPENSE">Списание (сгорание)</option>
                            <option value="TRANSFER_TO_WAREHOUSE">Возврат на склад</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Причина
                        </label>
                        <input
                            type="text"
                            value={formData.reason}
                            onChange={(e) => setFormData(f => ({ ...f, reason: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Причина обнуления"
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
                            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                        >
                            {submitting ? 'Обнуление...' : '🔄 Обнулить'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}

// ==================== FUEL CARDS COMPONENT ====================

const FuelCards: React.FC = () => {
    const [cards, setCards] = useState<FuelCard[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCard, setSelectedCard] = useState<FuelCard | null>(null);
    const [topUpModalOpen, setTopUpModalOpen] = useState(false);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [deleteConfirmCard, setDeleteConfirmCard] = useState<FuelCard | null>(null);
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

    const handleAssign = (card: FuelCard) => {
        setSelectedCard(card);
        setAssignModalOpen(true);
    };

    const handleReset = (card: FuelCard) => {
        setSelectedCard(card);
        setResetModalOpen(true);
    };

    const handleTopUpSuccess = () => {
        loadCards();
    };

    const handleAssignSuccess = () => {
        loadCards();
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmCard) return;
        try {
            await deleteFuelCard(deleteConfirmCard.id);
            showToast(`Карта ${deleteConfirmCard.cardNumber} удалена`, 'success');
            loadCards();
        } catch (err: any) {
            showToast('Ошибка удаления: ' + (err.message || 'Неизвестная ошибка'), 'error');
        } finally {
            setDeleteConfirmCard(null);
        }
    };

    const columns = useMemo(() => [
        { key: 'cardNumber', label: 'Номер карты', sortable: true },
        { key: 'provider', label: 'Поставщик', sortable: true },
        {
            key: 'assignedDriver',
            label: 'Водитель',
            sortable: true,
            render: (row: FuelCard) => (
                <span className={row.assignedToDriver ? 'text-gray-900' : 'text-gray-400 italic'}>
                    {row.assignedToDriver?.fullName || 'Не назначен'}
                </span>
            )
        },
        {
            key: 'isActive',
            label: 'Статус',
            sortable: true,
            render: (row: FuelCard) => (
                <Badge variant={row.isActive ? 'success' : 'danger'}>
                    {row.isActive ? 'Активна' : 'Неактивна'}
                </Badge>
            )
        },
        {
            key: 'balanceLiters',
            label: 'Баланс (л)',
            sortable: true,
            render: (row: FuelCard) => (
                <span className={`font-bold ${row.balanceLiters < 100 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                    {Number(row.balanceLiters || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                </span>
            )
        },
    ], []);

    return (
        <div className="p-0 space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <FuelCardIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Топливные карты</h3>
            </div>
            <div className="flex justify-end items-center">
                <div className="flex gap-2">
                    <Button
                        onClick={loadCards}
                        disabled={loading}
                        variant="ghost"
                        size="sm"
                        leftIcon={<ArrowUturnLeftIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
                    >
                        Обновить
                    </Button>
                    <Button
                        onClick={() => setCreateModalOpen(true)}
                        variant="primary"
                        size="sm"
                        leftIcon={<PlusIcon className="h-4 w-4" />}
                    >
                        Создать карту
                    </Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                <DataTable
                    tableId="fuel-cards"
                    columns={columns}
                    data={cards}
                    keyField="id"
                    isLoading={loading}
                    emptyMessage="Топливные карты не найдены"
                    actions={[
                        {
                            icon: <BanknotesIcon className="h-4 w-4" />,
                            onClick: (row) => handleTopUp(row),
                            title: "Пополнить карту",
                            className: "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        },
                        {
                            icon: <UserGroupIcon className="h-4 w-4" />,
                            onClick: (row) => handleAssign(row),
                            title: "Привязать к водителю",
                            className: "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        },
                        {
                            icon: <ArrowUturnLeftIcon className="h-4 w-4" />,
                            onClick: (row) => handleReset(row),
                            title: "Обнулить баланс",
                            className: "text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        },
                        {
                            icon: <TrashIcon className="h-4 w-4" />,
                            onClick: (row) => setDeleteConfirmCard(row),
                            title: "Удалить карту",
                            className: "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        }
                    ]}
                />
            </div>

            {selectedCard && (
                <>
                    <ManualTopUpModal
                        card={selectedCard}
                        isOpen={topUpModalOpen}
                        onClose={() => {
                            setTopUpModalOpen(false);
                            setSelectedCard(null);
                        }}
                        onSuccess={handleTopUpSuccess}
                    />
                    <AssignDriverModal
                        card={selectedCard}
                        isOpen={assignModalOpen}
                        onClose={() => {
                            setAssignModalOpen(false);
                            setSelectedCard(null);
                        }}
                        onSuccess={handleAssignSuccess}
                    />
                    <ResetCardModal
                        card={selectedCard}
                        isOpen={resetModalOpen}
                        onClose={() => {
                            setResetModalOpen(false);
                            setSelectedCard(null);
                        }}
                        onSuccess={loadCards}
                    />
                </>
            )}

            <CreateFuelCardModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSuccess={loadCards}
            />

            {/* Delete Confirmation Modal */}
            {deleteConfirmCard && (
                <Modal isOpen={true} onClose={() => setDeleteConfirmCard(null)} title="Подтверждение удаления">
                    <div className="space-y-4">
                        <p>Вы уверены, что хотите удалить карту <strong>{deleteConfirmCard.cardNumber}</strong>?</p>
                        <p className="text-sm text-gray-500">Это действие нельзя отменить.</p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmCard(null)}>Отмена</Button>
                            <Button variant="danger" size="sm" onClick={handleDeleteConfirm}>Удалить</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FuelCards;

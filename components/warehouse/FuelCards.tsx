import React, { useState, useEffect } from 'react';
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
    type FuelCard,
    type StockLocation,
    type StockItemOption,
    type DriverSearchResult,
} from '../../services/stockApi';
import DataTable from '../shared/DataTable';
import Modal from '../shared/Modal';
import { useToast } from '../../hooks/useToast';

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

// ==================== FUEL CARDS COMPONENT ====================

const FuelCards: React.FC = () => {
    const [cards, setCards] = useState<FuelCard[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCard, setSelectedCard] = useState<FuelCard | null>(null);
    const [topUpModalOpen, setTopUpModalOpen] = useState(false);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
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

    const columns = [
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
                <span className={`px-2 py-1 rounded text-xs ${row.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {row.isActive ? 'Активна' : 'Неактивна'}
                </span>
            )
        },
        {
            key: 'actions',
            label: 'Действия',
            render: (row: FuelCard) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleTopUp(row)}
                        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                        title="Пополнить карту"
                    >
                        💳 Пополнить
                    </button>
                    <button
                        onClick={() => handleAssign(row)}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        title="Привязать к водителю"
                    >
                        👤 Привязать
                    </button>
                    <button
                        onClick={() => setDeleteConfirmCard(row)}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                        title="Удалить карту"
                    >
                        🗑️
                    </button>
                </div>
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

            {selectedCard && (
                <AssignDriverModal
                    card={selectedCard}
                    isOpen={assignModalOpen}
                    onClose={() => {
                        setAssignModalOpen(false);
                        setSelectedCard(null);
                    }}
                    onSuccess={handleAssignSuccess}
                />
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
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteConfirmCard(null)}
                                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FuelCards;

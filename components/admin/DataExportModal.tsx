import React, { useState, useEffect, useMemo } from 'react';
import { XIcon, DownloadIcon, ArrowDownIcon, ArrowUpIcon } from '../Icons';
import { useToast } from '../../hooks/useToast';
import { loadJSON } from '../../services/storage';

// Category configuration - same structure as DataDeletionModal
interface CategoryConfig {
    key: string;
    label: string;
    icon: string;
    tables: { key: string; label: string; dbKey?: string }[];
}

const CATEGORIES: CategoryConfig[] = [
    {
        key: 'documents',
        label: 'Документы',
        icon: '📄',
        tables: [
            { key: 'waybills', label: 'Путевые листы' },
            { key: 'waybillBlanks', label: 'Бланки' },
            { key: 'waybillBlankBatches', label: 'Партии бланков' }
        ]
    },
    {
        key: 'dictionaries',
        label: 'Справочники',
        icon: '📚',
        tables: [
            { key: 'organizations', label: 'Организации' },
            { key: 'employees', label: 'Сотрудники' },
            { key: 'vehicles', label: 'Транспортные средства' },
            { key: 'savedRoutes', label: 'Маршруты' },
            { key: 'fuelTypes', label: 'Типы топлива' },
            { key: 'fuelCards', label: 'Топливные карты' }
        ]
    },
    {
        key: 'stock',
        label: 'Склад',
        icon: '📦',
        tables: [
            { key: 'garageStockItems', label: 'Номенклатура' },
            { key: 'stockTransactions', label: 'Операции склада' }
        ]
    },
    {
        key: 'settings',
        label: 'Настройки',
        icon: '⚙️',
        tables: [
            { key: 'seasonSettings', label: 'Сезонные настройки' },
            { key: 'printPositions_v4_layout', label: 'Позиции печати' },
            { key: 'appSettings', label: 'Общие настройки' }
        ]
    }
];

interface ExportItem {
    id: string;
    label: string;
    subLabel?: string;
    data: any;
}

interface TableExportData {
    key: string;
    items: ExportItem[];
    totalCount: number;
}

interface DataExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (selectedData: Record<string, any[]>) => void;
}

type SelectionState = Record<string, Record<string, Set<string>>>;

// Helper to extract entity ID field
function getEntityIdField(items: any[]): string {
    if (!items?.length) return 'id';
    const first = items[0];
    if (first?.id) return 'id';
    if (first?.code) return 'code';
    if (first?.key) return 'key';
    return 'id';
}

// Helper to create label for an item
function makeItemLabel(item: any, tableKey: string): { label: string; subLabel?: string } {
    if (!item) return { label: 'Unknown' };

    switch (tableKey) {
        case 'waybills':
            return {
                label: item.number || item.id,
                subLabel: item.date ? new Date(item.date).toLocaleDateString('ru-RU') : undefined
            };
        case 'employees':
            return {
                label: item.fullName || item.name || item.id,
                subLabel: item.position
            };
        case 'vehicles':
            return {
                label: item.registrationNumber || item.code || item.id,
                subLabel: `${item.brand || ''} ${item.model || ''}`.trim() || undefined
            };
        case 'organizations':
            return {
                label: item.shortName || item.name || item.id,
                subLabel: item.inn
            };
        case 'fuelTypes':
            return {
                label: item.name || item.code,
                subLabel: item.code
            };
        case 'savedRoutes':
            return {
                label: item.name || item.id
            };
        case 'fuelCards':
            return {
                label: item.cardNumber || item.id,
                subLabel: item.provider
            };
        case 'garageStockItems':
            return {
                label: item.name || item.code,
                subLabel: item.unit
            };
        default:
            return {
                label: item.name || item.fullName || item.number || item.code || item.id || JSON.stringify(item).slice(0, 50)
            };
    }
}

const DataExportModal: React.FC<DataExportModalProps> = ({ isOpen, onClose, onExport }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [selection, setSelection] = useState<SelectionState>({});
    const [tableData, setTableData] = useState<Record<string, Record<string, TableExportData>>>({});

    // Load data from storage and initialize state
    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const loadData = async () => {
            const newTableData: Record<string, Record<string, TableExportData>> = {};
            const newSelection: SelectionState = {};

            // Initialize all categories
            for (const category of CATEGORIES) {
                newTableData[category.key] = {};
                newSelection[category.key] = {};

                for (const table of category.tables) {
                    const data = await loadJSON<any[]>(table.key, null);

                    if (!data || !Array.isArray(data) || data.length === 0) {
                        newTableData[category.key][table.key] = {
                            key: table.key,
                            items: [],
                            totalCount: 0
                        };
                        newSelection[category.key][table.key] = new Set();
                        continue;
                    }

                    const items: ExportItem[] = [];
                    const idField = getEntityIdField(data);

                    data.forEach((item, index) => {
                        if (!item || typeof item !== 'object') return;
                        const id = item?.[idField] || `item-${index}`;
                        const { label, subLabel } = makeItemLabel(item, table.key);
                        items.push({ id: String(id), label, subLabel, data: item });
                    });

                    newTableData[category.key][table.key] = {
                        key: table.key,
                        items,
                        totalCount: items.length
                    };

                    // Select all items by default
                    newSelection[category.key][table.key] = new Set(items.map(i => i.id));
                }
            }

            // Also load any "other" keys not in categories
            // This could be expanded to dynamically discover all storage keys

            setTableData(newTableData);
            setSelection(newSelection);
            setLoading(false);
        };

        loadData().catch(err => {
            console.error('Failed to load export data:', err);
            setLoading(false);
        });
    }, [isOpen]);

    // Get table items
    const getTableItems = (categoryKey: string, tableKey: string): ExportItem[] => {
        return tableData[categoryKey]?.[tableKey]?.items || [];
    };

    // Calculate selected count for a table
    const getTableSelectedCount = (categoryKey: string, tableKey: string): number => {
        return selection[categoryKey]?.[tableKey]?.size || 0;
    };

    // Calculate total count for a table
    const getTableTotalCount = (categoryKey: string, tableKey: string): number => {
        return tableData[categoryKey]?.[tableKey]?.items?.length || 0;
    };

    // Calculate selected count for a category
    const getCategorySelectedCount = (categoryKey: string): number => {
        const catData = tableData[categoryKey];
        if (!catData) return 0;
        return Object.keys(catData).reduce((sum, tableKey) => sum + getTableSelectedCount(categoryKey, tableKey), 0);
    };

    // Calculate total count for a category
    const getCategoryTotalCount = (categoryKey: string): number => {
        const catData = tableData[categoryKey];
        if (!catData) return 0;
        return Object.keys(catData).reduce((sum, tableKey) => sum + getTableTotalCount(categoryKey, tableKey), 0);
    };

    // Total selected count
    const totalSelected = useMemo(() => {
        return CATEGORIES.reduce((sum, cat) => sum + getCategorySelectedCount(cat.key), 0);
    }, [selection, tableData]);

    // Toggle category expansion
    const toggleCategory = (categoryKey: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryKey)) {
                next.delete(categoryKey);
            } else {
                next.add(categoryKey);
            }
            return next;
        });
    };

    // Toggle table expansion
    const toggleTable = (tableKey: string) => {
        setExpandedTables(prev => {
            const next = new Set(prev);
            if (next.has(tableKey)) {
                next.delete(tableKey);
            } else {
                next.add(tableKey);
            }
            return next;
        });
    };

    // Toggle entire category selection
    const toggleCategorySelection = (categoryKey: string) => {
        const catData = tableData[categoryKey];
        if (!catData) return;

        const currentCount = getCategorySelectedCount(categoryKey);
        const totalCount = getCategoryTotalCount(categoryKey);
        const shouldSelect = currentCount < totalCount;

        setSelection(prev => {
            const next = { ...prev };
            next[categoryKey] = { ...next[categoryKey] };
            Object.keys(catData).forEach(tableKey => {
                const items = getTableItems(categoryKey, tableKey);
                if (shouldSelect) {
                    next[categoryKey][tableKey] = new Set(items.map(i => i.id));
                } else {
                    next[categoryKey][tableKey] = new Set();
                }
            });
            return next;
        });
    };

    // Toggle entire table selection
    const toggleTableSelection = (categoryKey: string, tableKey: string) => {
        const items = getTableItems(categoryKey, tableKey);
        const currentCount = getTableSelectedCount(categoryKey, tableKey);
        const shouldSelect = currentCount < items.length;

        setSelection(prev => {
            const next = { ...prev };
            next[categoryKey] = { ...next[categoryKey] };
            if (shouldSelect) {
                next[categoryKey][tableKey] = new Set(items.map(i => i.id));
            } else {
                next[categoryKey][tableKey] = new Set();
            }
            return next;
        });
    };

    // Toggle single item selection
    const toggleItemSelection = (categoryKey: string, tableKey: string, itemId: string) => {
        setSelection(prev => {
            const next = { ...prev };
            next[categoryKey] = { ...next[categoryKey] };
            const set = new Set(next[categoryKey][tableKey]);
            if (set.has(itemId)) {
                set.delete(itemId);
            } else {
                set.add(itemId);
            }
            next[categoryKey][tableKey] = set;
            return next;
        });
    };

    // Perform export
    const handleExport = async () => {
        if (totalSelected === 0) return;

        setExporting(true);
        try {
            // Build selected data map
            const selectedData: Record<string, any[]> = {};

            CATEGORIES.forEach(cat => {
                Object.keys(tableData[cat.key] || {}).forEach(tableKey => {
                    const selectedIds = selection[cat.key]?.[tableKey];
                    if (!selectedIds?.size) return;

                    const items = getTableItems(cat.key, tableKey);
                    const selectedItems = items
                        .filter(item => selectedIds.has(item.id))
                        .map(item => item.data);

                    if (selectedItems.length > 0) {
                        selectedData[tableKey] = selectedItems;
                    }
                });
            });

            await onExport(selectedData);
            showToast(`Экспортировано записей: ${totalSelected}`, 'success');
            onClose();
        } catch (err) {
            console.error('Export failed:', err);
            showToast('Ошибка экспорта данных', 'error');
        } finally {
            setExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <DownloadIcon className="h-5 w-5 text-green-500" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Экспорт данных
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        disabled={exporting}
                    >
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                            <span className="ml-3 text-gray-500">Загрузка данных...</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {CATEGORIES.map(category => {
                                const totalCount = getCategoryTotalCount(category.key);
                                const selectedCount = getCategorySelectedCount(category.key);
                                const isExpanded = expandedCategories.has(category.key);
                                const isFullySelected = selectedCount === totalCount && totalCount > 0;
                                const isPartiallySelected = selectedCount > 0 && selectedCount < totalCount;

                                if (totalCount === 0) return null;

                                return (
                                    <div key={category.key} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                                        {/* Category Header */}
                                        <div
                                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                            onClick={() => toggleCategory(category.key)}
                                        >
                                            {isExpanded ? (
                                                <ArrowDownIcon className="h-4 w-4 text-gray-500" />
                                            ) : (
                                                <ArrowUpIcon className="h-4 w-4 text-gray-500" />
                                            )}
                                            <input
                                                type="checkbox"
                                                checked={isFullySelected}
                                                ref={el => {
                                                    if (el) el.indeterminate = isPartiallySelected;
                                                }}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    toggleCategorySelection(category.key);
                                                }}
                                                onClick={e => e.stopPropagation()}
                                                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                            />
                                            <span className="text-lg">{category.icon}</span>
                                            <span className="font-medium text-gray-900 dark:text-white flex-1">
                                                {category.label}
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                {selectedCount} / {totalCount}
                                            </span>
                                        </div>

                                        {/* Category Tables */}
                                        {isExpanded && tableData[category.key] && (
                                            <div className="border-t dark:border-gray-700">
                                                {Object.entries(tableData[category.key]).map(([tableKey, tableInfo]) => {
                                                    const items = tableInfo.items;
                                                    const tableCount = items.length;
                                                    const tableSelectedCount = getTableSelectedCount(category.key, tableKey);
                                                    const isTableExpanded = expandedTables.has(tableKey);
                                                    const isTableFullySelected = tableSelectedCount === tableCount && tableCount > 0;
                                                    const isTablePartiallySelected = tableSelectedCount > 0 && tableSelectedCount < tableCount;
                                                    const tableLabel = category.tables.find(t => t.key === tableKey)?.label || tableKey;

                                                    if (tableCount === 0) return null;

                                                    return (
                                                        <div key={tableKey} className="border-t dark:border-gray-600 first:border-t-0">
                                                            {/* Table Header */}
                                                            <div
                                                                className="flex items-center gap-3 p-3 pl-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                                                onClick={() => toggleTable(tableKey)}
                                                            >
                                                                {isTableExpanded ? (
                                                                    <ArrowDownIcon className="h-4 w-4 text-gray-400" />
                                                                ) : (
                                                                    <ArrowUpIcon className="h-4 w-4 text-gray-400" />
                                                                )}
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isTableFullySelected}
                                                                    ref={el => {
                                                                        if (el) el.indeterminate = isTablePartiallySelected;
                                                                    }}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleTableSelection(category.key, tableKey);
                                                                    }}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                                />
                                                                <span className="text-gray-700 dark:text-gray-200 flex-1">
                                                                    {tableLabel}
                                                                </span>
                                                                <span className="text-sm text-gray-500">
                                                                    {tableSelectedCount} / {tableCount}
                                                                </span>
                                                            </div>

                                                            {/* Table Items */}
                                                            {isTableExpanded && items.length > 0 && (
                                                                <div className="bg-gray-50 dark:bg-gray-800/50 max-h-48 overflow-auto">
                                                                    {items.map(item => {
                                                                        const isSelected = selection[category.key]?.[tableKey]?.has(item.id) || false;
                                                                        return (
                                                                            <label
                                                                                key={item.id}
                                                                                className="flex items-center gap-3 p-2 pl-16 hover:bg-gray-100 dark:hover:bg-gray-700/30 cursor-pointer"
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    onChange={() => toggleItemSelection(category.key, tableKey, item.id)}
                                                                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                                                />
                                                                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                                                                    {item.label}
                                                                                </span>
                                                                                {item.subLabel && (
                                                                                    <span className="text-xs text-gray-400">
                                                                                        {item.subLabel}
                                                                                    </span>
                                                                                )}
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/30">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                        Выбрано: <span className="font-semibold text-green-600">{totalSelected}</span> записей
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            disabled={exporting}
                            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting || totalSelected === 0}
                            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {exporting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Экспорт...
                                </>
                            ) : (
                                <>
                                    <DownloadIcon className="h-4 w-4" />
                                    Экспортировать выбранное
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataExportModal;

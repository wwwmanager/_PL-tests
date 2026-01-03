import React, { useState, useEffect, useMemo } from 'react';
import { XIcon, DownloadIcon, ArrowDownIcon, ArrowUpIcon } from '../Icons';
import { useToast } from '../../hooks/useToast';
import { getDataPreview, exportData, DataPreviewResponse, TablePreview } from '../../services/adminApi';

interface DataExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface CategoryConfig {
    key: string;
    label: string;
    icon: string;
    tables: { key: string; label: string }[];
}

const CATEGORIES: CategoryConfig[] = [
    {
        key: 'documents',
        label: 'Документы',
        icon: '📄',
        tables: [
            { key: 'waybills', label: 'Путевые листы' },
            { key: 'blanks', label: 'Бланки' },
            { key: 'blankBatches', label: 'Партии бланков' }
        ]
    },
    {
        key: 'dictionaries',
        label: 'Справочники',
        icon: '📚',
        tables: [
            { key: 'organizations', label: 'Организации' },
            { key: 'employees', label: 'Сотрудники' },
            { key: 'drivers', label: 'Водители' },
            { key: 'vehicles', label: 'Транспортные средства' },
            { key: 'routes', label: 'Маршруты' },
            { key: 'fuelTypes', label: 'Типы топлива' },
            { key: 'fuelCards', label: 'Топливные карты' },
            { key: 'warehouses', label: 'Склады' }
        ]
    },
    {
        key: 'stock',
        label: 'Склад',
        icon: '📦',
        tables: [
            { key: 'stockItems', label: 'Номенклатура' },
            { key: 'stockMovements', label: 'Движения' }
        ]
    },
    {
        key: 'settings',
        label: 'Настройки',
        icon: '⚙️',
        tables: [
            { key: 'departments', label: 'Подразделения' },
            { key: 'settings', label: 'Системные настройки' }
        ]
    },
    {
        key: 'logs',
        label: 'Журналы',
        icon: '📋',
        tables: [
            { key: 'auditLogs', label: 'Аудит' }
        ]
    }
];

type SelectionState = Record<string, Record<string, Set<string>>>;

const DataExportModal: React.FC<DataExportModalProps> = ({ isOpen, onClose }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [preview, setPreview] = useState<DataPreviewResponse | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [selection, setSelection] = useState<SelectionState>({});

    // Load data preview
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setError(null);
            getDataPreview()
                .then((data) => {
                    setPreview(data);
                    // Initialize selection with all items selected by default
                    const initialSelection: SelectionState = {};
                    CATEGORIES.forEach(cat => {
                        initialSelection[cat.key] = {};
                        cat.tables.forEach(table => {
                            const tableData = (data as any)[cat.key]?.[table.key] as TablePreview | undefined;
                            if (tableData?.items) {
                                initialSelection[cat.key][table.key] = new Set(tableData.items.map(i => i.id));
                            } else {
                                initialSelection[cat.key][table.key] = new Set();
                            }
                        });
                    });
                    setSelection(initialSelection);
                })
                .catch((err) => {
                    console.error('Failed to load preview:', err);
                    setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
                    showToast('Ошибка загрузки данных. Попробуйте перелогиниться.', 'error');
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, showToast]);

    // Get table data from preview
    const getTableData = (categoryKey: string, tableKey: string): TablePreview | null => {
        if (!preview) return null;
        return (preview as any)[categoryKey]?.[tableKey] || null;
    };

    // Calculate selected count for a table
    const getTableSelectedCount = (categoryKey: string, tableKey: string): number => {
        return selection[categoryKey]?.[tableKey]?.size || 0;
    };

    // Calculate selected count for a category
    const getCategorySelectedCount = (categoryKey: string): number => {
        const category = CATEGORIES.find(c => c.key === categoryKey);
        if (!category) return 0;
        return category.tables.reduce((sum, table) => sum + getTableSelectedCount(categoryKey, table.key), 0);
    };

    // Calculate total count for a category
    const getCategoryTotalCount = (categoryKey: string): number => {
        const category = CATEGORIES.find(c => c.key === categoryKey);
        if (!category) return 0;
        return category.tables.reduce((sum, table) => {
            const data = getTableData(categoryKey, table.key);
            return sum + (data?.count || 0);
        }, 0);
    };

    // Total selected count
    const totalSelected = useMemo(() => {
        return CATEGORIES.reduce((sum, cat) => sum + getCategorySelectedCount(cat.key), 0);
    }, [selection]);

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
        const category = CATEGORIES.find(c => c.key === categoryKey);
        if (!category) return;

        const currentCount = getCategorySelectedCount(categoryKey);
        const totalCount = getCategoryTotalCount(categoryKey);
        const shouldSelect = currentCount < totalCount;

        setSelection(prev => {
            const next = { ...prev };
            next[categoryKey] = { ...next[categoryKey] };
            category.tables.forEach(table => {
                const tableData = getTableData(categoryKey, table.key);
                if (shouldSelect && tableData?.items) {
                    next[categoryKey][table.key] = new Set(tableData.items.map(i => i.id));
                } else {
                    next[categoryKey][table.key] = new Set();
                }
            });
            return next;
        });
    };

    // Toggle entire table selection
    const toggleTableSelection = (categoryKey: string, tableKey: string) => {
        const tableData = getTableData(categoryKey, tableKey);
        if (!tableData) return;

        const currentCount = getTableSelectedCount(categoryKey, tableKey);
        const shouldSelect = currentCount < tableData.count;

        setSelection(prev => {
            const next = { ...prev };
            next[categoryKey] = { ...next[categoryKey] };
            if (shouldSelect && tableData.items) {
                next[categoryKey][tableKey] = new Set(tableData.items.map(i => i.id));
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
            // Build items map for export
            const items: Record<string, string[]> = {};
            const tables: string[] = [];

            CATEGORIES.forEach(cat => {
                cat.tables.forEach(table => {
                    const selectedIds = Array.from(selection[cat.key]?.[table.key] || []);
                    if (selectedIds.length > 0) {
                        const tableData = getTableData(cat.key, table.key);
                        // If all items are selected, we can optimization by passing table name (backend supports it)
                        // But verifying exact count is safer. 
                        // Let's just pass IDs for granular control to be safe.
                        items[table.key] = selectedIds;
                    }
                });
            });

            const data = await exportData({ items });
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
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
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="text-red-500 text-lg font-medium mb-2">Ошибка загрузки</div>
                            <div className="text-gray-500 mb-4">{error}</div>
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
                                        {isExpanded && (
                                            <div className="border-t dark:border-gray-700">
                                                {category.tables.map(table => {
                                                    const tableData = getTableData(category.key, table.key);
                                                    const tableCount = tableData?.count || 0;
                                                    const tableSelectedCount = getTableSelectedCount(category.key, table.key);
                                                    const isTableExpanded = expandedTables.has(table.key);
                                                    const isTableFullySelected = tableSelectedCount === tableCount && tableCount > 0;
                                                    const isTablePartiallySelected = tableSelectedCount > 0 && tableSelectedCount < tableCount;

                                                    if (tableCount === 0) return null;

                                                    return (
                                                        <div key={table.key} className="border-t dark:border-gray-600 first:border-t-0">
                                                            {/* Table Header */}
                                                            <div
                                                                className="flex items-center gap-3 p-3 pl-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                                                onClick={() => toggleTable(table.key)}
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
                                                                        toggleTableSelection(category.key, table.key);
                                                                    }}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                                />
                                                                <span className="text-gray-700 dark:text-gray-200 flex-1">
                                                                    {table.label}
                                                                </span>
                                                                <span className="text-sm text-gray-500">
                                                                    {tableSelectedCount} / {tableCount}
                                                                </span>
                                                            </div>

                                                            {/* Table Items */}
                                                            {isTableExpanded && tableData?.items && (
                                                                <div className="bg-gray-50 dark:bg-gray-800/50 max-h-48 overflow-auto">
                                                                    {tableData.items.map(item => {
                                                                        const isSelected = selection[category.key]?.[table.key]?.has(item.id) || false;
                                                                        return (
                                                                            <label
                                                                                key={item.id}
                                                                                className="flex items-center gap-3 p-2 pl-16 hover:bg-gray-100 dark:hover:bg-gray-700/30 cursor-pointer"
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    onChange={() => toggleItemSelection(category.key, table.key, item.id)}
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

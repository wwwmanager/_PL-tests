import React, { useState, useEffect, useMemo } from 'react';
import { XIcon, UploadIcon, ArrowDownIcon, ArrowUpIcon } from '../Icons';
import { useToast } from '../../hooks/useToast';

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
            { key: 'blanks', label: 'Бланки', dbKey: 'waybillBlanks' },
            { key: 'blankBatches', label: 'Партии бланков', dbKey: 'waybillBlankBatches' }
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
            { key: 'routes', label: 'Маршруты', dbKey: 'savedRoutes' },
            { key: 'fuelTypes', label: 'Типы топлива' },
            { key: 'fuelCards', label: 'Топливные карты' }
        ]
    },
    {
        key: 'stock',
        label: 'Склад',
        icon: '📦',
        tables: [
            { key: 'stockItems', label: 'Номенклатура', dbKey: 'garageStockItems' },
            { key: 'stockTransactions', label: 'Операции склада' }
        ]
    },
    {
        key: 'settings',
        label: 'Настройки',
        icon: '⚙️',
        tables: [
            { key: 'seasonSettings', label: 'Сезонные настройки' },
            { key: 'printPositions_v4_layout', label: 'Позиции печати' }
        ]
    }
];

// Import strategy types
type UpdateMode = 'skip' | 'merge' | 'overwrite';

interface ImportSettings {
    enabled: boolean;
    insertNew: boolean;
    updateMode: UpdateMode;
    deleteMissing: boolean;
}

interface ImportItem {
    id: string;
    label: string;
    subLabel?: string;
    data: any;
}

interface TableImportData {
    key: string;
    items: ImportItem[];
    existingCount: number;
    incomingCount: number;
    newCount: number;
    updateCount: number;
    settings: ImportSettings;
}

interface DataImportModalProps {
    isOpen: boolean;
    bundle: {
        meta: {
            formatVersion: number;
            createdAt: string;
            appVersion?: string;
        };
        data: Record<string, unknown>;
    } | null;
    onClose: () => void;
    onImport: (selectedData: Record<string, any[]>, settings: Record<string, ImportSettings>) => Promise<void>;
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
        case 'routes':
        case 'savedRoutes':
            return {
                label: item.name || item.id
            };
        case 'fuelCards':
            return {
                label: item.cardNumber || item.id,
                subLabel: item.provider
            };
        case 'stockItems':
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

const DataImportModal: React.FC<DataImportModalProps> = ({ isOpen, bundle, onClose, onImport }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [selection, setSelection] = useState<SelectionState>({});
    const [tableData, setTableData] = useState<Record<string, Record<string, TableImportData>>>({});
    const [importSettings, setImportSettings] = useState<Record<string, ImportSettings>>({});

    // Parse bundle data and initialize state
    useEffect(() => {
        if (!isOpen || !bundle) {
            setLoading(false);
            return;
        }

        setLoading(true);
        console.log('[DataImportModal] Bundle data keys:', Object.keys(bundle.data));

        const newTableData: Record<string, Record<string, TableImportData>> = {};
        const newSelection: SelectionState = {};
        const newSettings: Record<string, ImportSettings> = {};

        // Track which bundle keys we've mapped
        const mappedBundleKeys = new Set<string>();

        // Build reverse mapping: bundleKey -> {category, table}
        const keyToTableMap: Record<string, { categoryKey: string; tableKey: string; label: string }> = {};
        CATEGORIES.forEach(category => {
            category.tables.forEach(table => {
                const bundleKey = table.dbKey || table.key;
                keyToTableMap[bundleKey] = { categoryKey: category.key, tableKey: table.key, label: table.label };
                // Also map by table.key if different from bundleKey
                if (table.key !== bundleKey) {
                    keyToTableMap[table.key] = { categoryKey: category.key, tableKey: table.key, label: table.label };
                }
            });
        });

        // Initialize all predefined categories
        CATEGORIES.forEach(category => {
            newTableData[category.key] = {};
            newSelection[category.key] = {};
            category.tables.forEach(table => {
                newTableData[category.key][table.key] = {
                    key: table.key,
                    items: [],
                    existingCount: 0,
                    incomingCount: 0,
                    newCount: 0,
                    updateCount: 0,
                    settings: { enabled: false, insertNew: true, updateMode: 'merge', deleteMissing: false }
                };
                newSelection[category.key][table.key] = new Set();
            });
        });

        // Add 'other' category for unmapped keys
        newTableData['other'] = {};
        newSelection['other'] = {};

        // Process each key in bundle.data
        Object.entries(bundle.data).forEach(([bundleKey, rawData]) => {
            if (!rawData) return;

            console.log('[DataImportModal] Processing key:', bundleKey, 'type:', typeof rawData, 'isArray:', Array.isArray(rawData));

            const mapping = keyToTableMap[bundleKey];
            const categoryKey = mapping?.categoryKey || 'other';
            const tableKey = mapping?.tableKey || bundleKey;
            const tableLabel = mapping?.label || bundleKey;

            mappedBundleKeys.add(bundleKey);

            const items: ImportItem[] = [];
            const arr = Array.isArray(rawData) ? rawData : (rawData && typeof rawData === 'object' ? [rawData] : []);

            if (arr.length === 0) {
                console.log('[DataImportModal] Skipping empty/non-array key:', bundleKey);
                return;
            }

            const idField = getEntityIdField(arr);

            arr.forEach((item, index) => {
                if (!item || typeof item !== 'object') return;
                const id = item?.[idField] || `item-${index}`;
                const { label, subLabel } = makeItemLabel(item, tableKey);
                items.push({ id: String(id), label, subLabel, data: item });
            });

            if (items.length === 0) return;

            console.log('[DataImportModal] Found', items.length, 'items for', bundleKey, '-> category:', categoryKey, 'table:', tableKey);

            // For 'other' category, dynamically add the table
            if (categoryKey === 'other') {
                newTableData['other'][tableKey] = {
                    key: tableKey,
                    items,
                    existingCount: 0,
                    incomingCount: items.length,
                    newCount: items.length,
                    updateCount: 0,
                    settings: { enabled: true, insertNew: true, updateMode: 'merge', deleteMissing: false }
                };
                newSelection['other'][tableKey] = new Set(items.map(i => i.id));
            } else {
                // Update predefined category table
                newTableData[categoryKey][tableKey] = {
                    key: tableKey,
                    items,
                    existingCount: 0,
                    incomingCount: items.length,
                    newCount: items.length,
                    updateCount: 0,
                    settings: { enabled: true, insertNew: true, updateMode: 'merge', deleteMissing: false }
                };
                newSelection[categoryKey][tableKey] = new Set(items.map(i => i.id));
            }

            newSettings[tableKey] = { enabled: true, insertNew: true, updateMode: 'merge', deleteMissing: false };
        });

        console.log('[DataImportModal] Final tableData:', newTableData);
        console.log('[DataImportModal] Final selection:', newSelection);

        setTableData(newTableData);
        setSelection(newSelection);
        setImportSettings(newSettings);
        setLoading(false);
    }, [isOpen, bundle]);

    // Get table items
    const getTableItems = (categoryKey: string, tableKey: string): ImportItem[] => {
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

    // Calculate selected count for a category (handles both predefined and 'other')
    const getCategorySelectedCount = (categoryKey: string): number => {
        const catData = tableData[categoryKey];
        if (!catData) return 0;
        return Object.keys(catData).reduce((sum, tableKey) => sum + getTableSelectedCount(categoryKey, tableKey), 0);
    };

    // Calculate total count for a category (handles both predefined and 'other')
    const getCategoryTotalCount = (categoryKey: string): number => {
        const catData = tableData[categoryKey];
        if (!catData) return 0;
        return Object.keys(catData).reduce((sum, tableKey) => sum + getTableTotalCount(categoryKey, tableKey), 0);
    };

    // Total selected count (includes all categories including 'other')
    const totalSelected = useMemo(() => {
        return Object.keys(tableData).reduce((sum, catKey) => sum + getCategorySelectedCount(catKey), 0);
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

    // Toggle entire category selection (handles both predefined and 'other')
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

    // Update import settings for a table
    const updateTableSettings = (tableKey: string, updates: Partial<ImportSettings>) => {
        setImportSettings(prev => ({
            ...prev,
            [tableKey]: { ...prev[tableKey], ...updates }
        }));
    };

    // Perform import
    const handleImport = async () => {
        if (totalSelected === 0) return;

        setImporting(true);
        try {
            // Build selected data map
            const selectedData: Record<string, any[]> = {};

            CATEGORIES.forEach(cat => {
                cat.tables.forEach(table => {
                    const selectedIds = selection[cat.key]?.[table.key];
                    if (!selectedIds?.size) return;

                    const items = getTableItems(cat.key, table.key);
                    const selectedItems = items
                        .filter(item => selectedIds.has(item.id))
                        .map(item => item.data);

                    if (selectedItems.length > 0) {
                        const bundleKey = table.dbKey || table.key;
                        selectedData[bundleKey] = selectedItems;
                    }
                });
            });

            await onImport(selectedData, importSettings);
            showToast(`Импортировано записей: ${totalSelected}`, 'success');
            onClose();
        } catch (err) {
            console.error('Import failed:', err);
            showToast('Ошибка импорта данных', 'error');
        } finally {
            setImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <UploadIcon className="h-5 w-5 text-blue-500" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Импорт данных
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        disabled={importing}
                    >
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* File Info */}
                {bundle && (
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                        <span>Формат: v{bundle.meta.formatVersion}</span>
                        <span className="mx-2">•</span>
                        <span>Создан: {new Date(bundle.meta.createdAt).toLocaleString('ru-RU')}</span>
                        {bundle.meta.appVersion && (
                            <>
                                <span className="mx-2">•</span>
                                <span>Версия: {bundle.meta.appVersion}</span>
                            </>
                        )}
                        <span className="mx-2">•</span>
                        <span>Ключей: {Object.keys(bundle.data).length}</span>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            <span className="ml-3 text-gray-500">Анализ данных...</span>
                        </div>
                    ) : !bundle ? (
                        <div className="text-center py-12 text-gray-500">
                            Файл не загружен
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Render predefined categories */}
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
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-lg">{category.icon}</span>
                                            <span className="font-medium text-gray-900 dark:text-white flex-1">
                                                {category.label}
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                {selectedCount} / {totalCount}
                                            </span>
                                        </div>

                                        {/* Category Tables - use tableData keys */}
                                        {isExpanded && tableData[category.key] && (
                                            <div className="border-t dark:border-gray-700">
                                                {Object.entries(tableData[category.key]).map(([tableKey, tableInfo]) => {
                                                    const items = tableInfo.items;
                                                    const tableCount = items.length;
                                                    const tableSelectedCount = getTableSelectedCount(category.key, tableKey);
                                                    const isTableExpanded = expandedTables.has(tableKey);
                                                    const isTableFullySelected = tableSelectedCount === tableCount && tableCount > 0;
                                                    const isTablePartiallySelected = tableSelectedCount > 0 && tableSelectedCount < tableCount;
                                                    const settings = importSettings[tableKey] || { enabled: true, insertNew: true, updateMode: 'merge' as const, deleteMissing: false };
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
                                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-gray-700 dark:text-gray-200 flex-1">
                                                                    {tableLabel}
                                                                </span>
                                                                <span className="text-sm text-gray-500 mr-4">
                                                                    {tableSelectedCount} / {tableCount}
                                                                </span>
                                                                {/* Import strategy */}
                                                                <select
                                                                    className="text-xs border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
                                                                    value={settings.updateMode}
                                                                    onChange={e => {
                                                                        e.stopPropagation();
                                                                        updateTableSettings(tableKey, { updateMode: e.target.value as UpdateMode });
                                                                    }}
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <option value="merge">Слияние</option>
                                                                    <option value="overwrite">Перезапись</option>
                                                                    <option value="skip">Пропуск</option>
                                                                </select>
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
                                                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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

                            {/* Render 'other' category for unmapped keys */}
                            {(() => {
                                const otherData = tableData['other'];
                                if (!otherData || Object.keys(otherData).length === 0) return null;

                                const totalCount = getCategoryTotalCount('other');
                                const selectedCount = getCategorySelectedCount('other');
                                if (totalCount === 0) return null;

                                const isExpanded = expandedCategories.has('other');
                                const isFullySelected = selectedCount === totalCount && totalCount > 0;
                                const isPartiallySelected = selectedCount > 0 && selectedCount < totalCount;

                                return (
                                    <div key="other" className="border dark:border-gray-700 rounded-lg overflow-hidden">
                                        {/* Other Category Header */}
                                        <div
                                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                            onClick={() => toggleCategory('other')}
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
                                                    toggleCategorySelection('other');
                                                }}
                                                onClick={e => e.stopPropagation()}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-lg">📁</span>
                                            <span className="font-medium text-gray-900 dark:text-white flex-1">
                                                Прочее
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                {selectedCount} / {totalCount}
                                            </span>
                                        </div>

                                        {/* Other Tables */}
                                        {isExpanded && (
                                            <div className="border-t dark:border-gray-700">
                                                {Object.entries(otherData).map(([tableKey, tableInfo]) => {
                                                    const items = tableInfo.items;
                                                    const tableCount = items.length;
                                                    const tableSelectedCount = getTableSelectedCount('other', tableKey);
                                                    const isTableExpanded = expandedTables.has(tableKey);
                                                    const isTableFullySelected = tableSelectedCount === tableCount && tableCount > 0;
                                                    const isTablePartiallySelected = tableSelectedCount > 0 && tableSelectedCount < tableCount;
                                                    const settings = importSettings[tableKey] || { enabled: true, insertNew: true, updateMode: 'merge' as const, deleteMissing: false };

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
                                                                        toggleTableSelection('other', tableKey);
                                                                    }}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-gray-700 dark:text-gray-200 flex-1">
                                                                    {tableKey}
                                                                </span>
                                                                <span className="text-sm text-gray-500 mr-4">
                                                                    {tableSelectedCount} / {tableCount}
                                                                </span>
                                                                {/* Import strategy */}
                                                                <select
                                                                    className="text-xs border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
                                                                    value={settings.updateMode}
                                                                    onChange={e => {
                                                                        e.stopPropagation();
                                                                        updateTableSettings(tableKey, { updateMode: e.target.value as UpdateMode });
                                                                    }}
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <option value="merge">Слияние</option>
                                                                    <option value="overwrite">Перезапись</option>
                                                                    <option value="skip">Пропуск</option>
                                                                </select>
                                                            </div>

                                                            {/* Table Items */}
                                                            {isTableExpanded && items.length > 0 && (
                                                                <div className="bg-gray-50 dark:bg-gray-800/50 max-h-48 overflow-auto">
                                                                    {items.map(item => {
                                                                        const isSelected = selection['other']?.[tableKey]?.has(item.id) || false;
                                                                        return (
                                                                            <label
                                                                                key={item.id}
                                                                                className="flex items-center gap-3 p-2 pl-16 hover:bg-gray-100 dark:hover:bg-gray-700/30 cursor-pointer"
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    onChange={() => toggleItemSelection('other', tableKey, item.id)}
                                                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                            })()}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/30">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                        Выбрано: <span className="font-semibold text-blue-600">{totalSelected}</span> записей
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            disabled={importing}
                            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={importing || totalSelected === 0}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {importing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Импорт...
                                </>
                            ) : (
                                <>
                                    <UploadIcon className="h-4 w-4" />
                                    Импортировать выбранное
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataImportModal;

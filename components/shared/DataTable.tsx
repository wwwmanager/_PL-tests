/**
 * Simple DataTable component for displaying tabular data
 * Provides basic sorting, persistent column reordering and empty state support
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    DndContext,
    closestCenter,
    DragOverlay,
} from '@dnd-kit/core';
import {
    SortableContext,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useColumnPersistence } from '../../hooks/useColumnPersistence';
import { SortableHeader } from './SortableHeader';
import useTable from '../../hooks/useTable';
import { EmptyState, getEmptyStateFromError } from '../common/EmptyState';

export interface Column<T = any> {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (row: T) => React.ReactNode;
}

export interface TableAction<T> {
    icon: React.ReactNode;
    onClick: (row: T) => void;
    title?: string;
    className?: string;
    show?: (row: T) => boolean;
}

export interface DataTableProps<T = any> {
    columns: Column<T>[];
    data: T[];
    keyField: string;
    emptyMessage?: string;
    searchable?: boolean;
    tableId?: string;
    isLoading?: boolean;
    error?: any;
    onRetry?: () => void;
    actions?: TableAction<T>[];
}

function DataTable<T extends Record<string, any>>({
    columns: initialColumns,
    data,
    keyField,
    emptyMessage = 'Нет данных',
    searchable = false,
    tableId = 'default-table',
    isLoading = false,
    error = null,
    onRetry,
    actions = [],
}: DataTableProps<T>) {
    const { columns, sensors, onDragEnd } = useColumnPersistence(initialColumns, tableId);
    const [activeId, setActiveId] = useState<string | null>(null);

    const {
        rows,
        sortColumn,
        sortDirection,
        handleSort,
        filters,
        handleFilterChange,
    } = useTable(data, initialColumns);

    const activeColumn = columns.find(c => c.key === activeId);

    if (isLoading || error || data.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <EmptyState
                    reason={error ? getEmptyStateFromError(error) : (isLoading ? { type: 'loading' } : { type: 'empty', entityName: emptyMessage })}
                    onRetry={onRetry}
                />
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => { setActiveId(null); onDragEnd(e); }}
            onDragStart={(e) => setActiveId(String(e.active.id))}
        >
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <SortableContext items={columns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
                                {columns.map((col) => (
                                    <SortableHeader
                                        key={col.key}
                                        id={col.key}
                                        asTh
                                        className={`px-6 py-4 text-left font-bold tracking-tight ${col.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors' : ''}`}
                                        onClick={() => col.sortable && handleSort(col.key)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            {col.sortable && sortColumn === col.key && (
                                                <span className="text-blue-500 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </SortableHeader>
                                ))}
                            </SortableContext>
                            {actions.length > 0 && (
                                <th className="px-6 py-4 text-center font-bold tracking-tight">Действия</th>
                            )}
                        </tr>
                        {searchable && (
                            <tr>
                                {columns.map((col) => (
                                    <th key={`${col.key}-filter`} className="px-6 py-2 bg-gray-50 dark:bg-gray-700">
                                        <input
                                            type="text"
                                            placeholder={`Поиск...`}
                                            value={filters[col.key] || ''}
                                            onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                            className="w-full text-xs px-3 py-1.5 border rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal"
                                        />
                                    </th>
                                ))}
                                {actions.length > 0 && <th className="px-6 py-2 bg-gray-50 dark:bg-gray-700"></th>}
                            </tr>
                        )}
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    Ничего не найдено
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row[keyField]} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    {columns.map((col) => (
                                        <td key={col.key} className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                            {col.render ? col.render(row) : row[col.key]}
                                        </td>
                                    ))}
                                    {actions.length > 0 && (
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                {actions.filter(a => !a.show || a.show(row)).map((action, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => action.onClick(row)}
                                                        className={`p-1.5 rounded-md transition-colors ${action.className || 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                        title={action.title}
                                                    >
                                                        {action.icon}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {typeof document !== 'undefined' && createPortal(
                <DragOverlay>
                    {activeColumn ? (
                        <div className="bg-white dark:bg-gray-800 shadow-xl p-4 rounded-lg border-2 border-blue-500 dark:border-blue-400 font-bold opacity-90 cursor-grabbing text-xs uppercase text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            {activeColumn.label}
                        </div>
                    ) : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    );
}

export default DataTable;

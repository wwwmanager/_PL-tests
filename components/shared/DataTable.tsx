/**
 * Simple DataTable component for displaying tabular data
 * Provides basic sorting and empty state support
 */
import React, { useState, useMemo } from 'react';

export interface Column<T = any> {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (row: T) => React.ReactNode;
}

import useTable from '../../hooks/useTable';

export interface Column<T = any> {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T = any> {
    columns: Column<T>[];
    data: T[];
    keyField: string;
    emptyMessage?: string;
    searchable?: boolean;
}

function DataTable<T extends Record<string, any>>({
    columns,
    data,
    keyField,
    emptyMessage = 'Нет данных',
    searchable = false,
}: DataTableProps<T>) {
    const {
        rows,
        sortColumn,
        sortDirection,
        handleSort,
        filters,
        handleFilterChange,
    } = useTable(data, columns);

    if (data.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`px-6 py-4 text-left font-bold tracking-tight ${col.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors' : ''}`}
                                onClick={() => handleSort(col.key)}
                            >
                                <div className="flex items-center gap-1">
                                    {col.label}
                                    {col.sortable && sortColumn === col.key && (
                                        <span className="text-blue-500 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </th>
                        ))}
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
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default DataTable;

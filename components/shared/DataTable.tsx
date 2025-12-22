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

export interface DataTableProps<T = any> {
    columns: Column<T>[];
    data: T[];
    keyField: string;
    emptyMessage?: string;
}

function DataTable<T extends Record<string, any>>({
    columns,
    data,
    keyField,
    emptyMessage = 'Нет данных',
}: DataTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState(true);

    const handleSort = (key: string, sortable?: boolean) => {
        if (!sortable) return;
        if (sortKey === key) {
            setSortAsc(!sortAsc);
        } else {
            setSortKey(key);
            setSortAsc(true);
        }
    };

    const sortedData = useMemo(() => {
        if (!sortKey) return data;
        return [...data].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            if (aVal == null) return sortAsc ? 1 : -1;
            if (bVal == null) return sortAsc ? -1 : 1;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortAsc ? aVal - bVal : bVal - aVal;
            }
            return sortAsc
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }, [data, sortKey, sortAsc]);

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
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}`}
                                onClick={() => handleSort(col.key, col.sortable)}
                            >
                                <span className="flex items-center gap-1">
                                    {col.label}
                                    {col.sortable && sortKey === col.key && (
                                        <span>{sortAsc ? '▲' : '▼'}</span>
                                    )}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedData.map((row) => (
                        <tr key={row[keyField]} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            {columns.map((col) => (
                                <td key={col.key} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                    {col.render ? col.render(row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default DataTable;

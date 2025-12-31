import React, { useState, useCallback, useMemo } from 'react';
import type { Route, Vehicle } from '../../types';
import { TrashIcon } from '../Icons';
import { AutocompleteInput } from '../shared/AutocompleteInput';
import { searchSavedLocations } from '../../services/routeApi';

// Re-defining FormField locally to avoid circular dependencies or complex imports if it's not exported
const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
        {children}
    </div>
);

interface RouteRowProps {
    route: Route;
    dayMode: 'single' | 'multi';
    selectedVehicle?: Vehicle | undefined;
    onChange: (id: string, field: keyof Route, value: any) => void;
    onRemove: (id: string) => void;
    onDateBlur?: (id: string, value: string) => void;  // WB-ROUTE-DATE: Validate on blur
}

/**
 * Debounce helper
 */
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

const RouteRowComponent: React.FC<RouteRowProps> = ({
    route,
    dayMode,
    selectedVehicle,
    onChange,
    onRemove,
    onDateBlur,
}) => {
    const [fromSuggestions, setFromSuggestions] = useState<string[]>([]);
    const [toSuggestions, setToSuggestions] = useState<string[]>([]);

    // Debounced search for "from" field
    const debouncedSearchFrom = useMemo(
        () => debounce(async (query: string) => {
            if (query.trim().length < 2) {
                setFromSuggestions([]);
                return;
            }
            try {
                const results = await searchSavedLocations(query);
                setFromSuggestions(results);
            } catch (error) {
                console.error('Search failed:', error);
                setFromSuggestions([]);
            }
        }, 300),
        []
    );

    // Debounced search for "to" field
    const debouncedSearchTo = useMemo(
        () => debounce(async (query: string) => {
            if (query.trim().length < 2) {
                setToSuggestions([]);
                return;
            }
            try {
                const results = await searchSavedLocations(query);
                setToSuggestions(results);
            } catch (error) {
                console.error('Search failed:', error);
                setToSuggestions([]);
            }
        }, 300),
        []
    );

    const handleFromChange = useCallback((value: string) => {
        onChange(route.id, 'from', value);
    }, [route.id, onChange]);

    const handleToChange = useCallback((value: string) => {
        onChange(route.id, 'to', value);
    }, [route.id, onChange]);

    return (
        <div
            className={`grid grid-cols-1 ${dayMode === 'multi'
                ? 'md:grid-cols-[auto,1fr,1fr,100px,auto,auto]'
                : 'md:grid-cols-[1fr,1fr,100px,auto,auto]'
                } gap-2 items-end`}
        >
            {dayMode === 'multi' && (
                <FormField label="Дата">
                    <input
                        type="date"
                        name="date"
                        value={route.date || ''}
                        onChange={(e) => onChange(route.id, 'date', e.target.value)}
                        onBlur={(e) => onDateBlur?.(route.id, e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
                    />
                </FormField>
            )}
            <FormField label="Откуда">
                <AutocompleteInput
                    value={route.from}
                    onChange={handleFromChange}
                    suggestions={fromSuggestions}
                    onSearch={debouncedSearchFrom}
                    placeholder="Начните вводить..."
                />
            </FormField>
            <FormField label="Куда">
                <AutocompleteInput
                    value={route.to}
                    onChange={handleToChange}
                    suggestions={toSuggestions}
                    onSearch={debouncedSearchTo}
                    placeholder="Начните вводить..."
                />
            </FormField>
            <FormField label="Пробег, км">
                <input
                    type="number"
                    step="0.1"
                    name="distanceKm"
                    value={route.distanceKm}
                    onChange={(e) =>
                        onChange(route.id, 'distanceKm', Number(e.target.value))
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
                />
            </FormField>
            <div className="flex items-center gap-4 pb-2">
                {selectedVehicle?.useCityModifier && (
                    <label className="flex items-center gap-1 text-sm">
                        <input
                            type="checkbox"
                            checked={route.isCityDriving}
                            onChange={(e) =>
                                onChange(route.id, 'isCityDriving', e.target.checked)
                            }
                        />{' '}
                        Город
                    </label>
                )}
                {selectedVehicle?.useWarmingModifier && (
                    <label className="flex items-center gap-1 text-sm">
                        <input
                            type="checkbox"
                            checked={route.isWarming}
                            onChange={(e) =>
                                onChange(route.id, 'isWarming', e.target.checked)
                            }
                        />{' '}
                        Прогрев
                    </label>
                )}
            </div>
            <button
                onClick={() => onRemove(route.id)}
                className="text-red-500 hover:text-red-700 pb-2"
            >
                <TrashIcon className="h-5 w-5" />
            </button>
        </div>
    );
};

export const RouteRow = React.memo(RouteRowComponent);

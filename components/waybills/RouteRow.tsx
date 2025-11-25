import React from 'react';
import type { Route, Vehicle } from '../../types';
import { TrashIcon } from '../Icons';

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
}

const RouteRowComponent: React.FC<RouteRowProps> = ({
    route,
    dayMode,
    selectedVehicle,
    onChange,
    onRemove,
}) => {
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
                        className="w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
                    />
                </FormField>
            )}
            <FormField label="Откуда">
                <input
                    list="locations"
                    name="from"
                    value={route.from}
                    onChange={(e) => onChange(route.id, 'from', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
                />
            </FormField>
            <FormField label="Куда">
                <input
                    list="locations"
                    name="to"
                    value={route.to}
                    onChange={(e) => onChange(route.id, 'to', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
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

/**
 * ThemeToggle — UI-DESIGN-003
 * Theme toggle button for switching between light/dark mode
 */
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SunIcon, MoonIcon } from '../Icons';

interface ThemeToggleProps {
    /** Show label */
    showLabel?: boolean;
    /** Additional className */
    className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
    showLabel = false,
    className = '',
}) => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`
        inline-flex items-center gap-2 p-2 rounded-lg
        text-gray-500 dark:text-gray-400
        hover:bg-gray-100 dark:hover:bg-gray-700
        focus:outline-none focus:ring-2 focus:ring-blue-500
        transition-colors
        ${className}
      `}
            title={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
            aria-label={isDark ? 'Светлая тема' : 'Тёмная тема'}
        >
            {isDark ? (
                <SunIcon className="h-5 w-5" />
            ) : (
                <MoonIcon className="h-5 w-5" />
            )}
            {showLabel && (
                <span className="text-sm font-medium">
                    {isDark ? 'Светлая' : 'Тёмная'}
                </span>
            )}
        </button>
    );
};

export default ThemeToggle;

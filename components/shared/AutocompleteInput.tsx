import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    onSearch: (query: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    readOnly?: boolean;
}

/**
 * Autocomplete Input Component
 * Provides intelligent suggestions as user types
 * - Shows dropdown with suggestions
 * - Keyboard navigation (↑↓ Enter Esc)
 * - Click to select
 * - Minimum 2 characters to trigger
 */
export const AutocompleteInput = React.memo<AutocompleteInputProps>(
    ({ value, onChange, suggestions, onSearch, placeholder, className = '', disabled, readOnly }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [selectedIndex, setSelectedIndex] = useState(-1);
        const inputRef = useRef<HTMLInputElement>(null);
        const dropdownRef = useRef<HTMLDivElement>(null);

        // Close dropdown when clicking outside
        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (
                    dropdownRef.current &&
                    !dropdownRef.current.contains(event.target as Node) &&
                    inputRef.current &&
                    !inputRef.current.contains(event.target as Node)
                ) {
                    setIsOpen(false);
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        // Reset selected index when suggestions change
        useEffect(() => {
            setSelectedIndex(-1);
        }, [suggestions]);

        const handleInputChange = useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                const newValue = e.target.value;
                onChange(newValue);

                // Trigger search only if >= 2 characters
                if (newValue.trim().length >= 2) {
                    onSearch(newValue);
                    setIsOpen(true);
                } else {
                    setIsOpen(false);
                }
            },
            [onChange, onSearch]
        );

        const selectSuggestion = useCallback(
            (suggestion: string) => {
                onChange(suggestion);
                setIsOpen(false);
                setSelectedIndex(-1);
                inputRef.current?.focus();
            },
            [onChange]
        );

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (!isOpen || suggestions.length === 0) {
                    if (e.key === 'ArrowDown' && value.trim().length >= 2) {
                        // Re-open dropdown if closed
                        setIsOpen(true);
                    }
                    return;
                }

                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
                        break;

                    case 'ArrowUp':
                        e.preventDefault();
                        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                        break;

                    case 'Enter':
                        e.preventDefault();
                        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                            selectSuggestion(suggestions[selectedIndex]);
                        } else if (suggestions.length === 1) {
                            // Auto-select if only one suggestion
                            selectSuggestion(suggestions[0]);
                        }
                        break;

                    case 'Escape':
                        e.preventDefault();
                        setIsOpen(false);
                        setSelectedIndex(-1);
                        break;

                    case 'Tab':
                        // Allow tab to work normally, but close dropdown
                        setIsOpen(false);
                        break;
                }
            },
            [isOpen, suggestions, selectedIndex, selectSuggestion, value]
        );

        const handleFocus = useCallback(() => {
            if (value.trim().length >= 2 && suggestions.length > 0) {
                setIsOpen(true);
            }
        }, [value, suggestions.length]);

        // Get suggestion highlight text
        const highlightMatch = useCallback((text: string, query: string) => {
            if (!query) return text;

            const normalizedQuery = query.toLowerCase();
            const normalizedText = text.toLowerCase();
            const index = normalizedText.indexOf(normalizedQuery);

            if (index === -1) return text;

            const before = text.slice(0, index);
            const match = text.slice(index, index + query.length);
            const after = text.slice(index + query.length);

            return (
                <>
                    {before}
                    <span className="font-bold text-blue-600 dark:text-blue-400">{match}</span>
                    {after}
                </>
            );
        }, []);

        return (
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    placeholder={placeholder}
                    disabled={disabled}
                    readOnly={readOnly}
                    className={`w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 read-only:bg-gray-200 dark:read-only:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
                    autoComplete="off"
                />

                {isOpen && suggestions.length > 0 && !disabled && !readOnly && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto"
                    >
                        <ul className="py-1">
                            {suggestions.map((suggestion, idx) => (
                                <li
                                    key={idx}
                                    className={`px-3 py-2 cursor-pointer text-sm transition-colors ${idx === selectedIndex
                                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                                        }`}
                                    onClick={() => selectSuggestion(suggestion)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                >
                                    {highlightMatch(suggestion, value)}
                                </li>
                            ))}
                        </ul>

                        {/* Helper text */}
                        <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                            ↑↓ навигация • Enter выбрать • Esc закрыть
                        </div>
                    </div>
                )}
            </div>
        );
    }
);

AutocompleteInput.displayName = 'AutocompleteInput';

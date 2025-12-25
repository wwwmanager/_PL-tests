/**
 * UX-DOC-GUARD-004: Navigation Guard Context
 * Prevents data loss when navigating away from unsaved forms.
 */
import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

interface DirtyFormEntry {
    id: string;
    saveCallback?: () => Promise<boolean>;
}

interface NavigationGuardContextType {
    /**
     * Register a form as having unsaved changes
     * @param id Unique identifier for the form
     * @param saveCallback Optional callback to save the form, returns true if successful
     */
    registerDirty: (id: string, saveCallback?: () => Promise<boolean>) => void;

    /**
     * Unregister a form (when saved or unmounted)
     * @param id Unique identifier for the form
     */
    unregisterDirty: (id: string) => void;

    /**
     * Check if any form has unsaved changes
     */
    hasDirty: boolean;

    /**
     * Request navigation - shows confirmation if dirty, otherwise proceeds
     * @param onProceed Callback to execute if user confirms navigation
     */
    requestNavigation: (onProceed: () => void) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | undefined>(undefined);

export const useNavigationGuard = (): NavigationGuardContextType => {
    const context = useContext(NavigationGuardContext);
    if (!context) {
        // Return a no-op implementation if used outside provider (graceful fallback)
        return {
            registerDirty: () => { },
            unregisterDirty: () => { },
            hasDirty: false,
            requestNavigation: (onProceed) => onProceed(),
        };
    }
    return context;
};

interface NavigationGuardProviderProps {
    children: ReactNode;
}

export const NavigationGuardProvider: React.FC<NavigationGuardProviderProps> = ({ children }) => {
    const [dirtyForms, setDirtyForms] = useState<Map<string, DirtyFormEntry>>(new Map());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const pendingNavigationRef = useRef<(() => void) | null>(null);

    const registerDirty = useCallback((id: string, saveCallback?: () => Promise<boolean>) => {
        setDirtyForms(prev => {
            const newMap = new Map(prev);
            newMap.set(id, { id, saveCallback });
            return newMap;
        });
    }, []);

    const unregisterDirty = useCallback((id: string) => {
        setDirtyForms(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
        });
    }, []);

    const hasDirty = dirtyForms.size > 0;

    const requestNavigation = useCallback((onProceed: () => void) => {
        if (dirtyForms.size === 0) {
            onProceed();
            return;
        }

        pendingNavigationRef.current = onProceed;
        setIsModalOpen(true);
    }, [dirtyForms.size]);

    const handleSaveAndClose = async () => {
        setIsSaving(true);

        // Try to save all dirty forms
        let allSaved = true;
        for (const [, entry] of dirtyForms) {
            if (entry.saveCallback) {
                try {
                    const saved = await entry.saveCallback();
                    if (!saved) {
                        allSaved = false;
                        break;
                    }
                } catch (err) {
                    console.error('Failed to save form:', entry.id, err);
                    allSaved = false;
                    break;
                }
            }
        }

        setIsSaving(false);

        if (allSaved) {
            setIsModalOpen(false);
            // Clear all dirty forms since they were saved
            setDirtyForms(new Map());
            if (pendingNavigationRef.current) {
                pendingNavigationRef.current();
                pendingNavigationRef.current = null;
            }
        }
        // If save failed, modal stays open (user can retry or cancel)
    };

    const handleCloseWithoutSaving = () => {
        setIsModalOpen(false);
        // Clear all dirty forms (data will be lost)
        setDirtyForms(new Map());
        if (pendingNavigationRef.current) {
            pendingNavigationRef.current();
            pendingNavigationRef.current = null;
        }
    };

    const handleCancel = () => {
        setIsModalOpen(false);
        pendingNavigationRef.current = null;
    };

    const contextValue: NavigationGuardContextType = {
        registerDirty,
        unregisterDirty,
        hasDirty,
        requestNavigation,
    };

    return (
        <NavigationGuardContext.Provider value={contextValue}>
            {children}

            {/* Unsaved Changes Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
                    onClick={handleCancel}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Несохранённые изменения
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            У вас есть несохранённые изменения. Что вы хотите сделать?
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleSaveAndClose}
                                disabled={isSaving}
                                className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Сохранение...' : 'Сохранить и закрыть'}
                            </button>

                            <button
                                onClick={handleCloseWithoutSaving}
                                disabled={isSaving}
                                className="w-full px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                Закрыть без сохранения
                            </button>

                            <button
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </NavigationGuardContext.Provider>
    );
};

export default NavigationGuardContext;

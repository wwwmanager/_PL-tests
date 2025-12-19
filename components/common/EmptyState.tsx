// REL-204: Empty State Component
// Distinguishes between 403/500/empty data states

import React from 'react';
import { useMe } from '../../contexts/MeContext';

export type EmptyStateReason =
    | { type: 'loading' }
    | { type: 'empty'; entityName?: string }
    | { type: 'forbidden'; message?: string }
    | { type: 'error'; message: string; requestId?: string | null }
    | { type: 'unauthorized' };

interface EmptyStateProps {
    reason: EmptyStateReason;
    entityName?: string; // e.g. "транспорт", "сотрудники"
    onRetry?: () => void;
}

/**
 * Determines EmptyStateReason from HTTP error
 */
export function getEmptyStateFromError(error: any): EmptyStateReason {
    const statusCode = error?.statusCode ?? error?.response?.status ?? error?.status;
    const requestId = error?.requestId ?? error?.response?.data?.requestId ?? null;
    const message = error?.message ?? 'Неизвестная ошибка';
    const code = error?.code ?? null;

    if (statusCode === 401) {
        return { type: 'unauthorized' };
    }
    if (statusCode === 403 || code === 'FORBIDDEN') {
        return { type: 'forbidden', message };
    }
    if (statusCode >= 500) {
        return { type: 'error', message: 'Ошибка сервера', requestId };
    }
    return { type: 'error', message, requestId };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ reason, entityName = 'данные', onRetry }) => {
    const meState = useMe();
    const orgName = meState.status === 'ready' ? meState.me.organization.name : null;

    if (reason.type === 'loading') {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-500">Загрузка...</span>
            </div>
        );
    }

    if (reason.type === 'unauthorized') {
        return (
            <div className="text-center py-12 px-4">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Требуется авторизация
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                    Пожалуйста, войдите в систему для просмотра данных.
                </p>
            </div>
        );
    }

    if (reason.type === 'forbidden') {
        return (
            <div className="text-center py-12 px-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-4xl mb-4">🚫</div>
                <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
                    Нет прав доступа
                </h3>
                <p className="text-red-600 dark:text-red-300 text-sm">
                    {reason.message || `У вас нет прав для просмотра "${entityName}".`}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
                    Обратитесь к администратору для получения доступа.
                </p>
            </div>
        );
    }

    if (reason.type === 'error') {
        return (
            <div className="text-center py-12 px-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
                    Ошибка загрузки
                </h3>
                <p className="text-red-600 dark:text-red-300 text-sm">
                    {reason.message}
                </p>
                {reason.requestId && (
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-3 font-mono">
                        Request ID: {reason.requestId}
                    </p>
                )}
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-200 rounded-md transition-colors text-sm font-medium"
                    >
                        Попробовать снова
                    </button>
                )}
            </div>
        );
    }

    // type === 'empty'
    return (
        <div className="text-center py-12 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
                Нет данных
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
                {reason.entityName
                    ? `В организации "${orgName ?? 'текущей'}" нет записей "${reason.entityName}".`
                    : `В организации "${orgName ?? 'текущей'}" нет данных.`
                }
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                Проверьте, что вы находитесь в нужной организации (см. панель контекста вверху).
            </p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium transition-colors text-sm"
                >
                    Обновить данные
                </button>
            )}
        </div>
    );
};

export default EmptyState;

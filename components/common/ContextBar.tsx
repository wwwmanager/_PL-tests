// REL-001: Enhanced Context Banner with org mismatch warning
// Shows current organization/department context and provides debug copy functionality

import React from 'react';
import { useMe } from '../../contexts/MeContext';

const APP_VERSION = '1.0.0'; // Can be replaced with VITE_APP_VERSION

export const ContextBar: React.FC = () => {
    const meState = useMe();

    if (meState.status === "loading") return null;
    if (meState.status === "unauthenticated") return null;
    if (meState.status === "error") {
        return (
            <div className="px-3 py-2 text-sm bg-red-50 text-red-800 border-b dark:bg-red-900 dark:text-red-200">
                Ошибка контекста: {meState.error}
            </div>
        );
    }

    const { me } = meState;

    // Check for org mismatch between token and DB
    const hasOrgMismatch = me.tokenClaims.organizationId !== me.organization.id;

    async function copyDiagnostics() {
        const payload = {
            appVersion: APP_VERSION,
            me,
            userAgent: navigator.userAgent,
            time: new Date().toISOString(),
            url: window.location.href,
        };
        const text = JSON.stringify(payload, null, 2);
        try {
            await navigator.clipboard.writeText(text);
            alert('Диагностика скопирована в буфер обмена');
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'dispatcher': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'driver': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'accountant': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        }
    };

    return (
        <div className="px-3 py-2 text-sm bg-gradient-to-r from-slate-50 to-blue-50 dark:from-gray-800 dark:to-gray-750 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-gray-700 flex items-center gap-3 flex-wrap">
            {/* Organization */}
            <div className="flex items-center gap-1">
                <span>🏢</span>
                <span className="font-medium">Организация:</span>{" "}
                <span className="text-blue-700 dark:text-blue-300">
                    {me.organization.name ?? me.organization.id.slice(0, 8) + '...'}
                </span>
            </div>

            {/* Department */}
            <div className="flex items-center gap-1">
                <span className="font-medium">Подразделение:</span>{" "}
                <span>{me.department?.name ?? <span className="text-gray-400 italic">не задано</span>}</span>
            </div>

            {/* Role Badge */}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(me.user.role)}`}>
                {me.user.role}
            </span>

            {/* Driver indicator */}
            {me.user.employeeId && (
                <span className={`px-2 py-0.5 rounded text-xs ${me.user.driverId ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}`}>
                    {me.user.driverId ? '🚗 Driver' : '⚠️ No Driver'}
                </span>
            )}

            {/* IMPORTANT: Org mismatch warning */}
            {hasOrgMismatch && (
                <div className="text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded border border-amber-300 dark:border-amber-700">
                    ⚠️ organizationId в токене ≠ organizationId в БД (возможны пустые списки!)
                </div>
            )}

            {/* Copy diagnostics button */}
            <button
                onClick={copyDiagnostics}
                className="ml-auto px-2 py-1 border rounded bg-white hover:bg-slate-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs"
                title="Скопировать диагностическую информацию"
            >
                📋 Скопировать диагностику
            </button>
        </div>
    );
};

export default ContextBar;

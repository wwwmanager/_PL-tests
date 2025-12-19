// REL-001: Context Banner Component
// Shows current organization/department context and provides debug copy functionality

import React, { useState, useEffect } from 'react';

interface UserContext {
    userId: string;
    email: string;
    fullName: string;
    role: string;
    organizationId: string;
    organizationName: string | null;
    departmentId: string | null;
    departmentName: string | null;
    employeeId: string | null;
    driverId: string | null;
}

interface DebugInfo {
    timestamp: string;
    backendVersion: string;
    userId: string;
    organizationId: string;
    departmentId: string | null;
    role: string;
    employeeId: string | null;
    driverId: string | null;
}

interface ContextBannerProps {
    className?: string;
}

export const ContextBanner: React.FC<ContextBannerProps> = ({ className = '' }) => {
    const [context, setContext] = useState<UserContext | null>(null);
    const [debug, setDebug] = useState<DebugInfo | null>(null);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        fetchContext();
    }, []);

    const fetchContext = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) return;

            const response = await fetch('http://localhost:3001/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    setContext(data.data.user);
                    setDebug(data.data.debug);
                }
            }
        } catch (error) {
            console.error('Failed to fetch context:', error);
        }
    };

    const copyDebugInfo = async () => {
        if (!debug || !context) return;

        const debugPackage = {
            ...debug,
            frontendVersion: '1.0.0',
            userAgent: navigator.userAgent,
            url: window.location.href,
            context: {
                organizationName: context.organizationName,
                departmentName: context.departmentName,
                role: context.role
            }
        };

        try {
            await navigator.clipboard.writeText(JSON.stringify(debugPackage, null, 2));
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000);
        } catch (err) {
            setCopyStatus('error');
            setTimeout(() => setCopyStatus('idle'), 2000);
        }
    };

    if (!context) return null;

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
        <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-750 border-b border-blue-200 dark:border-gray-700 ${className}`}>
            <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                    {/* Organization */}
                    <div className="flex items-center gap-1">
                        <span className="text-gray-500 dark:text-gray-400">🏢</span>
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                            {context.organizationName || 'Не указана'}
                        </span>
                    </div>

                    {/* Department */}
                    {context.departmentName && (
                        <div className="flex items-center gap-1">
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-600 dark:text-gray-300">
                                {context.departmentName}
                            </span>
                        </div>
                    )}

                    {/* Role Badge */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(context.role)}`}>
                        {context.role}
                    </span>

                    {/* Driver/Employee indicator */}
                    {context.employeeId && (
                        <span className={`px-2 py-0.5 rounded text-xs ${context.driverId ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}`}>
                            {context.driverId ? '🚗 Driver' : '⚠️ No Driver'}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Expand/Collapse */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xs"
                        title="Показать детали"
                    >
                        {expanded ? '▲' : '▼'}
                    </button>

                    {/* Copy Debug Button */}
                    <button
                        onClick={copyDebugInfo}
                        className={`px-2 py-1 text-xs rounded transition-colors ${copyStatus === 'copied'
                                ? 'bg-green-500 text-white'
                                : copyStatus === 'error'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                            }`}
                        title="Скопировать диагностическую информацию"
                    >
                        {copyStatus === 'copied' ? '✓ Скопировано' : copyStatus === 'error' ? '✕ Ошибка' : '📋 Debug'}
                    </button>
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-4 py-2 bg-white/50 dark:bg-gray-900/50 border-t border-blue-100 dark:border-gray-700 text-xs font-mono">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div><span className="text-gray-500">OrgID:</span> <span className="text-gray-700 dark:text-gray-300">{context.organizationId?.slice(0, 8)}...</span></div>
                        <div><span className="text-gray-500">DeptID:</span> <span className="text-gray-700 dark:text-gray-300">{context.departmentId?.slice(0, 8) || 'null'}...</span></div>
                        <div><span className="text-gray-500">EmpID:</span> <span className="text-gray-700 dark:text-gray-300">{context.employeeId?.slice(0, 8) || 'null'}...</span></div>
                        <div><span className="text-gray-500">DriverID:</span> <span className="text-gray-700 dark:text-gray-300">{context.driverId?.slice(0, 8) || 'null'}...</span></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContextBanner;

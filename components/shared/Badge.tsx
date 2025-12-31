/**
 * Badge — UI-DESIGN-002
 * Reusable badge component for status indicators
 */
import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' | 'indigo' | 'emerald' | 'orange' | 'pink';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
    /** Badge variant */
    variant?: BadgeVariant;
    /** Badge size */
    size?: BadgeSize;
    /** Badge content */
    children: React.ReactNode;
    /** Pill shape (rounded-full) */
    pill?: boolean;
    /** Optional icon on left */
    icon?: React.ReactNode;
    /** Additional className */
    className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
    success: 'bg-teal-600 text-white dark:bg-teal-500',  // UI-DESIGN: Solid teal for POSTED status
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
    emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
    pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200',
};

const sizeClasses: Record<BadgeSize, string> = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
    variant = 'neutral',
    size = 'md',
    children,
    pill = true,
    icon,
    className = '',
}) => {
    const baseClasses = 'inline-flex items-center gap-1 font-medium';
    const radiusClass = pill ? 'rounded-full' : 'rounded-md';

    return (
        <span className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${radiusClass} ${className}`}>
            {icon}
            {children}
        </span>
    );
};

// Pre-configured status badges
export const StatusBadges = {
    // Waybill statuses
    Draft: () => <Badge variant="neutral">Черновик</Badge>,
    Submitted: () => <Badge variant="warning">Отправлено</Badge>,
    Posted: () => <Badge variant="success">Проведено</Badge>,
    Cancelled: () => <Badge variant="danger">Отменено</Badge>,

    // Generic
    Active: () => <Badge variant="success">Активен</Badge>,
    Inactive: () => <Badge variant="neutral">Неактивен</Badge>,
    Archived: () => <Badge variant="purple">В архиве</Badge>,
    Pending: () => <Badge variant="warning">Ожидание</Badge>,
    Error: () => <Badge variant="danger">Ошибка</Badge>,
};

export default Badge;

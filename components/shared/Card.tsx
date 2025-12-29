/**
 * Card — UI-DESIGN-002
 * Reusable card component with header, body, and optional footer
 */
import React from 'react';
import { surfaces, borders, radii, shadows, typography } from '../../design/tokens';

interface CardProps {
    /** Card title */
    title?: string;
    /** Optional subtitle */
    subtitle?: string;
    /** Card content */
    children: React.ReactNode;
    /** Optional footer (buttons, links) */
    footer?: React.ReactNode;
    /** Additional className */
    className?: string;
    /** Padding variant */
    padding?: 'none' | 'sm' | 'md' | 'lg';
    /** Optional header right section */
    headerRight?: React.ReactNode;
}

const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
    title,
    subtitle,
    children,
    footer,
    className = '',
    padding = 'md',
    headerRight,
}) => {
    return (
        <div className={`${surfaces.card} ${borders.default} border ${radii.card} ${shadows.card} ${className}`}>
            {(title || headerRight) && (
                <header className={`flex items-center justify-between ${paddingClasses[padding]} border-b ${borders.default}`}>
                    <div>
                        {title && <h3 className={typography.h3}>{title}</h3>}
                        {subtitle && <p className={`${typography.helper} mt-1`}>{subtitle}</p>}
                    </div>
                    {headerRight && <div>{headerRight}</div>}
                </header>
            )}
            <div className={paddingClasses[padding]}>
                {children}
            </div>
            {footer && (
                <footer className={`${paddingClasses[padding]} border-t ${borders.default} bg-gray-50 dark:bg-gray-700/30`}>
                    {footer}
                </footer>
            )}
        </div>
    );
};

export default Card;

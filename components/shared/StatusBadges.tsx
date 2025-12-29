/**
 * StatusBadges — UI-DESIGN-005
 * Unified status badge components for consistent rendering across all screens
 */
import React from 'react';
import { Badge } from './Badge';
import { WaybillStatus, VehicleStatus, OrganizationStatus, BlankStatus } from '../../types';
import { WAYBILL_STATUS_TRANSLATIONS, VEHICLE_STATUS_TRANSLATIONS, ORGANIZATION_STATUS_TRANSLATIONS, BLANK_STATUS_TRANSLATIONS } from '../../constants';

// =============================================================================
// STATUS → BADGE VARIANT MAPPINGS
// =============================================================================

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

const WAYBILL_STATUS_VARIANT: Record<WaybillStatus, BadgeVariant> = {
    [WaybillStatus.DRAFT]: 'neutral',
    [WaybillStatus.SUBMITTED]: 'warning',
    [WaybillStatus.POSTED]: 'success',
    [WaybillStatus.CANCELLED]: 'danger',
};

const VEHICLE_STATUS_VARIANT: Record<VehicleStatus, BadgeVariant> = {
    [VehicleStatus.ACTIVE]: 'success',
    [VehicleStatus.ARCHIVED]: 'purple',
};

const ORGANIZATION_STATUS_VARIANT: Record<OrganizationStatus, BadgeVariant> = {
    [OrganizationStatus.ACTIVE]: 'success',
    [OrganizationStatus.ARCHIVED]: 'purple',
    [OrganizationStatus.LIQUIDATED]: 'danger',
};

const BLANK_STATUS_VARIANT: Record<BlankStatus, BadgeVariant> = {
    available: 'info',
    issued: 'warning',
    reserved: 'purple',
    used: 'success',
    returned: 'neutral',
    spoiled: 'danger',
};

// =============================================================================
// UNIFIED BADGE COMPONENTS
// =============================================================================

interface StatusBadgeProps {
    /** Additional className */
    className?: string;
    /** Show icon */
    showIcon?: boolean;
}

/**
 * Waybill Status Badge — unified styling across all screens
 */
export const WaybillStatusBadge: React.FC<{ status: WaybillStatus } & StatusBadgeProps> = ({
    status,
    className,
}) => {
    const variant = WAYBILL_STATUS_VARIANT[status] || 'neutral';
    const label = WAYBILL_STATUS_TRANSLATIONS[status] || status;

    return (
        <Badge variant={variant} className={className}>
            {label}
        </Badge>
    );
};

/**
 * Vehicle Status Badge — unified styling across all screens
 */
export const VehicleStatusBadge: React.FC<{ status: VehicleStatus } & StatusBadgeProps> = ({
    status,
    className,
}) => {
    const variant = VEHICLE_STATUS_VARIANT[status] || 'neutral';
    const label = VEHICLE_STATUS_TRANSLATIONS[status] || status;

    return (
        <Badge variant={variant} className={className}>
            {label}
        </Badge>
    );
};

/**
 * Organization Status Badge — unified styling across all screens
 */
export const OrganizationStatusBadge: React.FC<{ status: OrganizationStatus } & StatusBadgeProps> = ({
    status,
    className,
}) => {
    const variant = ORGANIZATION_STATUS_VARIANT[status] || 'neutral';
    const label = ORGANIZATION_STATUS_TRANSLATIONS[status] || status;

    return (
        <Badge variant={variant} className={className}>
            {label}
        </Badge>
    );
};

/**
 * Blank Status Badge — unified styling across all screens
 */
export const BlankStatusBadge: React.FC<{ status: BlankStatus } & StatusBadgeProps> = ({
    status,
    className,
}) => {
    const variant = BLANK_STATUS_VARIANT[status] || 'neutral';
    const label = BLANK_STATUS_TRANSLATIONS[status] || status;

    return (
        <Badge variant={variant} className={className}>
            {label}
        </Badge>
    );
};

// Export mappings for advanced usage
export const statusVariants = {
    waybill: WAYBILL_STATUS_VARIANT,
    vehicle: VEHICLE_STATUS_VARIANT,
    organization: ORGANIZATION_STATUS_VARIANT,
    blank: BLANK_STATUS_VARIANT,
};

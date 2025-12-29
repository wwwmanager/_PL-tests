/**
 * Shared Components — UI-DESIGN-002
 * Centralized exports for all shared UI components
 */

// Layout components
export { Card } from './Card';

// Theme
export { ThemeToggle } from './ThemeToggle';
export { Button } from './Button';

// Status indicators
export { Badge, StatusBadges } from './Badge';
export {
    WaybillStatusBadge,
    VehicleStatusBadge,
    OrganizationStatusBadge,
    BlankStatusBadge,
    statusVariants
} from './StatusBadges';

// Feedback components
export { Toast, ToastContainer, toast } from './Toast';

// Data display
export { default as DataTable } from './DataTable';
export type { Column, DataTableProps } from './DataTable';

// Modals
export { default as Modal } from './Modal';
export { default as ConfirmationModal } from './ConfirmationModal';

// Form components
export { AutocompleteInput } from './AutocompleteInput';

// Utility components
export { default as CollapsibleSection } from './CollapsibleSection';

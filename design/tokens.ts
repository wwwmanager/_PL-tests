/**
 * Design Tokens — UI-DESIGN-001
 * Centralized design system tokens for consistent styling.
 * Based on Innovations prototype patterns.
 */

// =============================================================================
// SEMANTIC COLORS
// =============================================================================

/**
 * Primary color palette for semantic usage
 */
export const colors = {
    primary: 'indigo',      // Action buttons, links
    success: 'teal',        // Posted, Active, Success
    warning: 'amber',       // Submitted, Pending, Attention
    danger: 'red',          // Cancelled, Error, Destructive
    info: 'blue',           // Info badges, hints
    neutral: 'gray',        // Draft, Default, Disabled
} as const;

/**
 * Status badge classes - ready-to-use Tailwind classes
 */
export const statusBadge = {
    // Generic semantic badges
    success: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',

    // Accent colors for variety
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
    emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
    pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200',
} as const;

// =============================================================================
// SURFACES & BACKGROUNDS
// =============================================================================

export const surfaces = {
    /** Main card background */
    card: 'bg-white dark:bg-gray-800',
    /** Muted/subtle background for sections */
    muted: 'bg-gray-50 dark:bg-gray-700/30',
    /** Page background */
    page: 'bg-gray-100 dark:bg-gray-900',
    /** Overlay/backdrop */
    overlay: 'bg-black/60',
} as const;

export const borders = {
    /** Default border */
    default: 'border-gray-200 dark:border-gray-700',
    /** Subtle border */
    subtle: 'border-gray-100 dark:border-gray-800',
    /** Focus ring */
    focus: 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
} as const;

// =============================================================================
// RADII & SHADOWS
// =============================================================================

export const radii = {
    /** Cards, modals */
    card: 'rounded-xl',
    /** Large cards, hero sections */
    cardLg: 'rounded-2xl',
    /** Buttons, inputs */
    button: 'rounded-lg',
    /** Small elements */
    sm: 'rounded-md',
    /** Badges, pills */
    badge: 'rounded-full',
} as const;

export const shadows = {
    /** Card shadow */
    card: 'shadow-lg',
    /** Elevated elements */
    elevated: 'shadow-xl',
    /** Button shadow */
    button: 'shadow-md',
    /** Subtle shadow */
    sm: 'shadow-sm',
    /** No shadow */
    none: 'shadow-none',
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
    /** Page heading */
    h1: 'text-3xl font-bold text-gray-900 dark:text-white',
    /** Section heading */
    h2: 'text-2xl font-bold text-gray-800 dark:text-white',
    /** Card heading */
    h3: 'text-xl font-bold text-gray-800 dark:text-gray-100',
    /** Subsection */
    h4: 'text-lg font-semibold text-gray-700 dark:text-gray-200',
    /** Form labels */
    label: 'text-sm font-medium text-gray-700 dark:text-gray-300',
    /** Helper text */
    helper: 'text-xs text-gray-500 dark:text-gray-400',
    /** Monospace for code/numbers */
    mono: 'font-mono text-sm',
    /** Body text */
    body: 'text-gray-700 dark:text-gray-300',
} as const;

// =============================================================================
// BUTTON VARIANTS
// =============================================================================

export const button = {
    /** Base button styles */
    base: 'font-semibold py-2 px-4 rounded-lg shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',

    /** Primary action */
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    /** Secondary action */
    secondary: 'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-500',
    /** Success action */
    success: 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500',
    /** Warning action */
    warning: 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500',
    /** Danger/destructive */
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    /** Ghost/outline */
    ghost: 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-none',
    /** Disabled state */
    disabled: 'opacity-50 cursor-not-allowed',
} as const;

// =============================================================================
// TABLE STYLES
// =============================================================================

export const table = {
    /** Table container */
    container: 'overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg',
    /** Table element */
    table: 'w-full text-sm text-left text-gray-700 dark:text-gray-300',
    /** Header */
    thead: 'text-xs text-gray-500 dark:text-gray-400 uppercase bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
    /** Header cell */
    th: 'px-6 py-3 font-medium',
    /** Body */
    tbody: 'divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800',
    /** Row */
    tr: 'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
    /** Cell */
    td: 'px-6 py-3 whitespace-nowrap',
} as const;

// =============================================================================
// MODAL STYLES
// =============================================================================

export const modal = {
    /** Backdrop */
    backdrop: 'fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4',
    /** Content container */
    content: 'bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-h-[90vh] flex flex-col',
    /** Header */
    header: 'flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700',
    /** Body */
    body: 'p-6 overflow-y-auto',
    /** Footer */
    footer: 'flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700',
} as const;

// =============================================================================
// INPUT STYLES
// =============================================================================

export const input = {
    /** Base input */
    base: 'w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md p-2 text-gray-700 dark:text-gray-200 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow',
    /** Select dropdown */
    select: 'w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md p-2 text-gray-700 dark:text-gray-200 focus:ring-blue-500 focus:border-blue-500',
    /** Checkbox */
    checkbox: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500',
    /** Label */
    label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
} as const;

// =============================================================================
// ANIMATIONS
// =============================================================================

export const animation = {
    /** Fade in */
    fadeIn: 'animate-fadeIn',
    /** Spin loader */
    spin: 'animate-spin',
    /** Transition base */
    transition: 'transition-all duration-200',
    /** Hover scale */
    hoverScale: 'transform hover:scale-105',
} as const;

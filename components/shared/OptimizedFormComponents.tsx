import React from 'react';

/**
 * Memoized form field component
 * Prevents re-renders when parent component updates
 */
export const FormField = React.memo<{ label: string; children: React.ReactNode; required?: boolean }>(
    ({ label, children, required }) => (
        <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                {label}
                {required && <span className="text-orange-500 ml-1">*</span>}
            </label>
            {children}
        </div>
    )
);

FormField.displayName = 'FormField';

/**
 * Memoized form input component
 * Optimized for performance with React.memo
 */
export const FormInput = React.memo<React.InputHTMLAttributes<HTMLInputElement>>(
    (props) => (
        <input
            {...props}
            className={`w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 read-only:bg-gray-200 dark:read-only:bg-gray-800 dark:[color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''
                }`}
        />
    )
);

FormInput.displayName = 'FormInput';

/**
 * Memoized form select component
 * Optimized for performance with React.memo
 */
export const FormSelect = React.memo<React.SelectHTMLAttributes<HTMLSelectElement>>(
    (props) => (
        <select
            {...props}
            className={`w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''
                }`}
        />
    )
);

FormSelect.displayName = 'FormSelect';

/**
 * Memoized form textarea component
 * Optimized for performance with React.memo
 */
export const FormTextarea = React.memo<React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    (props) => (
        <textarea
            {...props}
            className={`w-full bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''
                }`}
        />
    )
);

FormTextarea.displayName = 'FormTextarea';

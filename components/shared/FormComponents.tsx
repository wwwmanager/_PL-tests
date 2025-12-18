import React from 'react';

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, children, error, required = false, htmlFor }) => {
  // Clone children and add required-field class if needed
  const enhancedChildren = React.Children.map(children, child => {
    if (React.isValidElement(child) && required) {
      // Add required-field class to input/select/textarea elements
      const currentClassName = child.props.className || '';
      const newClassName = `${currentClassName} required-field`.trim();
      return React.cloneElement(child as React.ReactElement<any>, {
        className: newClassName,
      });
    }
    return child;
  });

  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1"
      >
        {label}
        {required && <span className="text-orange-500 ml-1" title="Обязательное поле">*</span>}
      </label>
      {enhancedChildren}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

export const FormInput: React.FC<FormInputProps> = (props) => (
  <input
    {...props}
    className={`w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 read-only:bg-gray-200 dark:read-only:bg-gray-800 dark:[color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
  />
);

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { }

export const FormSelect: React.FC<FormSelectProps> = (props) => (
  <select
    {...props}
    className={`w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
  />
);

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

export const FormTextarea: React.FC<FormTextareaProps> = (props) => (
  <textarea
    {...props}
    rows={props.rows || 3}
    className={`w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
  />
);

interface FormCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> { }

export const FormCheckbox: React.FC<FormCheckboxProps> = (props) => (
  <input
    type="checkbox"
    {...props}
    className={`h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 ${props.className || ''}`}
  />
);

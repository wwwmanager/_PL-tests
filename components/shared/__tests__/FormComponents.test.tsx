import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FormField, FormInput, FormSelect, FormTextarea, FormCheckbox } from '../FormComponents';

describe('FormComponents', () => {
    describe('FormField', () => {
        it('renders label and children correctly', () => {
            render(
                <FormField label="Test Label">
                    <input data-testid="test-input" />
                </FormField>
            );

            expect(screen.getByText('Test Label')).toBeInTheDocument();
            expect(screen.getByTestId('test-input')).toBeInTheDocument();
        });

        it('displays error message when provided', () => {
            render(
                <FormField label="Test Label" error="This field is required">
                    <input />
                </FormField>
            );

            expect(screen.getByText('This field is required')).toBeInTheDocument();
        });

        it('shows asterisk for required fields', () => {
            render(
                <FormField label="Required Field" required>
                    <input data-testid="required-input" />
                </FormField>
            );

            const asterisk = screen.getByText('*');
            expect(asterisk).toBeInTheDocument();
            expect(asterisk).toHaveAttribute('title', 'Обязательное поле');
        });

        it('adds required-field class to children when required=true', () => {
            render(
                <FormField label="Required Field" required>
                    <input data-testid="required-input" className="base-class" />
                </FormField>
            );

            const input = screen.getByTestId('required-input');
            expect(input).toHaveClass('base-class');
            expect(input).toHaveClass('required-field');
        });

        it('does not add required-field class when required=false', () => {
            render(
                <FormField label="Optional Field">
                    <input data-testid="optional-input" className="base-class" />
                </FormField>
            );

            const input = screen.getByTestId('optional-input');
            expect(input).toHaveClass('base-class');
            expect(input).not.toHaveClass('required-field');
        });

        it('applies htmlFor attribute to label', () => {
            render(
                <FormField label="Test Label" htmlFor="test-input-id">
                    <input id="test-input-id" />
                </FormField>
            );

            const label = screen.getByText('Test Label');
            expect(label).toHaveAttribute('for', 'test-input-id');
        });
    });

    describe('FormInput', () => {
        it('renders input with correct props', () => {
            render(<FormInput data-testid="test-input" placeholder="Enter text" />);

            const input = screen.getByTestId('test-input');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('placeholder', 'Enter text');
        });

        it('applies custom className alongside default classes', () => {
            render(<FormInput data-testid="test-input" className="custom-class" />);

            const input = screen.getByTestId('test-input');
            expect(input).toHaveClass('custom-class');
            expect(input).toHaveClass('w-full');
        });

        it('handles disabled state', () => {
            render(<FormInput data-testid="test-input" disabled />);

            const input = screen.getByTestId('test-input');
            expect(input).toBeDisabled();
        });

        it('handles readOnly state', () => {
            render(<FormInput data-testid="test-input" readOnly />);

            const input = screen.getByTestId('test-input');
            expect(input).toHaveAttribute('readOnly');
        });
    });

    describe('FormSelect', () => {
        it('renders select with options', () => {
            render(
                <FormSelect data-testid="test-select">
                    <option value="1">Option 1</option>
                    <option value="2">Option 2</option>
                </FormSelect>
            );

            const select = screen.getByTestId('test-select');
            expect(select).toBeInTheDocument();
            expect(screen.getByText('Option 1')).toBeInTheDocument();
            expect(screen.getByText('Option 2')).toBeInTheDocument();
        });

        it('applies custom className alongside default classes', () => {
            render(
                <FormSelect data-testid="test-select" className="custom-select">
                    <option>Test</option>
                </FormSelect>
            );

            const select = screen.getByTestId('test-select');
            expect(select).toHaveClass('custom-select');
            expect(select).toHaveClass('w-full');
        });

        it('handles disabled state', () => {
            render(
                <FormSelect data-testid="test-select" disabled>
                    <option>Test</option>
                </FormSelect>
            );

            const select = screen.getByTestId('test-select');
            expect(select).toBeDisabled();
        });
    });

    describe('FormTextarea', () => {
        it('renders textarea with correct props', () => {
            render(<FormTextarea data-testid="test-textarea" placeholder="Enter description" />);

            const textarea = screen.getByTestId('test-textarea');
            expect(textarea).toBeInTheDocument();
            expect(textarea).toHaveAttribute('placeholder', 'Enter description');
        });

        it('uses default rows value of 3', () => {
            render(<FormTextarea data-testid="test-textarea" />);

            const textarea = screen.getByTestId('test-textarea');
            expect(textarea).toHaveAttribute('rows', '3');
        });

        it('respects custom rows value', () => {
            render(<FormTextarea data-testid="test-textarea" rows={5} />);

            const textarea = screen.getByTestId('test-textarea');
            expect(textarea).toHaveAttribute('rows', '5');
        });

        it('applies custom className alongside default classes', () => {
            render(<FormTextarea data-testid="test-textarea" className="custom-textarea" />);

            const textarea = screen.getByTestId('test-textarea');
            expect(textarea).toHaveClass('custom-textarea');
            expect(textarea).toHaveClass('w-full');
        });

        it('handles disabled state', () => {
            render(<FormTextarea data-testid="test-textarea" disabled />);

            const textarea = screen.getByTestId('test-textarea');
            expect(textarea).toBeDisabled();
        });
    });

    describe('FormCheckbox', () => {
        it('renders checkbox with type="checkbox"', () => {
            render(<FormCheckbox data-testid="test-checkbox" />);

            const checkbox = screen.getByTestId('test-checkbox');
            expect(checkbox).toBeInTheDocument();
            expect(checkbox).toHaveAttribute('type', 'checkbox');
        });

        it('applies custom className alongside default classes', () => {
            render(<FormCheckbox data-testid="test-checkbox" className="custom-checkbox" />);

            const checkbox = screen.getByTestId('test-checkbox');
            expect(checkbox).toHaveClass('custom-checkbox');
            expect(checkbox).toHaveClass('h-4');
        });

        it('handles checked state', () => {
            render(<FormCheckbox data-testid="test-checkbox" checked readOnly />);

            const checkbox = screen.getByTestId('test-checkbox') as HTMLInputElement;
            expect(checkbox.checked).toBe(true);
        });

        it('handles disabled state', () => {
            render(<FormCheckbox data-testid="test-checkbox" disabled />);

            const checkbox = screen.getByTestId('test-checkbox');
            expect(checkbox).toBeDisabled();
        });
    });

    describe('Integration: FormField with FormInput', () => {
        it('combines FormField required prop with FormInput', () => {
            render(
                <FormField label="Email" required error="Email is required">
                    <FormInput data-testid="email-input" type="email" />
                </FormField>
            );

            // Check label with asterisk
            expect(screen.getByText('Email')).toBeInTheDocument();
            expect(screen.getByText('*')).toBeInTheDocument();

            // Check input has required-field class
            const input = screen.getByTestId('email-input');
            expect(input).toHaveClass('required-field');

            // Check error message
            expect(screen.getByText('Email is required')).toBeInTheDocument();
        });
    });

    describe('Integration: FormField with FormSelect', () => {
        it('combines FormField required prop with FormSelect', () => {
            render(
                <FormField label="Country" required>
                    <FormSelect data-testid="country-select">
                        <option value="">Select country</option>
                        <option value="ru">Russia</option>
                        <option value="us">USA</option>
                    </FormSelect>
                </FormField>
            );

            // Check label with asterisk
            expect(screen.getByText('Country')).toBeInTheDocument();
            expect(screen.getByText('*')).toBeInTheDocument();

            // Check select has required-field class
            const select = screen.getByTestId('country-select');
            expect(select).toHaveClass('required-field');
        });
    });

    describe('Integration: FormField with FormTextarea', () => {
        it('combines FormField required prop with FormTextarea', () => {
            render(
                <FormField label="Description" required>
                    <FormTextarea data-testid="description-textarea" />
                </FormField>
            );

            // Check label with asterisk
            expect(screen.getByText('Description')).toBeInTheDocument();
            expect(screen.getByText('*')).toBeInTheDocument();

            // Check textarea has required-field class
            const textarea = screen.getByTestId('description-textarea');
            expect(textarea).toHaveClass('required-field');
        });
    });
});

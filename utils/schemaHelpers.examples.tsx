/**
 * Примеры использования утилит schemaHelpers для автоматического определения обязательных полей
 */

import { z } from 'zod';
import {
    isFieldRequired,
    getRequiredFields,
    getRequiredFieldsWithErrors,
    isNestedFieldRequired,
    createRequiredProps,
} from './schemaHelpers';

// ============================================================================
// Пример 1: Базовое использование с простой схемой
// ============================================================================

const userSchema = z.object({
    email: z.string().min(1, 'Email обязателен'),
    password: z.string().min(8, 'Пароль должен быть не менее 8 символов'),
    name: z.string().optional(),
    age: z.number().optional(),
});

// Получить список всех обязательных полей
const requiredUserFields = getRequiredFields(userSchema);
console.log('Required user fields:', requiredUserFields);
// Output: ['email', 'password']

// Проверить конкретное поле
const isEmailRequired = isFieldRequired(userSchema, 'email');
console.log('Is email required?', isEmailRequired); // true

const isNameRequired = isFieldRequired(userSchema, 'name');
console.log('Is name required?', isNameRequired); // false

// ============================================================================
// Пример 2: Использование в React компоненте с формой
// ============================================================================

import React from 'react';
import { FormField, FormInput } from '../components/shared/FormComponents';

const vehicleSchema = z.object({
    plateNumber: z.string().min(1, 'Гос. номер обязателен'),
    brand: z.string().min(1, 'Марка/модель обязательна'),
    vin: z.string().min(1, 'VIN обязателен'),
    year: z.number().optional(),
    notes: z.string().optional().nullable(),
});

// Способ 1: Создать объект с пропсами required для всех полей
const VehicleFormExample1: React.FC = () => {
    const requiredProps = createRequiredProps(vehicleSchema);

    return (
        <form>
            <FormField label="Гос. номер" required={requiredProps.plateNumber}>
                <FormInput name="plateNumber" />
            </FormField>

            <FormField label="Марка/модель" required={requiredProps.brand}>
                <FormInput name="brand" />
            </FormField>

            <FormField label="VIN" required={requiredProps.vin}>
                <FormInput name="vin" />
            </FormField>

            <FormField label="Год выпуска" required={requiredProps.year}>
                <FormInput name="year" type="number" />
            </FormField>

            <FormField label="Примечания" required={requiredProps.notes}>
                <FormInput name="notes" />
            </FormField>
        </form>
    );
};

// Способ 2: Проверять каждое поле отдельно
const VehicleFormExample2: React.FC = () => {
    return (
        <form>
            <FormField
                label="Гос. номер"
                required={isFieldRequired(vehicleSchema, 'plateNumber')}
            >
                <FormInput name="plateNumber" />
            </FormField>

            <FormField
                label="Год выпуска"
                required={isFieldRequired(vehicleSchema, 'year')}
            >
                <FormInput name="year" type="number" />
            </FormField>
        </form>
    );
};

// ============================================================================
// Пример 3: Работа с вложенными полями
// ============================================================================

const vehicleWithNestedSchema = z.object({
    plateNumber: z.string().min(1),
    fuelConsumptionRates: z.object({
        summerRate: z.number().positive('Летняя норма обязательна'),
        winterRate: z.number().positive('Зимняя норма обязательна'),
        cityIncreasePercent: z.number().optional().nullable(),
        warmingIncreasePercent: z.number().optional().nullable(),
    }),
});

// Проверка вложенных полей
const isSummerRateRequired = isNestedFieldRequired(
    vehicleWithNestedSchema,
    'fuelConsumptionRates.summerRate'
);
console.log('Is summer rate required?', isSummerRateRequired); // true

const isCityIncreaseRequired = isNestedFieldRequired(
    vehicleWithNestedSchema,
    'fuelConsumptionRates.cityIncreasePercent'
);
console.log('Is city increase required?', isCityIncreaseRequired); // false

// Использование в компоненте
const FuelRatesForm: React.FC = () => {
    return (
        <div>
            <FormField
                label="Летняя норма"
                required={isNestedFieldRequired(vehicleWithNestedSchema, 'fuelConsumptionRates.summerRate')}
            >
                <FormInput name="fuelConsumptionRates.summerRate" type="number" />
            </FormField>

            <FormField
                label="Надбавка городской цикл"
                required={isNestedFieldRequired(vehicleWithNestedSchema, 'fuelConsumptionRates.cityIncreasePercent')}
            >
                <FormInput name="fuelConsumptionRates.cityIncreasePercent" type="number" />
            </FormField>
        </div>
    );
};

// ============================================================================
// Пример 4: Получение сообщений об ошибках
// ============================================================================

const employeeSchema = z.object({
    fullName: z.string().min(1, 'ФИО обязательно для заполнения'),
    email: z.string().email('Некорректный email').min(1, 'Email обязателен'),
    phone: z.string().optional(),
});

// Получить карту обязательных полей с сообщениями об ошибках
const fieldsWithErrors = getRequiredFieldsWithErrors(employeeSchema);
console.log('Fields with errors:', fieldsWithErrors);
// Output: {
//   fullName: 'ФИО обязательно для заполнения',
//   email: 'Email обязателен'
// }

// Использование для отображения подсказок
const EmployeeForm: React.FC = () => {
    const errors = getRequiredFieldsWithErrors(employeeSchema);

    return (
        <form>
            <FormField
                label="ФИО"
                required={true}
                error={errors.fullName}
            >
                <FormInput name="fullName" />
            </FormField>
        </form>
    );
};

// ============================================================================
// Пример 5: Динамическая генерация формы на основе схемы
// ============================================================================

const dynamicSchema = z.object({
    username: z.string().min(3, 'Минимум 3 символа'),
    email: z.string().email(),
    age: z.number().min(18, 'Минимум 18 лет'),
    bio: z.string().optional(),
    newsletter: z.boolean().optional(),
});

const DynamicForm: React.FC = () => {
    const requiredProps = createRequiredProps(dynamicSchema);
    const allFields = Object.keys(dynamicSchema.shape);

    return (
        <form>
            {allFields.map(fieldName => {
                const isRequired = requiredProps[fieldName];

                return (
                    <FormField
                        key={fieldName}
                        label={fieldName}
                        required={isRequired}
                    >
                        <FormInput name={fieldName} />
                    </FormField>
                );
            })}
        </form>
    );
};

// ============================================================================
// Пример 6: Валидация формы с автоматическим определением обязательных полей
// ============================================================================

const validateForm = (data: any, schema: z.ZodObject<any>) => {
    const requiredFields = getRequiredFields(schema);
    const errors: Record<string, string> = {};

    // Проверяем все обязательные поля
    requiredFields.forEach(field => {
        if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
            errors[field] = `${field} обязателен для заполнения`;
        }
    });

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};

// Использование
const formData = {
    plateNumber: 'А123БВ',
    brand: '',
    vin: 'XTA123456789',
};

const validation = validateForm(formData, vehicleSchema);
console.log('Validation result:', validation);
// Output: {
//   isValid: false,
//   errors: { brand: 'brand обязателен для заполнения' }
// }

// ============================================================================
// Пример 7: Интеграция с react-hook-form
// ============================================================================

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const VehicleFormWithHookForm: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(vehicleSchema),
    });

    const requiredProps = createRequiredProps(vehicleSchema);

    const onSubmit = (data: any) => {
        console.log('Form data:', data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <FormField
                label="Гос. номер"
                required={requiredProps.plateNumber}
                error={errors.plateNumber?.message as string}
            >
                <FormInput {...register('plateNumber')} />
            </FormField>

            <FormField
                label="Марка/модель"
                required={requiredProps.brand}
                error={errors.brand?.message as string}
            >
                <FormInput {...register('brand')} />
            </FormField>

            <button type="submit">Сохранить</button>
        </form>
    );
};

// ============================================================================
// Пример 8: Создание универсального компонента формы
// ============================================================================

interface UniversalFormProps<T extends z.ZodObject<any>> {
    schema: T;
    onSubmit: (data: z.infer<T>) => void;
    fields: Array<{
        name: keyof z.infer<T>;
        label: string;
        type?: string;
    }>;
}

function UniversalForm<T extends z.ZodObject<any>>({
    schema,
    onSubmit,
    fields
}: UniversalFormProps<T>) {
    const requiredProps = createRequiredProps(schema);

    return (
        <form>
            {fields.map(field => (
                <FormField
                    key={field.name as string}
                    label={field.label}
                    required={requiredProps[field.name as string]}
                >
                    <FormInput
                        name={field.name as string}
                        type={field.type || 'text'}
                    />
                </FormField>
            ))}
            <button type="submit">Отправить</button>
        </form>
    );
}

// Использование универсального компонента
const MyForm = () => (
    <UniversalForm
        schema={vehicleSchema}
        onSubmit={(data) => console.log(data)}
        fields={[
            { name: 'plateNumber', label: 'Гос. номер' },
            { name: 'brand', label: 'Марка/модель' },
            { name: 'year', label: 'Год выпуска', type: 'number' },
        ]}
    />
);

export {
    VehicleFormExample1,
    VehicleFormExample2,
    FuelRatesForm,
    EmployeeForm,
    DynamicForm,
    VehicleFormWithHookForm,
    UniversalForm,
};

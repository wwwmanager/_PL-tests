# Schema Helpers - Утилиты для работы с Zod схемами

## Описание

Набор утилит для автоматического определения обязательных полей из Zod схем валидации. Эти утилиты упрощают работу с формами, автоматизируя процесс применения визуальных индикаторов обязательных полей.

## Установка

Утилиты находятся в файле `utils/schemaHelpers.ts` и готовы к использованию:

```typescript
import {
    isFieldRequired,
    getRequiredFields,
    getRequiredFieldsWithErrors,
    isNestedFieldRequired,
    createRequiredProps,
    getAllFields,
} from './utils/schemaHelpers';
```

## API Reference

### `isFieldRequired(schema, fieldName)`

Определяет, является ли конкретное поле обязательным.

**Параметры:**
- `schema: z.ZodObject<any>` - Zod схема для анализа
- `fieldName: string` - Имя поля для проверки

**Возвращает:** `boolean` - `true` если поле обязательное, `false` в противном случае

**Пример:**
```typescript
const schema = z.object({
    email: z.string().min(1, 'Email обязателен'),
    name: z.string().optional(),
});

isFieldRequired(schema, 'email'); // true
isFieldRequired(schema, 'name');  // false
```

**Логика определения обязательности:**
- Поля с `.optional()` или `.nullable()` → не обязательны
- Поля с `.default()` → не обязательны (имеют значение по умолчанию)
- Строки с `.min(1)` → обязательны
- Числа без `.optional()` → обязательны
- Enum/NativeEnum без `.optional()` → обязательны
- Массивы с `.min(1)` → обязательны

---

### `getRequiredFields(schema)`

Получает список всех обязательных полей из схемы.

**Параметры:**
- `schema: z.ZodObject<any>` - Zod схема для анализа

**Возвращает:** `string[]` - Массив имен обязательных полей

**Пример:**
```typescript
const schema = z.object({
    plateNumber: z.string().min(1),
    brand: z.string().min(1),
    year: z.number().optional(),
    notes: z.string().optional(),
});

getRequiredFields(schema);
// ['plateNumber', 'brand']
```

---

### `getRequiredFieldsWithErrors(schema)`

Получает карту обязательных полей с их сообщениями об ошибках.

**Параметры:**
- `schema: z.ZodObject<any>` - Zod схема для анализа

**Возвращает:** `Record<string, string>` - Объект с именами полей и описаниями ошибок

**Пример:**
```typescript
const schema = z.object({
    email: z.string().min(1, 'Email обязателен'),
    password: z.string().min(8, 'Минимум 8 символов'),
});

getRequiredFieldsWithErrors(schema);
// {
//   email: 'Email обязателен',
//   password: 'Минимум 8 символов'
// }
```

---

### `isNestedFieldRequired(schema, fieldPath)`

Проверяет, является ли вложенное поле обязательным.

**Параметры:**
- `schema: z.ZodObject<any>` - Zod схема для анализа
- `fieldPath: string` - Путь к полю (может быть вложенным, например: `"user.address.city"`)

**Возвращает:** `boolean` - `true` если поле обязательное

**Пример:**
```typescript
const schema = z.object({
    vehicle: z.object({
        fuelRates: z.object({
            summerRate: z.number(),
            winterRate: z.number(),
            cityIncrease: z.number().optional(),
        }),
    }),
});

isNestedFieldRequired(schema, 'vehicle.fuelRates.summerRate');  // true
isNestedFieldRequired(schema, 'vehicle.fuelRates.cityIncrease'); // false
```

---

### `createRequiredProps(schema)`

Создает объект с булевыми значениями `required` для всех полей формы.

**Параметры:**
- `schema: z.ZodObject<any>` - Zod схема для анализа

**Возвращает:** `Record<string, boolean>` - Объект с булевыми значениями для каждого поля

**Пример:**
```typescript
const schema = z.object({
    name: z.string().min(1),
    email: z.string().min(1),
    phone: z.string().optional(),
});

const requiredProps = createRequiredProps(schema);
// {
//   name: true,
//   email: true,
//   phone: false
// }

// Использование в компоненте:
<FormField label="Name" required={requiredProps.name}>
    <FormInput name="name" />
</FormField>
```

---

### `getAllFields(schema)`

Получает список всех полей схемы (включая необязательные).

**Параметры:**
- `schema: z.ZodObject<any>` - Zod схема для анализа

**Возвращает:** `string[]` - Массив имен всех полей

**Пример:**
```typescript
const schema = z.object({
    name: z.string(),
    email: z.string().optional(),
    age: z.number(),
});

getAllFields(schema);
// ['name', 'email', 'age']
```

---

## Примеры использования

### Базовое использование в React компоненте

```typescript
import { FormField, FormInput } from '../components/shared/FormComponents';
import { createRequiredProps } from '../utils/schemaHelpers';

const vehicleSchema = z.object({
    plateNumber: z.string().min(1, 'Гос. номер обязателен'),
    brand: z.string().min(1, 'Марка обязательна'),
    year: z.number().optional(),
});

const VehicleForm: React.FC = () => {
    const requiredProps = createRequiredProps(vehicleSchema);

    return (
        <form>
            <FormField label="Гос. номер" required={requiredProps.plateNumber}>
                <FormInput name="plateNumber" />
            </FormField>
            
            <FormField label="Марка" required={requiredProps.brand}>
                <FormInput name="brand" />
            </FormField>
            
            <FormField label="Год" required={requiredProps.year}>
                <FormInput name="year" type="number" />
            </FormField>
        </form>
    );
};
```

### Работа с вложенными полями

```typescript
const schema = z.object({
    fuelConsumptionRates: z.object({
        summerRate: z.number().positive(),
        winterRate: z.number().positive(),
        cityIncrease: z.number().optional(),
    }),
});

<FormField 
    label="Летняя норма" 
    required={isNestedFieldRequired(schema, 'fuelConsumptionRates.summerRate')}
>
    <FormInput name="fuelConsumptionRates.summerRate" type="number" />
</FormField>
```

### Интеграция с react-hook-form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const VehicleForm: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(vehicleSchema),
    });
    
    const requiredProps = createRequiredProps(vehicleSchema);
    
    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <FormField 
                label="Гос. номер" 
                required={requiredProps.plateNumber}
                error={errors.plateNumber?.message}
            >
                <FormInput {...register('plateNumber')} />
            </FormField>
        </form>
    );
};
```

### Динамическая генерация формы

```typescript
const DynamicForm: React.FC<{ schema: z.ZodObject<any> }> = ({ schema }) => {
    const requiredProps = createRequiredProps(schema);
    const allFields = getAllFields(schema);
    
    return (
        <form>
            {allFields.map(fieldName => (
                <FormField 
                    key={fieldName}
                    label={fieldName}
                    required={requiredProps[fieldName]}
                >
                    <FormInput name={fieldName} />
                </FormField>
            ))}
        </form>
    );
};
```

## Тестирование

Утилиты покрыты полным набором unit-тестов (27 тестов):

```bash
npm test -- schemaHelpers.test.ts
```

Тесты покрывают:
- Все основные функции
- Различные типы Zod схем (string, number, enum, array, nested objects)
- Граничные случаи (optional, nullable, default values)
- Реальные примеры схем из приложения (vehicle, employee)

## Преимущества использования

1. **Автоматизация**: Не нужно вручную указывать `required={true}` для каждого поля
2. **Согласованность**: Обязательность полей определяется из единого источника истины (Zod схемы)
3. **Безопасность типов**: TypeScript обеспечивает типобезопасность
4. **Поддержка вложенных полей**: Работает с любым уровнем вложенности
5. **Легкость обновления**: При изменении схемы формы обновляются автоматически

## Ограничения

1. Работает только с Zod схемами (не поддерживает другие библиотеки валидации)
2. Для строк требуется явное указание `.min(1)` для определения обязательности
3. Не поддерживает условную обязательность полей (зависимость от других полей)

## Дополнительные примеры

Полный набор примеров использования доступен в файле `utils/schemaHelpers.examples.tsx`.

## Поддержка

При возникновении проблем или вопросов:
1. Проверьте, что ваша Zod схема корректно определена
2. Убедитесь, что для строковых полей используется `.min(1)` для обязательности
3. Проверьте тесты в `utils/__tests__/schemaHelpers.test.ts` для примеров использования

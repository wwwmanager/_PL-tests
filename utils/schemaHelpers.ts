import { z } from 'zod';

/**
 * Определяет, является ли поле обязательным на основе Zod схемы
 * @param schema - Zod схема для анализа
 * @param fieldName - Имя поля для проверки
 * @returns true если поле обязательное, false в противном случае
 */
export function isFieldRequired(schema: z.ZodObject<any>, fieldName: string): boolean {
    try {
        const shape = schema.shape;
        const fieldSchema = shape[fieldName];

        if (!fieldSchema) {
            return false;
        }

        // Проверяем, является ли поле optional или nullable
        if (fieldSchema instanceof z.ZodOptional || fieldSchema instanceof z.ZodNullable) {
            return false;
        }

        // Проверяем, есть ли у поля default значение (такие поля не обязательны для пользователя)
        if (fieldSchema instanceof z.ZodDefault) {
            return false;
        }

        // Для строк проверяем наличие .min(1)
        if (fieldSchema instanceof z.ZodString) {
            const checks = (fieldSchema as any)._def.checks || [];
            const hasMinCheck = checks.some((check: any) => check.kind === 'min' && check.value >= 1);
            return hasMinCheck;
        }

        // Для чисел проверяем, что они не optional и не nullable
        if (fieldSchema instanceof z.ZodNumber) {
            return true;
        }

        // Для enum и nativeEnum всегда обязательны, если не optional/nullable
        if (fieldSchema instanceof z.ZodEnum || fieldSchema instanceof z.ZodNativeEnum) {
            return true;
        }

        // Для массивов проверяем наличие .min(1)
        if (fieldSchema instanceof z.ZodArray) {
            // В Zod v3 для массивов minLength находится в _def.minLength, а не в checks
            const minLength = (fieldSchema as any)._def.minLength;
            if (minLength && minLength.value >= 1) {
                return true;
            }
            // Fallback на checks для совместимости
            const checks = (fieldSchema as any)._def.checks || [];
            const hasMinCheck = checks.some((check: any) => check.kind === 'min' && check.value >= 1);
            return hasMinCheck;
        }

        // По умолчанию считаем поле обязательным, если оно не optional/nullable
        return true;
    } catch (error) {
        console.warn(`Error checking if field "${fieldName}" is required:`, error);
        return false;
    }
}

/**
 * Получает список всех обязательных полей из Zod схемы
 * @param schema - Zod схема для анализа
 * @returns Массив имен обязательных полей
 */
export function getRequiredFields(schema: z.ZodObject<any>): string[] {
    try {
        const shape = schema.shape;
        const requiredFields: string[] = [];

        for (const fieldName in shape) {
            if (isFieldRequired(schema, fieldName)) {
                requiredFields.push(fieldName);
            }
        }

        return requiredFields;
    } catch (error) {
        console.warn('Error getting required fields:', error);
        return [];
    }
}

/**
 * Получает карту обязательных полей с их описаниями ошибок
 * @param schema - Zod схема для анализа
 * @returns Объект с именами полей и их описаниями ошибок
 */
export function getRequiredFieldsWithErrors(schema: z.ZodObject<any>): Record<string, string> {
    try {
        const shape = schema.shape;
        const requiredFieldsMap: Record<string, string> = {};

        for (const fieldName in shape) {
            if (isFieldRequired(schema, fieldName)) {
                const fieldSchema = shape[fieldName];

                // Пытаемся получить сообщение об ошибке из схемы
                let errorMessage = `${fieldName} обязателен для заполнения`;

                if (fieldSchema instanceof z.ZodString) {
                    const checks = (fieldSchema as any)._def.checks || [];
                    const minCheck = checks.find((check: any) => check.kind === 'min');
                    if (minCheck && minCheck.message) {
                        errorMessage = minCheck.message;
                    }
                }

                requiredFieldsMap[fieldName] = errorMessage;
            }
        }

        return requiredFieldsMap;
    } catch (error) {
        console.warn('Error getting required fields with errors:', error);
        return {};
    }
}

/**
 * Проверяет, является ли вложенное поле обязательным
 * Поддерживает пути вида "fuelConsumptionRates.summerRate"
 * @param schema - Zod схема для анализа
 * @param fieldPath - Путь к полю (может быть вложенным)
 * @returns true если поле обязательное, false в противном случае
 */
export function isNestedFieldRequired(schema: z.ZodObject<any>, fieldPath: string): boolean {
    try {
        const parts = fieldPath.split('.');
        let currentSchema: any = schema;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (currentSchema instanceof z.ZodObject) {
                const shape = currentSchema.shape;
                currentSchema = shape[part];

                if (!currentSchema) {
                    return false;
                }

                // Если это последняя часть пути, проверяем обязательность
                if (i === parts.length - 1) {
                    // Используем ту же логику, что и в isFieldRequired
                    if (currentSchema instanceof z.ZodOptional || currentSchema instanceof z.ZodNullable) {
                        return false;
                    }
                    if (currentSchema instanceof z.ZodDefault) {
                        return false;
                    }
                    if (currentSchema instanceof z.ZodString) {
                        const checks = (currentSchema as any)._def.checks || [];
                        return checks.some((check: any) => check.kind === 'min' && check.value >= 1);
                    }
                    if (currentSchema instanceof z.ZodNumber) {
                        return true;
                    }
                    if (currentSchema instanceof z.ZodEnum || currentSchema instanceof z.ZodNativeEnum) {
                        return true;
                    }
                    return true;
                }
            } else {
                return false;
            }
        }

        return false;
    } catch (error) {
        console.warn(`Error checking if nested field "${fieldPath}" is required:`, error);
        return false;
    }
}

/**
 * Создает объект с пропсами required для всех полей формы
 * Использование: const requiredProps = createRequiredProps(vehicleSchema);
 * Затем: <FormField required={requiredProps.plateNumber} ... />
 * @param schema - Zod схема для анализа
 * @returns Объект с булевыми значениями для каждого поля
 */
export function createRequiredProps(schema: z.ZodObject<any>): Record<string, boolean> {
    const requiredFields = getRequiredFields(schema);
    const props: Record<string, boolean> = {};

    const shape = schema.shape;
    for (const fieldName in shape) {
        props[fieldName] = requiredFields.includes(fieldName);
    }

    return props;
}

/**
 * Вспомогательная функция для получения всех полей схемы (включая необязательные)
 * @param schema - Zod схема для анализа
 * @returns Массив имен всех полей
 */
export function getAllFields(schema: z.ZodObject<any>): string[] {
    try {
        return Object.keys(schema.shape);
    } catch (error) {
        console.warn('Error getting all fields:', error);
        return [];
    }
}

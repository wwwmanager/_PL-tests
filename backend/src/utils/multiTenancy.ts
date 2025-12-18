/**
 * Multi-tenancy utilities for organization-scoped queries
 * 
 * Обеспечивает изоляцию данных между организациями и подразделениями.
 * Каждый запрос к БД должен автоматически фильтроваться по organizationId.
 */

/**
 * Добавляет organizationId к where-условию
 * 
 * @example
 * ```ts
 * const waybills = await prisma.waybill.findMany({
 *   where: orgScoped(req.user.organizationId, {
 *     status: 'DRAFT',
 *     date: { gte: startDate }
 *   })
 * });
 * ```
 */
export function orgScoped<TWhere extends { organizationId?: string }>(
    organizationId: string,
    where: TWhere = {} as TWhere,
): TWhere & { organizationId: string } {
    return {
        ...where,
        organizationId,
    };
}

/**
 * Добавляет organizationId и departmentId к where-условию
 * 
 * @example
 * ```ts
 * const vehicles = await prisma.vehicle.findMany({
 *   where: deptScoped(req.user.organizationId, req.user.departmentId, {
 *     isActive: true
 *   })
 * });
 * ```
 */
export function deptScoped<TWhere extends { organizationId?: string; departmentId?: string | null }>(
    organizationId: string,
    departmentId: string | null | undefined,
    where: TWhere = {} as TWhere,
): TWhere & { organizationId: string; departmentId: string | null | undefined } {
    return {
        ...where,
        organizationId,
        departmentId,
    };
}

/**
 * Создает where-условие с учетом роли пользователя:
 * - admin: видит все данные организации
 * - обычный пользователь: видит только данные своего подразделения
 * 
 * @example
 * ```ts
 * const waybills = await prisma.waybill.findMany({
 *   where: roleBasedScope(req.user, { status: 'DRAFT' })
 * });
 * ```
 */
export function roleBasedScope<TWhere extends { organizationId?: string; departmentId?: string | null }>(
    user: { organizationId: string; departmentId?: string | null; role?: string },
    where: TWhere = {} as TWhere,
): TWhere & { organizationId: string; departmentId?: string | null } {
    const isAdmin = user.role === 'admin';

    if (isAdmin) {
        // Admin видит все данные организации
        return {
            ...where,
            organizationId: user.organizationId,
        };
    }

    // Обычный пользователь видит только свое подразделение
    return {
        ...where,
        organizationId: user.organizationId,
        departmentId: user.departmentId,
    };
}

/**
 * Проверяет, принадлежит ли запись той же организации, что и пользователь
 * 
 * @throws Error если организации не совпадают
 */
export function assertSameOrganization(
    userOrgId: string,
    recordOrgId: string,
    entityType: string = 'Record'
): void {
    if (userOrgId !== recordOrgId) {
        throw new Error(`Access denied: ${entityType} belongs to different organization`);
    }
}

/**
 * Проверяет, принадлежит ли запись тому же подразделению
 * 
 * @throws Error если подразделения не совпадают
 */
export function assertSameDepartment(
    userDeptId: string | null | undefined,
    recordDeptId: string | null | undefined,
    entityType: string = 'Record'
): void {
    if (userDeptId !== recordDeptId) {
        throw new Error(`Access denied: ${entityType} belongs to different department`);
    }
}

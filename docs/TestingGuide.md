# Руководство по тестированию – Доменные инварианты

## Smoke‑тест
`src/tests/domainInvariantsSmoke.test.ts` – минимальная проверка, что **runDomainInvariants** успешно проходит на небольшом, самодостаточном снимке данных.  При добавлении нового инварианта расширяйте этот тест, добавляя необходимые поля (например, `usedAt` для использованного бланка), чтобы smoke‑тест оставался зелёным.

```ts
import { runDomainInvariants } from '../../services/domain/runDomainInvariants';
import { WaybillStatus } from '../../types';
import type { Waybill, WaybillBlank, GarageStockItem, StockTransaction, Employee, Vehicle } from '../../types';

describe('Domain Invariants Smoke', () => {
  it('runs all domain invariants on a consistent snapshot', () => {
    const employees: Employee[] = [{ id: 'drv1' } as Employee];
    const vehicles: Vehicle[] = [{ id: 'veh1' } as Vehicle];
    const waybills: Waybill[] = [{
      id: 'wb1',
      status: WaybillStatus.POSTED,
      blankId: 'blank1',
      driverId: 'drv1',
      vehicleId: 'veh1',
      odometerStart: 1000,
      odometerEnd: 1100,
      fuelAtStart: 10,
      fuelFilled: 0,
      fuelAtEnd: 10,
    } as Waybill];
    const blanks: WaybillBlank[] = [{
      id: 'blank1',
      status: 'used',
      ownerEmployeeId: 'drv1',
      usedInWaybillId: 'wb1',
      usedAt: '2024-01-01T10:00:00Z',
    } as WaybillBlank];
    const stockItems: GarageStockItem[] = [{ id: 'item1', balance: 0 } as GarageStockItem];
    const stockTransactions: StockTransaction[] = [];

    expect(() =>
      runDomainInvariants({
        waybills,
        blanks,
        employees,
        vehicles,
        stockItems,
        stockTransactions,
      })
    ).not.toThrow();
  });
});
```

## Интеграционный тест Full Scenario
В `services/mockApi.test.ts` заменяем три отдельных вызова `assert*Invariants` на один вызов `runDomainInvariants`.  Это превращает тест *Full Scenario* в **интеграционный маяк** – если нарушается любое правило домена, тест падает с чётким, агрегированным сообщением.

```ts
import { runDomainInvariants } from './domain/runDomainInvariants';

// внутри теста "Full Scenario"
const snapshot = {
  waybills: await getWaybills(),
  blanks: await getWaybillBlanks(),
  employees: await getEmployees(),
  vehicles: await getVehicles(),
  stockItems: await getGarageStockItems(),
  stockTransactions: await getStockTransactions(),
};
runDomainInvariants(snapshot);
```

## Dev‑guard (проверка во время разработки)
Во время локальной разработки (`import.meta.env.DEV === true`) вызываем тот же помощник после каждой мутирующей функции API.  Guard выводит ошибку в консоль, но **не** прерывает запрос, так что вы получаете мгновенную обратную связь, пока вручную играете с UI.

```ts
const IS_DEV = import.meta.env.DEV;
async function runInvariantsDevOnly() {
  if (!IS_DEV) return;
  try {
    const snapshot = {
      waybills: await getWaybills(),
      blanks: await getWaybillBlanks(),
      employees: await getEmployees(),
      vehicles: await getVehicles(),
      stockItems: await getGarageStockItems(),
      stockTransactions: await getStockTransactions(),
    };
    runDomainInvariants(snapshot);
  } catch (e) {
    console.error('Domain invariants violation (DEV only):', e);
  }
}
```

## Диагностический UI
В админ‑панели теперь есть кнопка, которая вызывает лёгкую обёртку `runDomainHealthCheck()` (см. `services/mockApi.ts`).  Функция возвращает `{ ok: true }`, когда всё в порядке, либо `{ ok: false, error: string }` с тем же сообщением, которое вы видите в консоли.

## Как читать падение теста
1. **Найти id** – сообщение всегда начинается с типа сущности и её id (`Blank blank‑123`, `Waybill wb‑7`, `Stock item‑42`).
2. **Прочитать правило** – следующая строка объясняет, какой инвариант нарушен (отсутствует водитель, нет `usedAt`, несоответствие баланса и т.д.).
3. **Исправить данные** – добавить недостающего сотрудника, задать timestamp, скорректировать суммы транзакций, затем перезапустить падающий тест или dev‑guard.

## Как расширять набор тестов
Когда добавляете новый инвариант (например, более строгие проверки расхода топлива, проверка складов по локациям, история статусов бланков) нужно выполнить только четыре шага:
1. Реализовать проверку в соответствующем файле `*Invariants.ts`.
2. Добавить юнит‑тест для нового правила (обычно рядом с другими тестами инвариантов).
3. Обновить **Smoke‑тест**, если новое правило требует дополнительных полей в снимке.
4. Запустить весь набор тестов – тест Full Scenario автоматически покрывает новое правило.

---

*Поддерживайте это руководство в актуальном состоянии – оно является единственным источником правды для всех, кто хочет понять или расширить доменные инварианты.*

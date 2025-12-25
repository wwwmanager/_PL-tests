# P0-C: WB-PREFILL-NEXT-003 - Уже Реализовано

## Статус: ✅ Backend УЖЕ РАБОТАЕТ ПРАВИЛЬНО

Backend функция (строки 1090-1237) уже корректно:

1. **Топливо выезда:** Берётся из `lastWaybill.fuelEnd` (строки 1206-1216)
   - Fallback на tankBalance если есть
   - Fallback на vehicle.currentFuel если нет истории

2. **Ответственные:** Подтягиваются автоматически (строки 1173-1190)
   - dispatcher: Personal → Driver Dept → Vehicle Dept
   - controller: Personal → Driver Dept → Vehicle Dept

## Проблема

Frontend может не вызывать prefill API или не применять результат.

## Как проверить

1. POST ПЛ1 с топливом(возврат)=50л
2. Создать ПЛ2 на том же ТС
3. **Если не работает:**
   - Проверить есть ли вызов prefill API в Network
   - Проверить применяются ли данные в форме

## Нужна помощь?

Если проблема сохраняется - укажите:
- Вызывается ли prefill API?
- Что приходит в ответе?
- Применяется ли в formData?

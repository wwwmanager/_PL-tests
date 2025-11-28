# Backend Setup Script
# Запустите этот скрипт в PowerShell из папки backend/

Write-Host "🚀 Backend Setup Script" -ForegroundColor Cyan
Write-Host "=" * 50

# Шаг 1: Создание .env файла
Write-Host "`n📝 Шаг 1: Создание .env файла..." -ForegroundColor Yellow

$envContent = @"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/waybills?schema=public"
PORT=3000
JWT_SECRET="dev_secret_key_change_in_production_12345678"
JWT_EXPIRES_IN="15m"
NODE_ENV="development"
"@

$envContent | Out-File -FilePath ".env" -Encoding ASCII -NoNewline
Write-Host "✅ .env файл создан" -ForegroundColor Green

# Проверка содержимого
Write-Host "`nСодержимое .env:" -ForegroundColor Cyan
Get-Content .env
Write-Host ""

# Шаг 2: Генерация Prisma Client
Write-Host "`n📝 Шаг 2: Генерация Prisma Client..." -ForegroundColor Yellow
npm run prisma:generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при генерации Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client сгенерирован" -ForegroundColor Green

# Шаг 3: Применение миграций
Write-Host "`n📝 Шаг 3: Применение миграций..." -ForegroundColor Yellow
Write-Host "⚠️  Убедитесь, что база данных 'waybills' создана в PostgreSQL!" -ForegroundColor Yellow
Write-Host "   Если нет, создайте ее вручную через pgAdmin или psql" -ForegroundColor Yellow
Write-Host ""

$continue = Read-Host "База данных 'waybills' создана? (y/n)"
if ($continue -ne 'y') {
    Write-Host "❌ Создайте базу данных 'waybills' и запустите скрипт заново" -ForegroundColor Red
    exit 1
}

npm run prisma:migrate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при применении миграций" -ForegroundColor Red
    Write-Host "   Проверьте:" -ForegroundColor Yellow
    Write-Host "   1. База данных 'waybills' создана" -ForegroundColor Yellow
    Write-Host "   2. PostgreSQL запущен (Get-Service PostgreSQL)" -ForegroundColor Yellow
    Write-Host "   3. Правильные credentials в DATABASE_URL" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Миграции применены" -ForegroundColor Green

# Шаг 4: Seed данные
Write-Host "`n📝 Шаг 4: Заполнение тестовыми данными..." -ForegroundColor Yellow
npm run prisma:seed

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при заполнении данными" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Тестовые данные загружены" -ForegroundColor Green

# Итог
Write-Host "`n" + ("=" * 50) -ForegroundColor Cyan
Write-Host "🎉 Setup завершен успешно!" -ForegroundColor Green
Write-Host "`nТестовые пользователи:" -ForegroundColor Cyan
Write-Host "  📧 admin@test.ru / admin123 (роль: admin)" -ForegroundColor White
Write-Host "  📧 dispatcher@test.ru / dispatcher123 (роль: dispatcher)" -ForegroundColor White
Write-Host "`nЗапустите backend:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host "`nПроверьте health check:" -ForegroundColor Cyan
Write-Host "  curl http://localhost:3000/api/health" -ForegroundColor White
Write-Host ""

# Инструкция по развертыванию на GitHub Pages

## Исправленные проблемы

✅ **1. Исправлен base path в vite.config.ts**
- Было: `base: '/PL/'`
- Стало: `base: '/_PL-tests/'`
- Теперь соответствует имени репозитория

✅ **2. Удален TailwindCSS CDN из index.html**
- Проект использует Vanilla CSS, а не TailwindCSS
- Убрано предупреждение о production использовании CDN

## Способ 1: Автоматический deploy через GitHub Actions (Рекомендуется)

### Шаг 1: Создайте файл `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Шаг 2: Настройте GitHub Pages

1. Перейдите в Settings → Pages
2. Source: выберите "GitHub Actions"
3. Сохраните

### Шаг 3: Push изменения

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions workflow for deployment"
git push origin main
```

После push GitHub Actions автоматически соберет и задеплоит приложение.

## Способ 2: Ручной deploy через gh-pages ветку

### Шаг 1: Установите gh-pages

```bash
npm install --save-dev gh-pages
```

### Шаг 2: Добавьте скрипт в package.json

```json
{
  "scripts": {
    "deploy": "npm run build && gh-pages -d dist"
  }
}
```

### Шаг 3: Deploy

```bash
npm run deploy
```

### Шаг 4: Настройте GitHub Pages

1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: `gh-pages` → folder: `/ (root)`
4. Save

## Способ 3: Ручной deploy (без дополнительных пакетов)

```bash
# 1. Соберите проект
npm run build

# 2. Перейдите в папку dist
cd dist

# 3. Инициализируйте git
git init
git add -A
git commit -m "Deploy"

# 4. Push в gh-pages ветку
git push -f https://github.com/wwwmanager/_PL-tests.git main:gh-pages

# 5. Вернитесь в корень проекта
cd ..
```

## Проверка deployment

После успешного deploy приложение будет доступно по адресу:
**https://wwwmanager.github.io/_PL-tests/**

## Troubleshooting

### Проблема: 404 ошибки при загрузке assets

**Решение:** Убедитесь, что `base` в `vite.config.ts` соответствует имени репозитория:
```typescript
base: '/_PL-tests/',
```

### Проблема: Blank page после deploy

**Решение:** 
1. Проверьте консоль браузера на ошибки
2. Убедитесь, что build прошел успешно: `npm run build`
3. Проверьте, что все пути в `index.html` относительные

### Проблема: TailwindCSS warning

**Решение:** Уже исправлено - TailwindCSS CDN удален из `index.html`

## Текущий статус

✅ Все тесты проходят (109/109)
✅ Build успешен
✅ Base path исправлен
✅ TailwindCSS CDN удален
✅ Готово к deployment

## Следующие шаги

1. Выберите способ deployment (рекомендуется Способ 1)
2. Настройте GitHub Pages
3. Push изменения
4. Проверьте работу приложения по адресу https://wwwmanager.github.io/_PL-tests/

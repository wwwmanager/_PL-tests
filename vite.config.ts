import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';
import { readFileSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  // Базовый URL для развертывания на GitHub Pages.
  // Закомментировано для локальной разработки. Раскомментируйте для продакшн деплоя на GitHub Pages.
  // base: '/_PL-tests/',

  // --- Плагины ---
  plugins: [
    react(),
    // Плагин для импорта .md файлов как строк
    {
      name: 'vite-plugin-md-raw',
      transform(code, id) {
        if (id.endsWith('.md?raw')) {
          // Убираем ?raw из пути к файлу
          const filePath = id.replace(/\?raw$/, '');
          // Читаем содержимое файла
          const content = readFileSync(filePath, 'utf-8');
          return {
            code: `export default ${JSON.stringify(content)}`,
            map: null,
          };
        }
      },
    },
  ],

  // --- Настройки сервера разработки ---
  server: {
    port: 3000,
    open: true,
    host: true,
  },

  // --- Path Aliases ---
  resolve: {
    alias: {
      '@/': fileURLToPath(new URL('./', import.meta.url)),
    },
  },

  // --- Настройки сборки ---
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'markdown-vendor': ['react-markdown', 'remark-gfm'],
        },
      },
    },
  },

  // --- Оптимизация зависимостей ---
  optimizeDeps: {
    include: ['react-markdown', 'remark-gfm'],
  },
});

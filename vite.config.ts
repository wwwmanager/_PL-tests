import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

// https://vitejs.dev/config/
export default defineConfig({
  // Базовый URL для развертывания на GitHub Pages.
  // Имя репозитория: _PL-tests
  base: '/_PL-tests/',

  // --- Плагины ---
  plugins: [
    // Основной плагин для поддержки React
    // Обеспечивает HMR (Hot Module Replacement) и преобразование JSX/TSX
    react(),
    // Плагин для импорта .md файлов как строк
    {
      name: 'vite-plugin-md-raw',
      transform(code, id) {
        if (id.endsWith('.md?raw')) {
          const content = code;
          return {
            code: `export default ${JSON.stringify(content)}`,
            map: null,
          };
        }
      },
    },
  ],

  // --- Настройки сервера разработки (npm run dev) ---
  server: {
    port: 3000,       // Указываем порт (по умолчанию 5173, но 3000 привычнее)
    open: true,         // Автоматически открывать браузер при запуске
    host: true,         // (Опционально) Делает сервер доступным по вашему IP в локальной сети
  },

  // --- Настройка абсолютных импортов (Path Aliases) ---
  // Позволяет использовать импорты вида: import App from '@/App'
  resolve: {
    alias: {
      // Настраиваем алиас '@/' чтобы он указывал на корень проекта
      // FIX: `__dirname` is not available in ES modules. Using `import.meta.url` is the modern and correct way.
      '@/': fileURLToPath(new URL('./', import.meta.url)),
    },
  },

  // --- Настройки сборки (npm run build) ---
  build: {
    outDir: 'dist',
    sourcemap: false,    // Отключено для production (уменьшает размер бандла)

    // Увеличиваем лимит для предупреждения о размере чанка
    chunkSizeWarningLimit: 1000,

    // Настройки минификации
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Удаляем console.log в production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },

    // Оптимальное разделение кода
    rollupOptions: {
      output: {
        // Разделяем vendor-библиотеки для лучшего кеширования
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom'],

          // Forms и validation
          'forms-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],

          // UI библиотеки
          'ui-vendor': ['recharts', 'localforage'],

          // Google AI (большой модуль)
          'ai-vendor': ['@google/generative-ai'],

          // Парсинг
          'parser-vendor': ['cheerio'],
        },

        // Оптимизация имён чанков
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },

  // Оптимизация для development
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-hook-form',
      'zod',
      'localforage',
    ],
  },
});

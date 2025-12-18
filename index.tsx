
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initSentry } from './sentry.config';
import App from './App';

// Initialize Sentry BEFORE React
initSentry();

// 🔍 ENV DIAGNOSTIC
console.log('='.repeat(60));
console.log('🔍 VITE Environment Variables Diagnostic');
console.log('='.repeat(60));
console.log('VITE_API_URL =', import.meta.env.VITE_API_URL);
console.log('VITE_USE_REAL_API =', import.meta.env.VITE_USE_REAL_API);
console.log('MODE =', import.meta.env.MODE);
console.log('DEV =', import.meta.env.DEV);
console.log('PROD =', import.meta.env.PROD);
console.log('='.repeat(60));


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
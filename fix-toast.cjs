const fs = require('fs');
const content = fs.readFileSync('App.tsx', 'utf8');
const fixed = content.replace(
  import { ToastProvider } from './components/common/Toast';,
  import { ToastProvider } from './contexts/ToastContext';
);
fs.writeFileSync('App.tsx', fixed, 'utf8');
console.log('✅ Fixed Toast import in App.tsx');

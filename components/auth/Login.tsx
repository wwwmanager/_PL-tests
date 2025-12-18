// components/auth/Login.tsx
import React, { useState } from 'react';
import { useAuth } from '../../services/auth';
import { useToast } from '../../hooks/useToast';

const Login: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('admin'); // для удобства dev
  const [password, setPassword] = useState('123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Backend supports login by email OR fullName (username)
      // Do not transform - send as-is
      await login(email, password);
      showToast?.('Успешный вход', 'success');
      // После успешного логина AppContent сам перерисуется (currentUser заполнится)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка входа';
      setError(msg);
      showToast?.(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md space-y-4"
      >
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
          Вход в систему
        </h1>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div>
          <label className="block text-sm mb-1 text-gray-700 dark:text-gray-200">
            Email
          </label>
          <input
            data-testid="login-email"
            type="text"
            className="w-full border rounded p-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700 dark:text-gray-200">
            Пароль
          </label>
          <input
            data-testid="login-password"
            type="password"
            className="w-full border rounded p-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          data-testid="login-submit"
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Для теста можно использовать admin@example.com / password (если так
          настроен backend).
        </p>
      </form>
    </div>
  );
};

export default Login;

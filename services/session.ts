/**
 * AUTH-002: Session Management
 * 
 * Handles session expiry events and provides unified logout/redirect behavior.
 * Used by httpClient when refresh token fails.
 */

type SessionExpiredReason =
    | 'token_expired'      // Access token expired and refresh failed
    | 'token_revoked'      // Refresh token was revoked (e.g., after org transfer)
    | 'logout_all'         // User initiated logout everywhere
    | 'user_logout'        // User initiated logout
    | 'user_inactive';     // User account deactivated

type SessionExpiredHandler = (reason: SessionExpiredReason) => void;

// Singleton handler - set by React app on mount
let sessionExpiredHandler: SessionExpiredHandler | null = null;

/**
 * Register the session expired handler (called once from App.tsx or AuthProvider)
 */
export function setSessionExpiredHandler(handler: SessionExpiredHandler) {
    sessionExpiredHandler = handler;
}

/**
 * Trigger session expired event (called from httpClient when refresh fails)
 */
export function onSessionExpired(reason: SessionExpiredReason = 'token_expired') {
    console.warn(`🔐 [Session] Session expired: ${reason}`);

    // Clear any stored tokens
    localStorage.removeItem('__auth_token__');
    localStorage.removeItem('__current_user__');

    if (sessionExpiredHandler) {
        sessionExpiredHandler(reason);
    } else {
        // Fallback: redirect to login if no handler registered
        console.warn('🔐 [Session] No handler registered, redirecting to /login');
        window.location.href = '/login';
    }
}

/**
 * Get user-friendly message for session expiry reason
 */
export function getSessionExpiredMessage(reason: SessionExpiredReason): string {
    switch (reason) {
        case 'token_revoked':
            return 'Ваш доступ был изменён администратором. Войдите снова.';
        case 'logout_all':
            return 'Вы вышли со всех устройств. Войдите снова.';
        case 'user_inactive':
            return 'Ваша учётная запись деактивирована.';
        case 'user_logout':
            return 'Вы вышли из системы.';
        case 'token_expired':
        default:
            return 'Сессия истекла. Войдите снова.';
    }
}

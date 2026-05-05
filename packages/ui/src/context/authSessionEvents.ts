export const AUTH_SESSION_INVALID_EVENT = 'kletron:auth-session-invalid';

export function dispatchAuthSessionInvalid(): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new Event(AUTH_SESSION_INVALID_EVENT));
}

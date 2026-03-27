import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthState, LoginSession } from "../types";
import {
  AUTH_STORAGE_KEY,
  AUTH_LOGIN_TIMEOUT_MS,
  generateCodeVerifier,
  createCodeChallenge,
  isValidHttpUrl,
} from "../utils";

function loadAuth(): AuthState | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

function saveAuth(auth: AuthState | null) {
  if (!auth) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function useAuth(backendUrlTrimmed: string, backendUrlValid: boolean) {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [loginSession, setLoginSession] = useState<LoginSession | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);

  // Refs for stable access in callbacks
  const authRef = useRef(auth);
  authRef.current = auth;
  const backendUrlRef = useRef(backendUrlTrimmed);
  backendUrlRef.current = backendUrlTrimmed;

  // Deduplicate concurrent token refreshes
  const refreshPromiseRef = useRef<Promise<AuthState | null> | null>(null);

  // Track which access token we already loaded the user for
  const userLoadedTokenRef = useRef<string | null>(null);

  // Refresh tokens (deduplicates concurrent calls)
  const refreshTokens = useCallback(async (): Promise<AuthState | null> => {
    // Return in-flight promise to avoid concurrent refreshes
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const current = authRef.current;
    if (!current?.refreshToken) return null;

    const promise = (async (): Promise<AuthState | null> => {
      try {
        const res = await fetch(`${backendUrlRef.current}/api/auth/ide-refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        const data = await res.json();
        if (!data?.success) return null;
        const updated: AuthState = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          user: data.user || current.user,
        };
        setAuth(updated);
        saveAuth(updated);
        return updated;
      } catch {
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = authRef.current;
    if (!current) return null;
    const shouldRefresh = Date.now() > current.expiresAt - 60_000;
    if (!shouldRefresh) return current.accessToken;
    const refreshed = await refreshTokens();
    return refreshed?.accessToken ?? null;
  }, [refreshTokens]);

  // Load user profile once per access token
  useEffect(() => {
    if (!auth?.accessToken) return;
    // Skip if we already loaded for this token
    if (userLoadedTokenRef.current === auth.accessToken) return;
    userLoadedTokenRef.current = auth.accessToken;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${backendUrlTrimmed}/api/auth/me`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const newUser = data.user ?? null;
          const currentAuth = authRef.current;
          // Only update state if user data actually changed
          if (currentAuth && JSON.stringify(newUser) !== JSON.stringify(currentAuth.user)) {
            const updated = { ...currentAuth, user: newUser };
            setAuth(updated);
            saveAuth(updated);
          }
        }
      } catch {
        // Allow retry on network error
        if (!cancelled) userLoadedTokenRef.current = null;
      }
    })();

    return () => { cancelled = true; };
  }, [auth?.accessToken, backendUrlTrimmed]);

  // Clear login pending when auth arrives
  useEffect(() => {
    if (auth?.accessToken) {
      setLoginPending(false);
      setLoginSession(null);
    }
  }, [auth?.accessToken]);

  // Deep link handler
  useEffect(() => {
    const unsubscribe = window.kletron.onAuthLink((url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "kletron:") return;
        if (parsed.hostname !== "kletron.auth") return;
        const accessToken = parsed.searchParams.get("accessToken");
        const refreshToken = parsed.searchParams.get("refreshToken");
        const expiresAt = Number(parsed.searchParams.get("expiresAt") || 0);
        const userId = parsed.searchParams.get("userId") || "";
        const email = parsed.searchParams.get("email") || "";
        const fullName = parsed.searchParams.get("fullName") || null;

        if (!accessToken || !refreshToken || !expiresAt) return;

        const newAuth: AuthState = {
          accessToken,
          refreshToken,
          expiresAt,
          user: userId && email ? { id: userId, email, fullName } : null,
        };
        setAuth(newAuth);
        saveAuth(newAuth);
        setLoginPending(false);
        setLoginSession(null);
        setLoginError(null);
      } catch {
        // ignore invalid deep links
      }
    });
    return () => unsubscribe();
  }, []);

  // Login polling
  useEffect(() => {
    if (!loginSession) return;
    const interval = setInterval(async () => {
      if (Date.now() - loginSession.startedAt > AUTH_LOGIN_TIMEOUT_MS) {
        setLoginError("Sign-in expired. Please try again.");
        setLoginPending(false);
        setLoginSession(null);
        return;
      }
      try {
        const url = new URL(`${backendUrlTrimmed}/api/auth/ide-session`);
        url.searchParams.set("deviceSessionId", loginSession.deviceSessionId);
        url.searchParams.set("code_verifier", loginSession.codeVerifier);
        const res = await fetch(url.toString());
        const data = await res.json();
        if (data?.success && data.accessToken) {
          const newAuth: AuthState = {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            user: data.user || null,
          };
          setAuth(newAuth);
          saveAuth(newAuth);
          setLoginPending(false);
          setLoginSession(null);
          setLoginError(null);
        } else if (data?.error && !data?.pending) {
          setLoginError(data.error);
          setLoginPending(false);
          setLoginSession(null);
        }
      } catch {
        // ignore polling failures
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loginSession, backendUrlTrimmed]);

  async function startWebLogin() {
    if (!backendUrlValid) {
      setLoginError("Enter a valid Backend URL first.");
      return;
    }
    setLoginError(null);
    setLoginPending(true);

    const deviceSessionId = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);

    try {
      await fetch(`${backendUrlTrimmed}/api/auth/ide-session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceSessionId, codeChallenge }),
      });
    } catch {
      setLoginError("Failed to initialize login session.");
      setLoginPending(false);
      return;
    }

    setLoginSession({ deviceSessionId, codeVerifier, startedAt: Date.now() });

    const params = new URLSearchParams({
      redirect: "ide",
      deviceSessionId,
      code_challenge: codeChallenge,
    });
    const loginUrl = `${backendUrlTrimmed}/auth/login?${params.toString()}`;
    const opened = await window.kletron.openExternal(loginUrl);
    if (!opened) {
      setLoginError("Unable to open browser. Open the portal manually to sign in.");
    }
  }

  async function startWebRegister() {
    if (!backendUrlValid) {
      setLoginError("Enter a valid Backend URL first.");
      return;
    }
    setLoginError(null);
    setLoginPending(true);

    const deviceSessionId = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);

    try {
      await fetch(`${backendUrlTrimmed}/api/auth/ide-session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceSessionId, codeChallenge }),
      });
    } catch {
      setLoginError("Failed to initialize registration session.");
      setLoginPending(false);
      return;
    }

    setLoginSession({ deviceSessionId, codeVerifier, startedAt: Date.now() });

    const params = new URLSearchParams({
      redirect: "ide",
      deviceSessionId,
      code_challenge: codeChallenge,
    });
    const registerUrl = `${backendUrlTrimmed}/auth/register?${params.toString()}`;
    const opened = await window.kletron.openExternal(registerUrl);
    if (!opened) {
      setLoginError("Unable to open browser. Open the portal manually to register.");
    }
  }

  function signOut() {
    setAuth(null);
    saveAuth(null);
    setLoginSession(null);
    setLoginPending(false);
  }

  return {
    auth,
    loginPending,
    loginError,
    getAccessToken,
    startWebLogin,
    startWebRegister,
    signOut,
  };
}

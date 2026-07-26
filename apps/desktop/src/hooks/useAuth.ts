import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthState, LoginSession, SessionStatus } from "../types";
import {
  AUTH_STORAGE_KEY,
  AUTH_LOGIN_TIMEOUT_MS,
  generateCodeVerifier,
  createCodeChallenge,
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

/** Why the session ended — drives `expired` vs plain `signed-out` in the gate copy. */
type SessionEndedReason = "expired" | "manual";

type RefreshResult =
  | { ok: true; auth: AuthState }
  /** `network`: keep the tokens, we simply could not reach the server. */
  | { ok: false; reason: "network" | "rejected" | "no-token" };

export function useAuth(backendUrlTrimmed: string, backendUrlValid: boolean) {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [loginSession, setLoginSession] = useState<LoginSession | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** Backend unreachable while we still hold tokens → `offline`, never `signed-out`. */
  const [networkError, setNetworkError] = useState(false);
  const [endedReason, setEndedReason] = useState<SessionEndedReason | null>(null);

  // Refs for stable access in callbacks
  const authRef = useRef(auth);
  authRef.current = auth;
  const backendUrlRef = useRef(backendUrlTrimmed);
  backendUrlRef.current = backendUrlTrimmed;

  // Deduplicate concurrent token refreshes
  const refreshPromiseRef = useRef<Promise<RefreshResult> | null>(null);

  // Track which access token we already validated the user for
  const userLoadedTokenRef = useRef<string | null>(null);

  /** Server rejected our tokens: purge them so the shell locks instead of silently 401-ing. */
  const markExpired = useCallback(() => {
    userLoadedTokenRef.current = null;
    setAuth(null);
    saveAuth(null);
    setLoginSession(null);
    setLoginPending(false);
    setNetworkError(false);
    setEndedReason("expired");
  }, []);

  // Refresh tokens (deduplicates concurrent calls)
  const runRefresh = useCallback(async (): Promise<RefreshResult> => {
    // Return in-flight promise to avoid concurrent refreshes
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const current = authRef.current;
    if (!current?.refreshToken) return { ok: false, reason: "no-token" };

    const promise = (async (): Promise<RefreshResult> => {
      setRefreshing(true);
      try {
        const res = await fetch(`${backendUrlRef.current}/api/auth/ide-refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        const data = await res.json().catch(() => null);
        if (!data?.success) {
          // The server refused the refresh token — the session is really over.
          markExpired();
          return { ok: false, reason: "rejected" };
        }
        const updated: AuthState = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          user: data.user || current.user,
        };
        setAuth(updated);
        saveAuth(updated);
        setNetworkError(false);
        setEndedReason(null);
        return { ok: true, auth: updated };
      } catch {
        // Offline / wrong URL: the tokens may still be perfectly valid, keep them.
        setNetworkError(true);
        return { ok: false, reason: "network" };
      } finally {
        setRefreshing(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, [markExpired]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = authRef.current;
    if (!current) return null;
    const shouldRefresh = Date.now() > current.expiresAt - 60_000;
    if (!shouldRefresh) return current.accessToken;
    const refreshed = await runRefresh();
    return refreshed.ok ? refreshed.auth.accessToken : null;
  }, [runRefresh]);

  /**
   * A guarded request came back 401. Try one refresh: if it succeeds the 401 was about
   * something else (workspace scope, …) and the session stays; if the server refuses,
   * `runRefresh` has already locked the app.
   *
   * Throttled, because an endpoint that 401s for non-auth reasons is often polled and
   * must not turn into a refresh storm.
   */
  const lastUnauthorizedRefreshRef = useRef(0);
  const handleUnauthorized = useCallback(async () => {
    if (!authRef.current) return;
    const now = Date.now();
    if (now - lastUnauthorizedRefreshRef.current < 10_000) return;
    lastUnauthorizedRefreshRef.current = now;
    const result = await runRefresh();
    if (!result.ok && result.reason === "no-token") markExpired();
  }, [runRefresh, markExpired]);

  /** Fire-and-forget form for callers that cannot await (guarded fetch wrappers). */
  const notifyUnauthorized = useCallback(() => {
    void handleUnauthorized();
  }, [handleUnauthorized]);

  const fetchMe = useCallback(
    async (token: string): Promise<"ok" | "unauthorized" | "network-error" | "server-error"> => {
      try {
        const res = await fetch(`${backendUrlRef.current}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) return "unauthorized";
        if (!res.ok) return "server-error";
        const data = await res.json().catch(() => null);
        const newUser = data?.user ?? null;
        const currentAuth = authRef.current;
        // Only update state if user data actually changed
        if (currentAuth && JSON.stringify(newUser) !== JSON.stringify(currentAuth.user)) {
          const updated = { ...currentAuth, user: newUser };
          setAuth(updated);
          saveAuth(updated);
        }
        setNetworkError(false);
        setEndedReason(null);
        return "ok";
      } catch {
        return "network-error";
      }
    },
    []
  );

  /**
   * Confirm the stored tokens still map to a live session. Goes through `getAccessToken`
   * first so a token that merely expired while the app was closed is refreshed rather
   * than mistaken for a revoked session.
   */
  const revalidate = useCallback(async () => {
    if (!authRef.current) return;
    const token = await getAccessToken();
    if (!token) return; // refresh already resolved the outcome (expired / offline)
    const result = await fetchMe(token);
    if (result === "unauthorized") {
      await handleUnauthorized();
    } else if (result === "network-error") {
      setNetworkError(true);
    }
  }, [getAccessToken, fetchMe, handleUnauthorized]);

  // Validate the session once per (backend, access token) pair — covers cold start, and
  // re-checks when the user points the app at a different server.
  useEffect(() => {
    if (!auth?.accessToken) return;
    const key = `${backendUrlTrimmed}::${auth.accessToken}`;
    if (userLoadedTokenRef.current === key) return;
    userLoadedTokenRef.current = key;
    void revalidate();
  }, [auth?.accessToken, backendUrlTrimmed, revalidate]);

  // Re-validate when the window regains focus — mirrors the web AuthContext, so a session
  // revoked elsewhere locks this window instead of failing request by request.
  useEffect(() => {
    if (!auth?.accessToken) return;
    const onFocus = () => void revalidate();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void revalidate();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [auth?.accessToken, revalidate]);

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
        setNetworkError(false);
        setEndedReason(null);
      } catch {
        // ignore invalid deep links
      }
    });
    return () => unsubscribe();
  }, []);

  // Login polling
  useEffect(() => {
    if (!loginSession) return;
    const interval = setInterval(() => {
      void (async () => {
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
            setNetworkError(false);
            setEndedReason(null);
          } else if (data?.error && !data?.pending) {
            setLoginError(data.error);
            setLoginPending(false);
            setLoginSession(null);
          }
        } catch {
          // ignore polling failures
        }
      })();
    }, 3000);
    return () => clearInterval(interval);
  }, [loginSession, backendUrlTrimmed]);

  async function putIdeSessionInit(
    deviceSessionId: string,
    codeChallenge: string,
    networkErrorLabel: string
  ): Promise<boolean> {
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/auth/ide-session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceSessionId, codeChallenge }),
      });
      let data: { error?: string } = {};
      try {
        data = (await res.json()) as { error?: string };
      } catch {
        /* non-JSON body */
      }
      if (!res.ok) {
        const detail =
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : `Server error (${res.status}). Check Backend URL and that the portal is running.`;
        setLoginError(detail);
        setLoginPending(false);
        return false;
      }
      return true;
    } catch (e) {
      const message =
        e instanceof TypeError
          ? "Cannot reach backend (offline, wrong URL, or blocked). Check the Backend URL and network."
          : networkErrorLabel;
      setLoginError(message);
      setLoginPending(false);
      return false;
    }
  }

  async function startWebLogin() {
    if (!backendUrlValid) {
      setLoginError("Enter a valid Backend URL first.");
      return;
    }
    setLoginError(null);
    setEndedReason(null);
    setLoginPending(true);

    const deviceSessionId = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);

    const ok = await putIdeSessionInit(
      deviceSessionId,
      codeChallenge,
      "Failed to initialize login session."
    );
    if (!ok) return;

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
    setEndedReason(null);
    setLoginPending(true);

    const deviceSessionId = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);

    const ok = await putIdeSessionInit(
      deviceSessionId,
      codeChallenge,
      "Failed to initialize registration session."
    );
    if (!ok) return;

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

  /** Give up on a browser sign-in that never came back. */
  function cancelLogin() {
    setLoginSession(null);
    setLoginPending(false);
    setLoginError(null);
  }

  function signOut() {
    userLoadedTokenRef.current = null;
    setAuth(null);
    saveAuth(null);
    setLoginSession(null);
    setLoginPending(false);
    setLoginError(null);
    setNetworkError(false);
    setEndedReason("manual");
  }

  const sessionStatus: SessionStatus = useMemo(() => {
    if (!backendUrlValid) return "unconfigured";
    if (!auth?.accessToken) {
      if (loginPending) return "signing-in";
      return endedReason === "expired" ? "expired" : "signed-out";
    }
    if (networkError) return "offline";
    if (refreshing) return "refreshing";
    return "active";
  }, [backendUrlValid, auth?.accessToken, loginPending, endedReason, networkError, refreshing]);

  return {
    auth,
    sessionStatus,
    loginPending,
    loginError,
    getAccessToken,
    notifyUnauthorized,
    revalidate,
    startWebLogin,
    startWebRegister,
    cancelLogin,
    signOut,
  };
}

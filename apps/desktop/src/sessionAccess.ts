import type { SessionStatus } from "./types";

/**
 * Which session states may render the app shell.
 *
 * Desktop counterpart of the web middleware refusing `/app/*`: everything else falls
 * through to `DesktopAuthGate`, so there is one choke point instead of a per-view check.
 *
 * `offline` and `refreshing` DO unlock: we still hold tokens the server has not rejected,
 * so a wifi blip or a token rollover must not throw the user out of a running thread —
 * the title-bar chip reports those states instead. Only a session the server refused
 * (`expired`), an absent one (`signed-out`, `signing-in`) or a missing backend
 * (`unconfigured`) locks the app.
 */
export function isSessionUnlocked(status: SessionStatus): boolean {
  return status === "active" || status === "refreshing" || status === "offline";
}

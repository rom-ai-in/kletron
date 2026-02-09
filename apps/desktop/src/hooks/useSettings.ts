import { useEffect, useState } from "react";
import type { ActiveView, SettingsSectionId, SettingsToggles } from "../types";
import {
  BACKEND_STORAGE_KEY,
  DEFAULT_BACKEND_URL,
  DEV_BACKEND_URL,
  getDefaultBackendUrl,
  isValidHttpUrl,
  normalizeBackendUrl,
} from "../utils";

export function useSettings() {
  const [activeView, setActiveView] = useState<ActiveView>("app");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("general");
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    const stored = localStorage.getItem(BACKEND_STORAGE_KEY);
    if (stored) {
      try {
        const env = (import.meta as any)?.env;
        if (env?.DEV && stored === DEFAULT_BACKEND_URL) {
          return DEV_BACKEND_URL;
        }
      } catch {
        // ignore
      }
      return stored;
    }
    return getDefaultBackendUrl();
  });
  const [backendConnected, setBackendConnected] = useState(false);
  const [settingsToggles, setSettingsToggles] = useState<SettingsToggles>({
    preventSleep: true,
    requireCmdEnter: true,
    compactDensity: false,
    opaqueBackground: false,
    pointerCursor: true,
    completionNotifications: true,
    permissionNotifications: false,
  });

  const backendUrlTrimmed = normalizeBackendUrl(backendUrl);
  const backendUrlValid = isValidHttpUrl(backendUrlTrimmed);

  useEffect(() => {
    localStorage.setItem(BACKEND_STORAGE_KEY, backendUrlTrimmed);
  }, [backendUrlTrimmed]);

  return {
    activeView,
    setActiveView,
    activeSettingsSection,
    setActiveSettingsSection,
    backendUrl,
    setBackendUrl,
    backendUrlTrimmed,
    backendUrlValid,
    backendConnected,
    setBackendConnected,
    settingsToggles,
    setSettingsToggles,
  };
}

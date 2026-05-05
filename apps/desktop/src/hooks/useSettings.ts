import { useEffect, useState } from "react";
import type { ActiveView, SettingsSectionId, SettingsToggles } from "../types";
import {
  BACKEND_STORAGE_KEY,
  DEFAULT_BACKEND_URL,
  DEV_BACKEND_URL,
  getDefaultBackendUrl,
  isValidHttpUrl,
  normalizeBackendUrl,
  SETTINGS_TOGGLES_STORAGE_KEY,
} from "../utils";

const DEFAULT_SETTINGS_TOGGLES: SettingsToggles = {
  preventSleep: true,
  compactDensity: false,
  opaqueBackground: false,
  pointerCursor: true,
  completionNotifications: true,
  permissionNotifications: false,
};

function loadStoredSettingsToggles(): SettingsToggles {
  try {
    const raw = localStorage.getItem(SETTINGS_TOGGLES_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS_TOGGLES;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const { requireCmdEnter: _legacyRequireCmdEnter, ...rest } = parsed;
    return { ...DEFAULT_SETTINGS_TOGGLES, ...(rest as Partial<SettingsToggles>) };
  } catch {
    return DEFAULT_SETTINGS_TOGGLES;
  }
}

export function useSettings() {
  const [activeView, setActiveView] = useState<ActiveView>("app");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("configuration");
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
  const [settingsToggles, setSettingsToggles] = useState<SettingsToggles>(loadStoredSettingsToggles);

  const backendUrlTrimmed = normalizeBackendUrl(backendUrl);
  const backendUrlValid = isValidHttpUrl(backendUrlTrimmed);

  useEffect(() => {
    localStorage.setItem(BACKEND_STORAGE_KEY, backendUrlTrimmed);
  }, [backendUrlTrimmed]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_TOGGLES_STORAGE_KEY, JSON.stringify(settingsToggles));
    } catch {
      /* ignore quota / private mode */
    }
  }, [settingsToggles]);

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

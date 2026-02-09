import { useState, useEffect } from "react";
import type { PersonalityMode } from "../types";

const PERSONALITY_STORAGE_KEY = "numezis.desktop.personality";

const PERSONALITY_PROMPTS: Record<PersonalityMode, string> = {
  pragmatic:
    "Be terse and execution-focused. Provide concise responses with minimal commentary. Focus on results and direct answers.",
  empathetic:
    "Be conversational and explanatory. Provide detailed context, walk through your reasoning, and engage collaboratively.",
};

export function usePersonality() {
  const [personality, setPersonalityState] = useState<PersonalityMode>(() => {
    try {
      const stored = localStorage.getItem(PERSONALITY_STORAGE_KEY);
      if (stored === "pragmatic" || stored === "empathetic") return stored;
    } catch {
      // ignore
    }
    return "pragmatic";
  });

  function setPersonality(mode: PersonalityMode) {
    setPersonalityState(mode);
    try {
      localStorage.setItem(PERSONALITY_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }

  function getSystemPromptPrefix(): string {
    return PERSONALITY_PROMPTS[personality];
  }

  return {
    personality,
    setPersonality,
    getSystemPromptPrefix,
  };
}

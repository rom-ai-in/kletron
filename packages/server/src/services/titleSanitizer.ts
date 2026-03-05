const MAX_TITLE_WORDS = 5;

export function stripSystemPrefix(text: string): string {
  if (text.startsWith("[System:") && text.indexOf("]\n\n") !== -1) {
    return text.slice(text.indexOf("]\n\n") + 3).trim();
  }
  return text;
}

export function stripThoughtContent(text: string): string {
  if (!text) return "";
  let cleaned = text;
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, " ");
  cleaned = cleaned.replace(/respond with only the title[\s\S]*/gi, " ");
  cleaned = cleaned.replace(/we need to produce a short chat title[\s\S]*/gi, " ");
  cleaned = cleaned.replace(/<\/?think>/gi, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

export function sanitizeTitle(rawTitle: string): string {
  const noThoughts = stripThoughtContent(rawTitle)
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
  const words = noThoughts
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TITLE_WORDS);
  if (!words.length) return "";
  const joined = words.join(" ").replace(/[.,;:!?]+$/g, "").trim();
  if (!joined) return "";
  const lower = joined.toLowerCase();
  if (lower.includes("respond with only") || lower.includes("short chat title")) {
    return "";
  }
  return joined;
}

export function heuristicTitle(message: string): string {
  const words = stripThoughtContent(message)
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TITLE_WORDS);
  if (words.length === 0) return "Untitled";
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

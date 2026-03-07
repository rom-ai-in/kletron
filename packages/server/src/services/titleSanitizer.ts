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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function removeDuplicateParagraphs(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) return text.trim();

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const paragraph of paragraphs) {
    const key = normalizeWhitespace(paragraph).toLowerCase();
    // Keep short paragraphs (titles/list bullets) even if repeated.
    if (key.length < 80) {
      deduped.push(paragraph);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(paragraph);
  }
  return deduped.join("\n\n").trim();
}

const META_REASONING_PATTERNS: RegExp[] = [
  /\bwe must obey policy\b/i,
  /\bfinal answer in ["']?final["']? channel\b/i,
  /\bwe should provide a thorough analysis\b/i,
  /\bwe need to include the analysis and final answer\b/i,
  /\bthe user wrote\b/i,
  /\bnow,\s*we need to determine\b/i,
  /\bnow,\s*final answer\b/i,
  /\bnow,\s*the user wants to know\b/i,
  /\bgiven the pattern\b/i,
  /\bapproval required\b/i,
  /\bwe can proceed to output a final answer\b/i,
  /\bwe must not make further tool calls\b/i,
  /\bthis should satisfy the user request\b/i,
  /\bprovide (a )?structured analysis\b/i,
  /\bproceed to final\b/i,
];

export function sanitizeAssistantVisibleContent(text: string): string {
  if (!text) return "";

  // Remove explicit hidden-thought blocks first.
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, " ").trim();
  if (!cleaned) return "";

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const filtered = paragraphs.filter((paragraph) => {
    const compact = normalizeWhitespace(paragraph);
    if (!compact) return false;
    return !META_REASONING_PATTERNS.some((pattern) => pattern.test(compact));
  });

  cleaned = filtered.join("\n\n").trim();
  cleaned = removeDuplicateParagraphs(cleaned);
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
  if (
    lower.includes("respond with only") ||
    lower.includes("short chat title") ||
    /^we need to (output|produce|provide)\b/.test(lower) ||
    /^now the user wants to know\b/.test(lower)
  ) {
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

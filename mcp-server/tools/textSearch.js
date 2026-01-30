import fs from "fs/promises";
import path from "path";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMatcher({ query, regex, caseSensitive, wholeWord }) {
  if (!query || typeof query !== "string") {
    throw new Error("Missing query.");
  }

  if (regex) {
    const flags = caseSensitive ? "g" : "gi";
    return new RegExp(query, flags);
  }

  const escaped = escapeRegex(query);
  const source = wholeWord ? `\\b${escaped}\\b` : escaped;
  const flags = caseSensitive ? "g" : "gi";
  return new RegExp(source, flags);
}

function computeContextSnippet(lines, lineIndex, contextLines) {
  if (!contextLines) {
    return lines[lineIndex] ?? "";
  }
  const start = Math.max(0, lineIndex - contextLines);
  const end = Math.min(lines.length - 1, lineIndex + contextLines);
  return lines.slice(start, end + 1).join("\n");
}

export async function searchFilesForMatches({
  root,
  files,
  query,
  regex = false,
  caseSensitive = false,
  wholeWord = false,
  maxResults = 200,
  maxFileSizeBytes = 512 * 1024,
  contextLines = 0,
}) {
  const matcher = buildMatcher({ query, regex, caseSensitive, wholeWord });
  const matches = [];
  let totalMatches = 0;
  let skippedLargeFiles = 0;
  let skippedUnreadableFiles = 0;
  let scannedFiles = 0;

  for (const relativeFile of files) {
    if (matches.length >= maxResults) break;
    scannedFiles += 1;

    const fullPath = path.join(root, relativeFile);
    let content;
    try {
      const stat = await fs.stat(fullPath);
      if (stat.size > maxFileSizeBytes) {
        skippedLargeFiles += 1;
        continue;
      }
      content = await fs.readFile(fullPath, "utf-8");
    } catch {
      skippedUnreadableFiles += 1;
      continue;
    }

    if (content.includes("\u0000")) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (matches.length >= maxResults) break;
      const line = lines[i] ?? "";

      matcher.lastIndex = 0;
      const match = matcher.exec(line);
      if (!match) continue;

      totalMatches += 1;
      const column = (match.index ?? 0) + 1;
      matches.push({
        file: relativeFile,
        line: i + 1,
        column,
        snippet: computeContextSnippet(lines, i, contextLines),
      });
    }
  }

  return {
    matches,
    totalMatches,
    truncated: matches.length >= maxResults,
    scannedFiles,
    skippedLargeFiles,
    skippedUnreadableFiles,
  };
}


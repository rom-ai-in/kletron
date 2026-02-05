import { glob } from "glob";

const cache = new Map();

function makeKey({ root, patterns, ignore }) {
  return `${root}\u0000${patterns.join("|")}\u0000${ignore.join("|")}`;
}

export async function globCached({
  root,
  patterns,
  ignore,
  ttlMs = 10_000,
}) {
  const now = Date.now();
  const key = makeKey({ root, patterns, ignore });
  const cached = cache.get(key);
  if (cached && now - cached.createdAtMs < ttlMs) {
    return cached.files;
  }

  const files = await glob(patterns, {
    cwd: root,
    nodir: true,
    ignore,
  });

  cache.set(key, { createdAtMs: now, files });
  return files;
}


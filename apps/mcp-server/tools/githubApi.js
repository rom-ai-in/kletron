function parseRepo({ owner, repo, repoUrl }) {
  if (owner && repo) return { owner, repo };
  if (!repoUrl) throw new Error("Provide either {owner, repo} or {repoUrl}.");

  let parsed;
  try {
    parsed = new URL(repoUrl);
  } catch {
    throw new Error("Invalid repoUrl.");
  }
  const match = parsed.pathname.replace(/\.git$/, "").match(/^\/([^/]+)\/([^/]+)(\/|$)/);
  if (!match) throw new Error("repoUrl must look like https://github.com/<owner>/<repo>.");
  return { owner: match[1], repo: match[2] };
}

async function githubFetchJson({ path, token, timeoutMs = 15_000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      signal: controller.signal,
      headers: {
        accept: "application/vnd.github+json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        "x-github-api-version": "2022-11-28",
        "user-agent": "github-mcp/1.0",
      },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = json && typeof json === "object" ? JSON.stringify(json) : String(res.status);
      throw new Error(`GitHub API error: ${detail}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export const githubApi = {
  description:
    "Query GitHub REST API for issues/PRs/releases. Uses GITHUB_TOKEN/GH_TOKEN if set.",
  inputSchema: {
    type: "object",
    properties: {
      repoUrl: { type: "string", description: "https://github.com/<owner>/<repo>" },
      owner: { type: "string" },
      repo: { type: "string" },
      resource: { type: "string", description: "issues | pulls | releases" },
      state: { type: "string", description: "open | closed | all (issues/pulls)" },
      perPage: { type: "number" },
      page: { type: "number" },
      timeoutMs: { type: "number" },
    },
    required: ["resource"],
  },
  async run({ repoUrl, owner, repo, resource, state = "open", perPage = 20, page = 1, timeoutMs = 15_000 } = {}) {
    const parsed = parseRepo({ owner, repo, repoUrl });
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
    const per = Math.max(1, Math.min(100, Math.trunc(perPage)));
    const pg = Math.max(1, Math.trunc(page));

    if (resource === "issues") {
      const json = await githubFetchJson({
        path: `/repos/${parsed.owner}/${parsed.repo}/issues?state=${encodeURIComponent(state)}&per_page=${per}&page=${pg}`,
        token,
        timeoutMs,
      });
      return json.map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        url: i.html_url,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        user: i.user?.login ?? null,
        labels: Array.isArray(i.labels) ? i.labels.map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean) : [],
        isPullRequest: Boolean(i.pull_request),
      }));
    }

    if (resource === "pulls") {
      const json = await githubFetchJson({
        path: `/repos/${parsed.owner}/${parsed.repo}/pulls?state=${encodeURIComponent(state)}&per_page=${per}&page=${pg}`,
        token,
        timeoutMs,
      });
      return json.map((p) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        url: p.html_url,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        user: p.user?.login ?? null,
        draft: Boolean(p.draft),
      }));
    }

    if (resource === "releases") {
      const json = await githubFetchJson({
        path: `/repos/${parsed.owner}/${parsed.repo}/releases?per_page=${per}&page=${pg}`,
        token,
        timeoutMs,
      });
      return json.map((r) => ({
        name: r.name,
        tagName: r.tag_name,
        url: r.html_url,
        publishedAt: r.published_at,
        draft: Boolean(r.draft),
        prerelease: Boolean(r.prerelease),
      }));
    }

    throw new Error("resource must be one of: issues, pulls, releases.");
  },
};


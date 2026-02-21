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

/**
 * Generic GitHub API request helper supporting GET, POST, PUT, PATCH, DELETE.
 */
async function githubRequest({ path, method = "GET", body, token, timeoutMs = 15_000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      accept: "application/vnd.github+json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-github-api-version": "2022-11-28",
      "user-agent": "github-mcp/1.0",
    };
    if (body) {
      headers["content-type"] = "application/json";
    }
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      signal: controller.signal,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
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
    "Query and mutate GitHub REST API: list/create issues, PRs, branches, comments, and releases. Uses GITHUB_TOKEN/GH_TOKEN if set.",
  inputSchema: {
    type: "object",
    properties: {
      repoUrl: { type: "string", description: "https://github.com/<owner>/<repo>" },
      owner: { type: "string" },
      repo: { type: "string" },
      resource: {
        type: "string",
        description: "issues | pulls | releases | create_issue | create_branch | create_pull | create_comment",
      },
      state: { type: "string", description: "open | closed | all (issues/pulls)" },
      perPage: { type: "number" },
      page: { type: "number" },
      timeoutMs: { type: "number" },
      // Write operation fields
      title: { type: "string", description: "Title for issue or PR (create_issue, create_pull)" },
      body: { type: "string", description: "Body/description for issue, PR, or comment" },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Labels for issue (create_issue)",
      },
      head: { type: "string", description: "Head branch for PR (create_pull)" },
      base: { type: "string", description: "Base branch for PR (default: main) (create_pull)" },
      issueNumber: { type: "number", description: "Issue/PR number (create_comment)" },
      baseSha: { type: "string", description: "SHA to create branch from (create_branch)" },
      branchName: { type: "string", description: "New branch name (create_branch)" },
    },
    required: ["resource"],
  },
  async run({
    repoUrl,
    owner,
    repo,
    resource,
    state = "open",
    perPage = 20,
    page = 1,
    timeoutMs = 15_000,
    // Write fields
    title,
    body: bodyText,
    labels,
    head,
    base = "main",
    issueNumber,
    baseSha,
    branchName,
  } = {}) {
    const parsed = parseRepo({ owner, repo, repoUrl });
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
    const per = Math.max(1, Math.min(100, Math.trunc(perPage)));
    const pg = Math.max(1, Math.trunc(page));

    // ── Read operations ──────────────────────────────────────────────────

    if (resource === "issues") {
      const json = await githubRequest({
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
      const json = await githubRequest({
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
      const json = await githubRequest({
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

    // ── Write operations ─────────────────────────────────────────────────

    if (resource === "create_issue") {
      if (!title) throw new Error("create_issue requires a 'title' parameter.");
      if (!token) throw new Error("create_issue requires GITHUB_TOKEN/GH_TOKEN to be set.");

      const payload = { title };
      if (bodyText) payload.body = bodyText;
      if (labels && labels.length > 0) payload.labels = labels;

      const json = await githubRequest({
        path: `/repos/${parsed.owner}/${parsed.repo}/issues`,
        method: "POST",
        body: payload,
        token,
        timeoutMs,
      });
      return {
        number: json.number,
        title: json.title,
        url: json.html_url,
        state: json.state,
        createdAt: json.created_at,
      };
    }

    if (resource === "create_branch") {
      if (!branchName) throw new Error("create_branch requires a 'branchName' parameter.");
      if (!token) throw new Error("create_branch requires GITHUB_TOKEN/GH_TOKEN to be set.");

      // If no baseSha provided, resolve the default branch HEAD
      let sha = baseSha;
      if (!sha) {
        const refJson = await githubRequest({
          path: `/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${encodeURIComponent(base)}`,
          token,
          timeoutMs,
        });
        sha = refJson.object?.sha;
        if (!sha) throw new Error(`Could not resolve HEAD SHA for branch '${base}'.`);
      }

      const ref = branchName.startsWith("refs/") ? branchName : `refs/heads/${branchName}`;
      const json = await githubRequest({
        path: `/repos/${parsed.owner}/${parsed.repo}/git/refs`,
        method: "POST",
        body: { ref, sha },
        token,
        timeoutMs,
      });
      return {
        ref: json.ref,
        sha: json.object?.sha,
        url: json.url,
      };
    }

    if (resource === "create_pull") {
      if (!title) throw new Error("create_pull requires a 'title' parameter.");
      if (!head) throw new Error("create_pull requires a 'head' parameter (source branch).");
      if (!token) throw new Error("create_pull requires GITHUB_TOKEN/GH_TOKEN to be set.");

      const payload = { title, head, base };
      if (bodyText) payload.body = bodyText;

      const json = await githubRequest({
        path: `/repos/${parsed.owner}/${parsed.repo}/pulls`,
        method: "POST",
        body: payload,
        token,
        timeoutMs,
      });
      return {
        number: json.number,
        title: json.title,
        url: json.html_url,
        state: json.state,
        createdAt: json.created_at,
        draft: Boolean(json.draft),
      };
    }

    if (resource === "create_comment") {
      if (!issueNumber) throw new Error("create_comment requires an 'issueNumber' parameter.");
      if (!bodyText) throw new Error("create_comment requires a 'body' parameter.");
      if (!token) throw new Error("create_comment requires GITHUB_TOKEN/GH_TOKEN to be set.");

      const json = await githubRequest({
        path: `/repos/${parsed.owner}/${parsed.repo}/issues/${issueNumber}/comments`,
        method: "POST",
        body: { body: bodyText },
        token,
        timeoutMs,
      });
      return {
        id: json.id,
        url: json.html_url,
        createdAt: json.created_at,
        user: json.user?.login ?? null,
      };
    }

    throw new Error(
      "resource must be one of: issues, pulls, releases, create_issue, create_branch, create_pull, create_comment."
    );
  },
};

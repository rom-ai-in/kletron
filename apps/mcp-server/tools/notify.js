import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "../../..");
const configFilePath = path.join(projectRoot, "config", "config.json");

/**
 * Read notification config from config/config.json
 * Expected shape: { notifications: { webhookUrl?: string, repoUrl?: string } }
 */
function getNotificationConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const raw = fs.readFileSync(configFilePath, "utf-8");
      const data = JSON.parse(raw);
      return data.notifications || {};
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Reuse the github_api request helper pattern for creating issues.
 */
async function githubCreateIssue({ owner, repo, title, body, labels, token, timeoutMs = 15_000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const payload = { title };
    if (body) payload.body = body;
    if (labels && labels.length > 0) payload.labels = labels;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": "github-mcp/1.0",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = json && typeof json === "object" ? JSON.stringify(json) : String(res.status);
      throw new Error(`GitHub API error: ${detail}`);
    }
    return { number: json.number, url: json.html_url, title: json.title };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send an outgoing webhook POST request.
 */
async function sendWebhook({ url, title, body, timeoutMs = 10_000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const payload = {
      event: "continuous_improvement_report",
      title,
      body,
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": "kletron-notify/1.0",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}: ${res.statusText}`);
    }
    return { ok: true, status: res.status };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse owner/repo from a GitHub URL.
 */
function parseRepoUrl(repoUrl) {
  if (!repoUrl) return null;
  try {
    const parsed = new URL(repoUrl);
    const match = parsed.pathname.replace(/\.git$/, "").match(/^\/([^/]+)\/([^/]+)(\/|$)/);
    if (match) return { owner: match[1], repo: match[2] };
  } catch {
    // ignore
  }
  return null;
}

export const notify = {
  description:
    "Send a notification via GitHub issue and/or outgoing webhook. Reads default config from config/config.json (notifications.webhookUrl, notifications.repoUrl).",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Notification title" },
      body: { type: "string", description: "Notification body (markdown)" },
      channel: {
        type: "string",
        description: "github_issue | webhook | all (default: all)",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Labels for GitHub issue (default: ['continuous-improvement'])",
      },
      webhookUrl: {
        type: "string",
        description: "Override webhook URL (falls back to config.notifications.webhookUrl)",
      },
      repoUrl: {
        type: "string",
        description: "GitHub repo URL for issue creation (falls back to config.notifications.repoUrl)",
      },
      owner: { type: "string", description: "GitHub repo owner (alternative to repoUrl)" },
      repo: { type: "string", description: "GitHub repo name (alternative to repoUrl)" },
    },
    required: ["title", "body"],
  },
  async run({
    title,
    body,
    channel = "all",
    labels = ["continuous-improvement"],
    webhookUrl,
    repoUrl,
    owner,
    repo,
  } = {}) {
    const notifConfig = getNotificationConfig();
    const results = {};

    // ── GitHub Issue channel ───────────────────────────────────────────
    if (channel === "github_issue" || channel === "all") {
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
      if (!token) {
        results.github_issue = { ok: false, error: "GITHUB_TOKEN/GH_TOKEN not set" };
      } else {
        let parsed = null;
        if (owner && repo) {
          parsed = { owner, repo };
        } else {
          const url = repoUrl || notifConfig.repoUrl;
          if (url) parsed = parseRepoUrl(url);
        }

        if (!parsed) {
          results.github_issue = {
            ok: false,
            error: "No repo specified. Provide repoUrl, owner+repo, or configure notifications.repoUrl in config.json.",
          };
        } else {
          try {
            const issue = await githubCreateIssue({
              owner: parsed.owner,
              repo: parsed.repo,
              title,
              body,
              labels,
              token,
            });
            results.github_issue = { ok: true, ...issue };
          } catch (err) {
            results.github_issue = { ok: false, error: err.message };
          }
        }
      }
    }

    // ── Webhook channel ────────────────────────────────────────────────
    if (channel === "webhook" || channel === "all") {
      const url = webhookUrl || notifConfig.webhookUrl;
      if (!url) {
        results.webhook = {
          ok: false,
          error: "No webhook URL. Provide webhookUrl or configure notifications.webhookUrl in config.json.",
        };
      } else {
        try {
          const webhookResult = await sendWebhook({ url, title, body });
          results.webhook = webhookResult;
        } catch (err) {
          results.webhook = { ok: false, error: err.message };
        }
      }
    }

    return results;
  },
};

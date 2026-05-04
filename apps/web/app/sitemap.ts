import type { MetadataRoute } from "next";

const base =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://kletron.com");

const paths = [
  "",
  "/platform",
  "/agent-graphs",
  "/mcp",
  "/work",
  "/automations",
  "/compare",
  "/changelog",
  "/enterprise",
  "/pricing",
  "/auth/login",
  "/auth/register",
  "/legal/terms",
  "/legal/privacy",
  "/legal/gdpr",
  "/legal/cookies",
  "/legal/imprint",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return paths.map((path) => ({
    url: `${base.replace(/\/$/, "")}${path || "/"}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" || path === "/enterprise" ? 0.9 : 0.7,
  }));
}

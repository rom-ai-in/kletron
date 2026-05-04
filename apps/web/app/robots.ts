import type { MetadataRoute } from "next";

const base =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://kletron.com");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
    host: base.replace(/\/$/, ""),
  };
}

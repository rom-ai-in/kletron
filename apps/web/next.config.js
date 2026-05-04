import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: [
    "@kletron/agent-core",
    "@kletron/mcp-client",
    "@kletron/server",
    "@kletron/shared",
    "@kletron/ui",
  ],
  // Prevent Next.js from bundling these packages (fixes iconv-lite/encodings issue)
  experimental: {
    externalDir: true,
    /** Monorepo: include workspace packages in standalone trace output */
    outputFileTracingRoot: monorepoRoot,
    serverComponentsExternalPackages: [
      "@modelcontextprotocol/sdk",
      "iconv-lite",
      "raw-body",
    ],
  },
};

export default nextConfig;

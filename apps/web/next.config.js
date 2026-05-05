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
    /** Enables instrumentation.ts (canonical graph upsert on server boot). */
    instrumentationHook: true,
    externalDir: true,
    /** Monorepo: include workspace packages in standalone trace output */
    outputFileTracingRoot: monorepoRoot,
    serverComponentsExternalPackages: [
      "@modelcontextprotocol/sdk",
      "iconv-lite",
      "raw-body",
      /** Native driver + optional peers — do not webpack-bundle for API routes / instrumentation */
      "mongodb",
    ],
  },

  /** Instrumentation is webpack-bundled; keep the native driver external (Node builtins: net, fs, tls, …). */
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("mongodb");
    }
    return config;
  },
};

export default nextConfig;

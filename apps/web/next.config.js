/** @type {import('next').NextConfig} */
const nextConfig = {
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
    serverComponentsExternalPackages: [
      "@modelcontextprotocol/sdk",
      "iconv-lite",
      "raw-body",
    ],
  },
};

export default nextConfig;

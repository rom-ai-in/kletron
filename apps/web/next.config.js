/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: [
    "@numezis/agent-core",
    "@numezis/mcp-client",
    "@numezis/server",
    "@numezis/shared",
    "@numezis/ui",
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

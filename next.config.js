/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Prevent Next.js from bundling these packages (fixes iconv-lite/encodings issue)
  serverExternalPackages: [
    "@modelcontextprotocol/sdk",
    "iconv-lite",
    "raw-body",
  ],
};

export default nextConfig;

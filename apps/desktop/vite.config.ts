import { defineConfig, type UserConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async (): Promise<UserConfig> => {
  let reactPlugin: any = null;
  try {
    const mod = await import("@vitejs/plugin-react");
    reactPlugin = mod.default();
  } catch (error) {
    console.warn("[desktop] @vitejs/plugin-react is missing. Running without React Fast Refresh.", error);
  }

  return {
    root: __dirname,
    esbuild: {
      jsx: "automatic",
    },
    plugins: reactPlugin ? [reactPlugin] : [],
    resolve: {
      alias: [
        {
          find: /^@numezis\/ui/,
          replacement: path.resolve(__dirname, "../../packages/ui/src"),
        },
        {
          find: /^@numezis\/server/,
          replacement: path.resolve(__dirname, "../../packages/server/src"),
        },
        // ── Next.js shims for Electron ────────────────────────────────────
        {
          find: /^next\/link$/,
          replacement: path.resolve(__dirname, "src/shims/next-link.tsx"),
        },
        {
          find: /^next\/navigation$/,
          replacement: path.resolve(__dirname, "src/shims/next-navigation.ts"),
        },
      ],
    },
    define: {
      // Provide `process.env` so Next.js-originated code (e.g. AuthGuard)
      // doesn't throw "process is not defined".
      "process.env": JSON.stringify({}),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});

import { defineConfig, loadEnv, type UserConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  const env = loadEnv(mode, __dirname, "VITE_");
  let reactPlugin: any = null;
  try {
    const mod = await import("@vitejs/plugin-react");
    reactPlugin = mod.default();
  } catch (error) {
    console.warn("[desktop] @vitejs/plugin-react is missing. Running without React Fast Refresh.", error);
  }

  return {
    root: __dirname,
    // Electron loads `dist/index.html` via `file://`; absolute `/assets/...` URLs resolve to the
    // filesystem root and the renderer bundle never loads. Relative paths fix blank-window prod runs.
    base: "./",
    esbuild: {
      jsx: "automatic",
    },
    plugins: reactPlugin ? [reactPlugin] : [],
    resolve: {
      alias: [
        {
          find: /^@kletron\/ui/,
          replacement: path.resolve(__dirname, "../../packages/ui/src"),
        },
        {
          find: /^@kletron\/server/,
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
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(env.VITE_BACKEND_URL ?? ""),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});

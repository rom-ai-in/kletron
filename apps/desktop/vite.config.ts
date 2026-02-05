import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async () => {
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
      jsx: "automatic"
    },
    plugins: reactPlugin ? [reactPlugin] : [],
    resolve: {
      alias: [
        {
          find: /^@numezis\/ui/,
          replacement: path.resolve(__dirname, "../../packages/ui/src")
        },
        {
          find: /^@numezis\/server/,
          replacement: path.resolve(__dirname, "../../packages/server/src")
        }
      ]
    },
    build: {
      outDir: "dist",
      emptyOutDir: true
    }
  };
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outdir = path.resolve(root, "dist-electron");

await esbuild.build({
  bundle: true,
  platform: "node",
  format: "cjs",
  sourcemap: true,
  target: "node18",
  tsconfig: path.resolve(root, "tsconfig.json"),
  external: ["electron", "electron-updater"],
  alias: {
    "@kletron/bridge": path.resolve(root, "..", "..", "packages", "bridge", "src", "index.ts"),
  },
  outExtension: { ".js": ".cjs" },
  outdir,
  entryPoints: [
    path.resolve(root, "electron", "main.ts"),
    path.resolve(root, "electron", "preload.ts")
  ]
});

console.log("[desktop] Electron build complete.");

import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outdir = path.resolve(root, "dist-electron");

const buildOptions = {
  bundle: true,
  platform: "node",
  format: "esm",
  sourcemap: true,
  target: "node18",
  tsconfig: path.resolve(root, "tsconfig.json"),
  external: ["electron"],
  outdir
} as const;

await esbuild.build({
  ...buildOptions,
  entryPoints: [path.resolve(root, "electron", "main.ts")],
  outfile: path.resolve(outdir, "main.js")
});

await esbuild.build({
  ...buildOptions,
  entryPoints: [path.resolve(root, "electron", "preload.ts")],
  outfile: path.resolve(outdir, "preload.js")
});

console.log("[desktop] Electron build complete.");

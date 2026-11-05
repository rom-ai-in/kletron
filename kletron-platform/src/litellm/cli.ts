import { writeFileSync } from "node:fs";
import { generateLiteLLMConfig, renderLiteLLMYaml } from "./generate.js";

const doc = generateLiteLLMConfig(process.env);
const out = process.argv[2] ?? "config/litellm.generated.yaml";
writeFileSync(out, renderLiteLLMYaml(doc), "utf8");
console.log(`Wrote ${out}`);

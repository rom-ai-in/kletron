import { createInterface } from "node:readline";

import { graph } from "./graph";

async function main() {
  console.log("🚀 Numezis TS LangGraph Agent");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string) =>
    new Promise<string>((resolve) => {
      rl.question(question, resolve);
    });

  while (true) {
    const userRequest = await ask("\nWhat should I build today? (type exit to quit)\n> ");
    if (!userRequest || userRequest.toLowerCase() === "exit") {
      break;
    }

    console.log("\n🧠 Running Diamond Flow audit (Recon → Strategy → Investigation → Adjudication → Reporting)...");
    const result = await graph.invoke({
      context: {
        mission: userRequest,
        languages: [],
        frameworks: [],
        hotspots: [],
      },
    });
    console.log("\n✅ Output:");
    console.log(result.finalAnswer ?? "Done.");
  }

  rl.close();
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});

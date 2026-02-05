import { createInterface } from "node:readline";
import { runWorkflow } from "@numezis/agent-core/workflows";

async function main() {
  console.log("🚀 Numezis Code - Agent Executor");
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

    console.log("\n🧠 Running Agent Graph Workflow...");
    const result = await runWorkflow(userRequest, undefined, {
      onUpdate: (update) => {
        const lastEvent = update.eventStream[update.eventStream.length - 1];
        if (lastEvent?.kind === "assistant") {
          console.log(`[Agent]: ${lastEvent.content.slice(0, 100)}...`);
        }
      }
    });

    console.log("\n✅ Output:");
    console.log(result.conclusion ?? "Done.");
  }


  rl.close();
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});

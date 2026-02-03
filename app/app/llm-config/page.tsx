import { redirect } from "next/navigation";

export default function LlmRedirectPage() {
  redirect("/app/config/llm");
}

import { redirect } from "next/navigation";

/** Legacy Deep Agent page - redirects to unified Agent page. */
export default function DeepAgentPage() {
  redirect("/app/agent");
}

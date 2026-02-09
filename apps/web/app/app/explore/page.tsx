import { redirect } from "next/navigation";

/** Legacy Explore page - redirects to unified Agent page. */
export default function ExplorePage() {
  redirect("/app/agent");
}

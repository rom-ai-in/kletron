import { redirect } from "next/navigation";

export default function VectorHistoryRedirectPage() {
  redirect("/app/config/context?tab=semantic&sub=history");
}

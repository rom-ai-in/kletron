import { redirect } from "next/navigation";

/** Vector index UI lives under Configuration → Context & retrieval → Semantic index. */
export default function VectorsRedirectPage() {
  redirect("/app/config/context?tab=semantic");
}

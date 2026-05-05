import { redirect } from "next/navigation";

/** Bookmarks / anciens liens : les connecteurs sont gérés sous Configuration. */
export default function ConnectorsAliasRedirectPage() {
    redirect("/app/config/connectors");
}

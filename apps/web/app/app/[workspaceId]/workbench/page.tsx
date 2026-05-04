import { redirect } from "next/navigation";

/** Legacy route — workbench UI removed; use Agent as the single workspace surface. */
export default function WorkbenchRedirectPage() {
    redirect("/app/agent");
}

import { redirect } from "next/navigation";

/** Billing is organization-scoped; legacy URL keeps working. */
export default function AccountBillingRedirectPage() {
    redirect("/app/organization/billing");
}

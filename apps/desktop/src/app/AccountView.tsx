import { UserCircle, Building2, CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@kletron/ui/components/design-system";

export type AccountViewProps = {
  email?: string | null;
  fullName?: string | null;
  openPortalPath: (path: string) => void;
  onSignOut: () => void;
  hasSession: boolean;
};

export function AccountView({ email, fullName, openPortalPath, onSignOut, hasSession }: AccountViewProps) {
  const display = fullName?.trim() || email?.split("@")[0] || "Account";

  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden">
      <div className="flex items-center border-b border-border-subtle bg-bg-surface px-6 py-4 shrink-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-text-secondary/15 text-text-secondary">
            <UserCircle className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text-primary truncate">{display}</h1>
            <p className="text-sm text-text-muted truncate">{email || "Not signed in"}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant space-y-6">
        <p className="text-sm text-text-secondary">
          Profile, security, API tokens, and privacy controls live in the web app. Use the links below to manage your account in
          the browser.
        </p>

        <div className="space-y-2 max-w-md">
          <Button
            variant="secondary"
            className="w-full justify-between"
            onClick={() => openPortalPath("/app/account")}
            type="button"
          >
            <span className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              Account settings
            </span>
            <ExternalLink className="h-4 w-4 opacity-70" />
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-between"
            onClick={() => openPortalPath("/app/organization")}
            type="button"
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </span>
            <ExternalLink className="h-4 w-4 opacity-70" />
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-between"
            onClick={() => openPortalPath("/app/account/billing")}
            type="button"
          >
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
            </span>
            <ExternalLink className="h-4 w-4 opacity-70" />
          </Button>
        </div>

        {hasSession ? (
          <div className="pt-4 border-t border-border-subtle">
            <Button variant="ghost" onClick={onSignOut} type="button">
              Sign out
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

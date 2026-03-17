"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getBreadcrumbItems } from "@kletron/shared/breadcrumbs";
import { useBreadcrumbOverrides } from "@kletron/ui/components/ui/BreadcrumbOverridesProvider";

export function Breadcrumbs() {
  const pathname = usePathname() || "/";
  const { labelsByHref } = useBreadcrumbOverrides();
  const items = getBreadcrumbItems(pathname).map((item) => ({
    ...item,
    label: labelsByHref[item.href] ?? item.label,
  }));

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-text-muted">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={item.href} className="flex min-w-0 items-center gap-1">
              {!isLast ? (
                <Link
                  href={item.href}
                  className="truncate rounded px-1 py-0.5 transition hover:bg-state-hover hover:text-text-primary"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate px-1 py-0.5 text-text-primary">{item.label}</span>
              )}
              {!isLast && <span className="px-0.5 text-text-muted">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}


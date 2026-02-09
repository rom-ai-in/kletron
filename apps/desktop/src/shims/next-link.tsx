/**
 * Shim for "next/link" in the Electron/Vite desktop app.
 * Replaces Next.js <Link> with a plain <a> that uses window.location for navigation.
 */
import React from "react";

export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string | { pathname?: string; query?: Record<string, string> };
  replace?: boolean;
  prefetch?: boolean;
  children?: React.ReactNode;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, replace: _replace, prefetch: _prefetch, children, ...rest }, ref) => {
    const resolvedHref =
      typeof href === "string"
        ? href
        : `${href.pathname ?? "/"}${
            href.query
              ? "?" +
                new URLSearchParams(
                  href.query as Record<string, string>
                ).toString()
              : ""
          }`;

    return (
      <a ref={ref} href={resolvedHref} {...rest}>
        {children}
      </a>
    );
  }
);

Link.displayName = "Link";

export default Link;

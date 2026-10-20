import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";

export function PageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <main>
        <div className="menu-shell menu-intro">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="page-title">
              {title}
              <span>.</span>
            </h1>
          </div>
        </div>
        <div className="menu-shell page-content">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

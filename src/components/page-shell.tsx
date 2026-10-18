import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';

export type SitePath = '/' | '/dostawa' | '/o-nas' | '/kontakt';

const navItems: { to: SitePath; label: string }[] = [
  { to: '/', label: 'Menu' },
  { to: '/dostawa', label: 'Dostawa' },
  { to: '/o-nas', label: 'O nas' },
  { to: '/kontakt', label: 'Kontakt' },
];

export function PageShell({ active, eyebrow, title, children }: { active: SitePath; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <div className="menu-shell header-inner">
          <Link to="/" className="wordmark" aria-label="Wake Up House — strona główna">WAKE UP<span>HOUSE</span></Link>
          <nav className="header-nav" aria-label="Nawigacja główna">
            {navItems.map(item => <Link key={item.to} to={item.to} className={`header-nav-link${item.to !== '/' ? ' street-nav' : ''}${active === item.to ? ' is-current' : ''}`}>{item.label}</Link>)}
          </nav>
        </div>
      </header>
      <main>
        <div className="menu-shell menu-intro">
          <div><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}<span>.</span></h1></div>
        </div>
        <div className="menu-shell page-content">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

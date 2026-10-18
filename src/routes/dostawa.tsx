import { createFileRoute } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { site } from '@/lib/site';

export const Route = createFileRoute('/dostawa')({
  head: () => ({ meta: [
    { title: 'Dostawa i odbiór — Wake Up House | Głogów Małopolski' },
    { name: 'description', content: 'Strefy dowozu, koszt dostawy, godziny dostaw, odbiór osobisty i płatności — Wake Up House, Parkowa 10, Głogów Małopolski.' },
    { property: 'og:title', content: 'Dostawa i odbiór — Wake Up House' },
    { property: 'og:description', content: 'Sprawdź, gdzie i kiedy dowozimy oraz jak zamówić z Wake Up House w Głogowie Małopolskim.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Dostawa,
});

const deliveryItems: [string, string][] = [
  ['Gdzie dowozimy', site.delivery.area],
  ['Koszt dostawy według stref', site.delivery.zones],
  ['Minimalna wartość zamówienia', site.delivery.minOrder],
  ['Godziny dostaw', site.delivery.hours],
  ['Odbiór osobisty', site.delivery.pickup],
  ['Orientacyjny czas realizacji', site.delivery.time],
  ['Płatności', site.delivery.payments],
];

function Dostawa() {
  return (
    <PageShell active="/dostawa" eyebrow="Wake Up House · Zamówienia" title="Dostawa i odbiór">
      <div className="info-grid">
        {deliveryItems.map(([label, text]) => <div className="info-card" key={label}><p className="info-label">{label}</p><p className="info-text">{text}</p></div>)}
      </div>
      <div className="order-cta">
        <p className="info-label">Zamów</p>
        <div className="platform-buttons">
          {site.platforms.map(platform => <a key={platform.name} className="platform-button" href={platform.url ?? '#'} aria-disabled={platform.url ? undefined : true} title={platform.url ? platform.name : `${platform.name} — link do uzupełnienia`} target={platform.url ? '_blank' : undefined} rel={platform.url ? 'noopener noreferrer' : undefined}>{platform.name}</a>)}
        </div>
        <p className="info-text">Albo zamów bezpośrednio w naszym <a className="inline-link" href="/">menu</a>.</p>
      </div>
    </PageShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { openingHours, site } from "@/lib/site";

export const Route = createFileRoute("/kontakt")({
  head: () => ({
    meta: [
      { title: "Kontakt — Wake Up House | Głogów Małopolski" },
      {
        name: "description",
        content:
          "Kontakt z Wake Up House: Parkowa 10, 36-060 Głogów Małopolski. Godziny otwarcia, telefon i social media.",
      },
      { property: "og:title", content: "Kontakt — Wake Up House" },
      {
        property: "og:description",
        content:
          "Adres, telefon, godziny otwarcia i social media Wake Up House w Głogowie Małopolskim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Kontakt,
});

function Kontakt() {
  return (
    <PageShell eyebrow="Wake Up House · Jesteśmy dostępni" title="Kontakt">
      <div className="contact-layout">
        <section className="contact-main">
          <p className="contact-label">Adres</p>
          <p className="contact-value">Parkowa 10</p>
          <p className="contact-sub">36-060 Głogów Małopolski</p>
          <a className="delivery-more" href={site.mapUrl} target="_blank" rel="noopener noreferrer">
            Zobacz na mapie <ArrowUpRight />
          </a>
        </section>
        <section className="contact-main">
          <p className="contact-label">Telefon</p>
          <p className="contact-value">{site.phone}</p>
          <p className="contact-sub">Zadzwoń i zamów z dostawą lub na odbiór.</p>
          <p className="contact-label contact-email-label">E-mail</p>
          <a className="contact-value contact-value-small" href={`mailto:${site.email}`}>
            {site.email}
          </a>
        </section>
        <section className="contact-main contact-hours-card">
          <p className="contact-label">Godziny otwarcia</p>
          <dl className="hours-list">
            {openingHours.map(({ day, hours }) => (
              <div key={day}>
                <dt>{day}</dt>
                <dd className={hours === "Zamknięte" ? "hours-closed" : ""}>{hours}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="contact-main">
          <p className="contact-label">W sieci</p>
          <p className="contact-value contact-value-small">Facebook</p>
          <p className="contact-sub">Link do uzupełnienia.</p>
          <p className="contact-value contact-value-small">Instagram</p>
          <p className="contact-sub">Link do uzupełnienia.</p>
        </section>
      </div>
      <div className="contact-meta">
        <div>
          <p className="contact-label">Dane firmy / NIP</p>
          <p className="contact-meta-text">{site.nip}</p>
        </div>
      </div>
    </PageShell>
  );
}

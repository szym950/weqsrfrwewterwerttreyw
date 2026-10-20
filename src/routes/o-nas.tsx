import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { site } from "@/lib/site";

export const Route = createFileRoute("/o-nas")({
  head: () => ({
    meta: [
      { title: "O nas — Wake Up House | Głogów Małopolski" },
      {
        name: "description",
        content:
          "Wake Up House — burgery, pizza i street food przy Parkowej 10 w Głogowie Małopolskim, z sezonowym ogródkiem latem.",
      },
      { property: "og:title", content: "O nas — Wake Up House" },
      {
        property: "og:description",
        content:
          "Poznaj Wake Up House: burgery, pizza i street food przy Parkowej 10 w Głogowie Małopolskim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ONas,
});

function ONas() {
  return (
    <PageShell eyebrow="Wake Up House · Kim jesteśmy" title="O nas">
      <div className="about-copy">
        {site.about.map((paragraph, index) => (
          <p key={index}>
            {index === 0 ? <strong>Wake Up House</strong> : null}
            {index === 0 ? " " : ""}
            {paragraph}
          </p>
        ))}
      </div>
      <div className="about-gallery" aria-label="Zdjęcia jedzenia z Wake Up House">
        <img
          src="/Start_Jump.png"
          alt="Burger Start Jump"
          loading="lazy"
          width="512"
          height="512"
        />
        <img
          src="/Cheese_Air.png"
          alt="Burger Cheese Air"
          loading="lazy"
          width="512"
          height="512"
        />
        <img src="/Parma.png" alt="Pizza Parma" loading="lazy" width="512" height="512" />
        <img
          src="/Loaded_Fries1.png"
          alt="Loaded fries z kurczakiem i wołowiną"
          loading="lazy"
          width="512"
          height="512"
        />
      </div>
      <div className="info-card about-place">
        <p className="info-label">Miejsce</p>
        <p className="info-text">
          Parkowa 10, 36-060 Głogów Małopolski. Zdjęcia lokalu dodamy, gdy je prześlesz.
        </p>
        <a className="delivery-more" href={site.mapUrl} target="_blank" rel="noopener noreferrer">
          Otwórz w mapach <ArrowUpRight />
        </a>
      </div>
    </PageShell>
  );
}

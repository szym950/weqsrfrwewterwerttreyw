import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin } from "lucide-react";
import { openingHours, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="menu-footer">
      <div className="menu-shell">
        <nav className="footer-links" aria-label="Nawigacja stopki">
          <Link to="/">Menu</Link>
          <Link to="/dostawa">Dostawa i odbiór</Link>
          <Link to="/o-nas">O nas</Link>
          <Link to="/kontakt">Kontakt</Link>
        </nav>
        <nav className="footer-links legal-links" aria-label="Dokumenty prawne">
          {site.legalDocuments.map((document) => (
            <a key={document.name} href={document.url} target="_blank" rel="noopener noreferrer">
              {document.name}
            </a>
          ))}
        </nav>
        <div className="footer-inner">
          <div>
            <p className="footer-brand">
              WAKE UP HOUSE<span className="text-primary">.</span>
            </p>
            <a
              className="footer-address"
              href={site.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin />
              <span>
                Parkowa 10
                <br />
                36-060 Głogów Małopolski
              </span>
              <ArrowUpRight />
            </a>
          </div>
          <div className="opening-hours">
            <h2>Godziny otwarcia</h2>
            <dl>
              {openingHours.map(({ day, hours }) => (
                <div key={day}>
                  <dt>{day}</dt>
                  <dd className={hours === "Zamknięte" ? "hours-closed" : ""}>{hours}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search, X, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { categories, dishes, formatPrice, type Category, type Dish } from "@/lib/menu";
import { useCart } from "@/lib/cart-state";
import { SiteFooter } from "@/components/site-footer";
import { site } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Menu — Wake Up House | Głogów Małopolski" },
      {
        name: "description",
        content:
          "Menu Wake Up House: burgery, pizza, loaded fries i stripsy. Parkowa 10, 36-060 Głogów Małopolski.",
      },
      { property: "og:title", content: "Menu — Wake Up House" },
      {
        property: "og:description",
        content: "Burgery, pizza i street food. Wake Up House, Parkowa 10, Głogów Małopolski.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

async function readOrderCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("dish_counts")
    .select("dish_name, count")
    .order("count", { ascending: false })
    .limit(50);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.dish_name, Number(row.count)]));
}

async function recordOrder(dish: Dish) {
  try {
    const { error } = await supabase.rpc("increment_dish_count", { _dish: dish.name });
    if (error) {
      console.error("Nie udało się zapisać wyboru dania.", error);
    }
  } catch (error) {
    console.error("Nie udało się zapisać wyboru dania.", error);
  }
}

function Index() {
  const [category, setCategory] = useState<Category>("Wszystko");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<Dish | null>(null);
  const [payuReturn, setPayuReturn] = useState(false);
  const { items: cart, change: updateCart, setOpen: setCartOpen } = useCart();
  const [topDishes, setTopDishes] = useState<Dish[]>([]);
  const refreshTopDishes = (delayMs = 0) => {
    window.setTimeout(async () => {
      try {
        const counts = await readOrderCounts();
        setTopDishes(
          dishes
            .filter((dish) => (counts[dish.name] ?? 0) > 0)
            .sort(
              (a, b) =>
                (counts[b.name] ?? 0) - (counts[a.name] ?? 0) ||
                dishes.indexOf(a) - dishes.indexOf(b),
            )
            .slice(0, 3),
        );
      } catch (error) {
        console.error("Nie udało się pobrać najczęściej wybieranych dań.", error);
      }
    }, delayMs);
  };
  useEffect(() => {
    refreshTopDishes();
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "return") return;
    setPayuReturn(true);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
  }, []);
  const changeCart = (dish: Dish, delta: number) => {
    if (delta > 0 && dish.pricePLN === null) return;
    if (delta > 0) {
      recordOrder(dish);
      refreshTopDishes(400);
    }
    updateCart(dish, delta);
  };
  const visible = dishes.filter(
    (dish) =>
      (category === "Wszystko" || dish.category === category) &&
      `${dish.name} ${dish.ingredients.join(" ")}`
        .toLocaleLowerCase("pl")
        .includes(search.toLocaleLowerCase("pl")),
  );
  const selectCategory = (next: Category) => {
    setCategory(next);
    setSearch("");
    document.getElementById("menu-list")?.scrollIntoView({ block: "start" });
  };
  return (
    <>
      <main>
        {payuReturn && (
          <p className="menu-shell checkout-preview-warning" role="status">
            Wróciłeś z PayU. Czekamy na potwierdzenie transakcji — zamówienie trafi do lokalu po
            potwierdzeniu płatności.
          </p>
        )}
        <div className="menu-shell menu-intro">
          <div>
            <p className="eyebrow">Wake Up House · Burgery, pizza & street food</p>
            <h1 className="menu-title">
              MENU<span>.</span>
            </h1>
          </div>
          <p className="intro-copy">
            <strong>Na co masz dziś ochotę?</strong>
            <br />
            Wybierz swój smak. Resztę zostaw nam.
          </p>
        </div>
        <div className="category-bar" id="menu-list">
          <div className="menu-shell category-inner">
            <nav className="category-list" aria-label="Kategorie menu">
              {categories.map((item) => (
                <Button
                  key={item}
                  variant={category === item ? "default" : "ghost"}
                  className="category-tab"
                  aria-pressed={category === item}
                  onClick={() => {
                    setCategory(item);
                  }}
                >
                  {item}
                  <span>
                    {item === "Wszystko"
                      ? dishes.length
                      : dishes.filter((d) => d.category === item).length}
                  </span>
                </Button>
              ))}
            </nav>
            <div className={`search-area ${searchOpen ? "is-open" : ""}`}>
              {searchOpen && (
                <input
                  className="search-input"
                  aria-label="Szukaj dania lub składnika"
                  placeholder="Szukaj w menu…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={searchOpen ? "Zamknij wyszukiwanie" : "Szukaj w menu"}
                title={searchOpen ? "Zamknij wyszukiwanie" : "Szukaj w menu"}
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  setSearch("");
                }}
              >
                {searchOpen ? <X /> : <Search />}
              </Button>
            </div>
          </div>
        </div>
        <section className="menu-shell menu-content" aria-label="Dania">
          {category === "Wszystko" && !search && (
            <section className="top-picks" aria-label="Najczęściej wybierane">
              <div className="section-heading">
                <h2>Najczęściej wybierane</h2>
                <p>Na podstawie wyborów wszystkich klientów</p>
              </div>
              {topDishes.length === 0 ? (
                <p className="top-picks-empty">
                  Tu pojawią się dania, które klienci najczęściej dodają do koszyka.
                </p>
              ) : (
                <div className="product-grid">
                  {topDishes.map((dish) => (
                    <article className="product-card" key={dish.name}>
                      <img
                        src={dish.image}
                        alt={dish.name}
                        className="product-image"
                        loading="lazy"
                        width="768"
                        height="768"
                      />
                      <div className="product-info">
                        <p className="product-meta">{dish.category}</p>
                        <h3 className="product-title">{dish.name}</h3>
                        <div className="product-bottom">
                          <span className="product-price">
                            {dish.pricePLN === null
                              ? "Cena do uzupełnienia"
                              : formatPrice(dish.pricePLN)}
                          </span>
                          <Button
                            className="add-cart-button"
                            onClick={() => changeCart(dish, 1)}
                            disabled={dish.pricePLN === null}
                            aria-label={`Dodaj do koszyka: ${dish.name}`}
                          >
                            {cart.some((item) => item.dish.name === dish.name) ? (
                              <Check />
                            ) : (
                              <Plus />
                            )}{" "}
                            Do koszyka
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          <div className="section-heading">
            <h2>{category === "Wszystko" ? "Wszystkie smaki" : category}</h2>
            <p>
              {visible.length}{" "}
              {visible.length === 1
                ? "pozycja"
                : visible.length >= 2 && visible.length <= 4
                  ? "pozycje"
                  : "pozycji"}{" "}
              w menu
            </p>
          </div>
          <div className="product-grid">
            {visible.map((dish) => (
              <article className="product-card" key={dish.name}>
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="product-image"
                  loading={dishes.indexOf(dish) < 3 ? "eager" : "lazy"}
                  width="768"
                  height="768"
                />
                <div className="product-info">
                  <p className="product-meta">{dish.category}</p>
                  <h3 className="product-title">{dish.name}</h3>
                  <p className="product-desc">{dish.ingredients.join(" · ")}</p>
                  <div className="product-bottom">
                    <Button
                      variant="ghost"
                      className="product-detail-button"
                      onClick={() => setSelected(dish)}
                      aria-label={`Zobacz więcej: ${dish.name}`}
                    >
                      Składniki <ArrowUpRight />
                    </Button>
                    <span className="product-price">
                      {dish.pricePLN === null ? "Cena do uzupełnienia" : formatPrice(dish.pricePLN)}
                    </span>
                    <Button
                      className="add-cart-button"
                      onClick={() => changeCart(dish, 1)}
                      disabled={dish.pricePLN === null}
                      aria-label={`Dodaj do koszyka: ${dish.name}`}
                    >
                      {cart.some((item) => item.dish.name === dish.name) ? <Check /> : <Plus />} Do
                      koszyka
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {visible.length === 0 && (
            <div className="empty-results">
              <p>Nie znaleziono dań.</p>
              <Button
                variant="link"
                onClick={() => {
                  setSearch("");
                  setCategory("Wszystko");
                }}
              >
                Pokaż całe menu
              </Button>
            </div>
          )}
        </section>
        <section className="menu-shell start-extra" aria-label="Dostawa i zamówienie">
          <div className="delivery-strip">
            <div>
              <p className="info-label">Dostawa i odbiór</p>
              <p className="delivery-short">
                <strong>Dowozimy i przyjmujemy odbiór osobisty.</strong> {site.deliveryShort}
              </p>
              <Link to="/dostawa" className="delivery-more">
                Szczegóły dostawy <ArrowUpRight />
              </Link>
            </div>
            <div>
              <p className="info-label">Zamów przez</p>
              <div className="platform-buttons">
                {site.platforms.map((platform) => (
                  <a
                    key={platform.name}
                    className="platform-button"
                    href={platform.url ?? "#"}
                    aria-disabled={platform.url ? undefined : true}
                    title={platform.url ? platform.name : `${platform.name} — link do uzupełnienia`}
                    target={platform.url ? "_blank" : undefined}
                    rel={platform.url ? "noopener noreferrer" : undefined}
                  >
                    {platform.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="dish-dialog">
          {selected && (
            <div className="dish-dialog-grid">
              <img src={selected.image} alt={selected.name} className="product-image" />
              <div className="dish-dialog-copy">
                <p className="product-meta">{selected.category}</p>
                <DialogTitle className="dish-dialog-title">{selected.name}</DialogTitle>
                <p className="product-price">
                  {selected.pricePLN === null
                    ? "Cena do uzupełnienia"
                    : formatPrice(selected.pricePLN)}
                </p>
                <p className="ingredients-title">SKŁADNIKI</p>
                <DialogDescription className="ingredients-list">
                  {selected.ingredients.join(" · ")}
                </DialogDescription>
                <Button
                  className="dialog-add-button"
                  onClick={() => {
                    changeCart(selected, 1);
                    setSelected(null);
                    setCartOpen(true);
                  }}
                  disabled={selected.pricePLN === null}
                >
                  <Plus /> Dodaj do koszyka
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

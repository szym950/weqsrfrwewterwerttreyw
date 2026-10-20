import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-state";
import { MenuCart } from "@/components/menu-cart";

export function SiteHeader() {
  const { items, change, open: cartOpen, setOpen: setCartOpen } = useCart();
  const cartCount = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <>
      <header className="site-header">
        <div className="menu-shell header-inner">
          <Link to="/" className="wordmark" aria-label="Wake Up House — strona główna">
            WAKE UP<span>HOUSE</span>
          </Link>
          <nav className="header-nav" aria-label="Nawigacja główna">
            <Link to="/" className="header-nav-link" activeProps={{ className: "nav-current" }}>
              Menu
            </Link>
            <Link
              to="/dostawa"
              className="header-nav-link street-nav"
              activeProps={{ className: "nav-current" }}
            >
              Dostawa
            </Link>
            <Link
              to="/o-nas"
              className="header-nav-link street-nav"
              activeProps={{ className: "nav-current" }}
            >
              O nas
            </Link>
            <Link
              to="/kontakt"
              className="header-nav-link street-nav"
              activeProps={{ className: "nav-current" }}
            >
              Kontakt
            </Link>
          </nav>
          <Button
            variant="outline"
            className="cart-button"
            onClick={() => setCartOpen(true)}
            aria-label={`Otwórz koszyk, ${cartCount} dań`}
          >
            <ShoppingBag />
            <span>Koszyk</span>
            <span className="cart-count">{cartCount}</span>
          </Button>
        </div>
      </header>
      <MenuCart open={cartOpen} onOpenChange={setCartOpen} items={items} onChange={change} />
    </>
  );
}

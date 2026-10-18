import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice, type Dish } from "@/lib/menu";

export type CartItem = { dish: Dish; quantity: number };

export function MenuCart({
  open,
  onOpenChange,
  items,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onChange: (dish: Dish, delta: number) => void;
}) {
  const total = items.reduce(
    (sum, item) => sum + (item.dish.pricePLN ?? 0) * item.quantity,
    0,
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cart-dialog">
        <DialogTitle className="cart-title">
          Twój koszyk<span className="text-primary">.</span>
        </DialogTitle>
        <DialogDescription>
          {items.length ? "Wybrane dania" : "Twój koszyk jest pusty."}
        </DialogDescription>
        {items.length === 0 ? (
          <div className="cart-empty">
            <ShoppingBag />
            <Button onClick={() => onOpenChange(false)}>Wróć do menu</Button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map(({ dish, quantity }) => (
                <div className="cart-item" key={dish.name}>
                  <img src={dish.image} alt="" width="70" height="70" />
                  <div className="cart-item-info">
                    <h3>{dish.name}</h3>
                    <p>
                      {dish.category} · {formatPrice((dish.pricePLN ?? 0) * quantity)}
                    </p>
                    <div className="quantity-control">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Zmniejsz ilość: ${dish.name}`}
                        onClick={() => onChange(dish, -1)}
                      >
                        <Minus />
                      </Button>
                      <span aria-live="polite">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Zwiększ ilość: ${dish.name}`}
                        onClick={() => onChange(dish, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Usuń z koszyka"
                    aria-label={`Usuń: ${dish.name}`}
                    onClick={() => onChange(dish, -quantity)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              <span>Liczba dań</span>
              <strong>{itemCount}</strong>
            </div>
            <div className="cart-summary">
              <span>Suma produktów</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <p className="cart-checkout-note">
              To tylko podgląd koszyka. Zamówienia online i płatności nie są dostępne.
            </p>
            <div className="cart-actions">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Wróć do menu
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Dish } from "@/lib/menu";
import { CartContext, parseCart, type CartItem } from "@/lib/cart-state";

const cartStorageKey = "wakeuphouse-cart";

function readCart(): CartItem[] {
  try {
    if (typeof window === "undefined") return [];
    if (new URLSearchParams(window.location.search).get("payment") === "return") return [];
    return parseCart(window.localStorage.getItem(cartStorageKey));
  } catch (error) {
    console.error("Nie udało się odczytać zapisanego koszyka.", error);
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(items));
    } catch (error) {
      console.error("Nie udało się zapisać koszyka w tej przeglądarce.", error);
    }
  }, [items]);

  const change = (dish: Dish, delta: number) => {
    if (delta > 0 && dish.pricePLN === null) return;
    setItems((current) => {
      const existing = current.find((item) => item.dish.name === dish.name);
      if (!existing) return delta > 0 ? [...current, { dish, quantity: delta }] : current;
      return current
        .map((item) =>
          item.dish.name === dish.name ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const syncMenu = useCallback((dishes: Dish[]) => {
    setItems((current) =>
      current.flatMap(({ dish, quantity }) => {
        const currentDish = dishes.find((item) => item.name === dish.name);
        return currentDish && currentDish.pricePLN !== null
          ? [{ dish: currentDish, quantity }]
          : [];
      }),
    );
  }, []);

  return (
    <CartContext.Provider value={{ items, change, syncMenu, open, setOpen }}>
      {children}
    </CartContext.Provider>
  );
}

import { createContext, useContext } from "react";
import { dishes, type Dish } from "@/lib/menu";

export type CartItem = { dish: Dish; quantity: number };

type CartContextValue = {
  items: CartItem[];
  change: (dish: Dish, delta: number) => void;
  syncMenu: (dishes: Dish[]) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDish(value: unknown): value is Dish {
  return (
    isRecord(value) &&
    typeof value["name"] === "string" &&
    typeof value["category"] === "string" &&
    typeof value["image"] === "string" &&
    Array.isArray(value["ingredients"]) &&
    value["ingredients"].every((ingredient) => typeof ingredient === "string") &&
    (value["pricePLN"] === null || typeof value["pricePLN"] === "number") &&
    (value["station"] === undefined || value["station"] === "kitchen" || value["station"] === "bar")
  );
}

export function parseCart(serialized: string | null): CartItem[] {
  if (!serialized) return [];
  try {
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value)) throw new Error("Nieprawidłowy format zapisanego koszyka.");

    return value.flatMap((entry): CartItem[] => {
      if (!isRecord(entry) || !isRecord(entry["dish"])) return [];
      const savedDish = entry["dish"];
      const dish = isDish(savedDish)
        ? savedDish
        : typeof savedDish["name"] === "string"
          ? dishes.find((item) => item.name === savedDish["name"])
          : undefined;
      const quantity = entry["quantity"];
      if (
        !dish ||
        dish.pricePLN === null ||
        !Number.isSafeInteger(quantity) ||
        Number(quantity) <= 0
      ) {
        return [];
      }
      return [{ dish, quantity: Number(quantity) }];
    });
  } catch (error) {
    console.error("Nie udało się odczytać zapisanego koszyka.", error);
    return [];
  }
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("Koszyk musi być użyty wewnątrz CartProvider.");
  return value;
}

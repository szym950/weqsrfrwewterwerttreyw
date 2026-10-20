import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dishes } from "@/lib/menu";
import { CartProvider } from "@/components/cart-context";
import { parseCart, useCart } from "@/lib/cart-state";

function getTestDish() {
  const dish = dishes.find((item) => item.name === "Start Jump");
  if (!dish) throw new Error("Test dish is missing from the menu.");
  return dish;
}

const testDish = getTestDish();

function CartProbe({ page }: { page: string }) {
  const { items, change } = useCart();
  return (
    <>
      <span data-testid="page">{page}</span>
      <span data-testid="quantity">{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
      <button onClick={() => change(testDish, 1)}>Dodaj</button>
    </>
  );
}

describe("saved cart", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("restores only priced menu items and uses current menu data", () => {
    const cart = parseCart(
      JSON.stringify([
        { dish: { name: "Start Jump", pricePLN: 0 }, quantity: 2 },
        { dish: { name: "Not on the menu" }, quantity: 1 },
        { dish: { name: "Cheese Air" }, quantity: -1 },
        { dish: { name: "Loaded Fries — kurczak" }, quantity: 1 },
      ]),
    );

    expect(cart).toEqual([{ dish: testDish, quantity: 2 }]);
  });

  it("returns an empty cart for malformed saved data", () => {
    expect(parseCart("{invalid json")).toEqual([]);
  });

  it("keeps the cart while routes change and restores it after a reload", () => {
    const view = render(
      <CartProvider>
        <CartProbe page="Menu" />
      </CartProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(screen.getByTestId("quantity")).toHaveTextContent("1");

    view.rerender(
      <CartProvider>
        <CartProbe page="O nas" />
      </CartProvider>,
    );
    expect(screen.getByTestId("page")).toHaveTextContent("O nas");
    expect(screen.getByTestId("quantity")).toHaveTextContent("1");

    view.unmount();
    render(
      <CartProvider>
        <CartProbe page="O nas" />
      </CartProvider>,
    );
    expect(screen.getByTestId("quantity")).toHaveTextContent("1");
  });
});

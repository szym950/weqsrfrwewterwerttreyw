import { describe, expect, it } from "vitest";
import { dishes } from "@/lib/menu";
import { orderableMenu } from "../../supabase/functions/_shared/menu";

describe("server order catalog", () => {
  it("matches all priced website dishes and their server-side prices", () => {
    const pricedDishes = dishes.filter((dish) => dish.pricePLN !== null);
    expect(Object.keys(orderableMenu).sort()).toEqual(pricedDishes.map((dish) => dish.name).sort());

    for (const dish of pricedDishes) {
      if (dish.pricePLN === null) {
        throw new Error(`Test dish ${dish.name} must have a price.`);
      }
      expect(orderableMenu[dish.name]).toMatchObject({
        category: dish.category,
        priceGrosz: dish.pricePLN * 100,
      });
    }
  });

  it("routes current food menu items to the kitchen", () => {
    expect(Object.values(orderableMenu).every((dish) => dish.station === "kitchen")).toBe(true);
  });
});

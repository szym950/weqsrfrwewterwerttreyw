import { describe, expect, it } from "vitest";
import { mapMenuRows } from "@/lib/live-menu";

describe("live menu data", () => {
  it("maps category references, prices, images and stations for the website", () => {
    const menu = mapMenuRows(
      [{ id: "category-1", name: "Napoje", sort_order: 1 }],
      [
        {
          id: "dish-1",
          category_id: "category-1",
          name: "Lemoniada",
          image_url: "/lemoniada.png",
          ingredients: ["Cytryna", "Woda"],
          price_pln: 12.5,
          station: "bar",
          sort_order: 1,
        },
        {
          id: "dish-2",
          category_id: "missing-category",
          name: "Ukryta pozycja",
          image_url: "",
          ingredients: [],
          price_pln: null,
          station: "kitchen",
          sort_order: 2,
        },
      ],
    );

    expect(menu.categories).toEqual(["Napoje"]);
    expect(menu.dishes).toEqual([
      {
        id: "dish-1",
        name: "Lemoniada",
        category: "Napoje",
        image: "/lemoniada.png",
        ingredients: ["Cytryna", "Woda"],
        pricePLN: 12.5,
        station: "bar",
      },
    ]);
  });
});

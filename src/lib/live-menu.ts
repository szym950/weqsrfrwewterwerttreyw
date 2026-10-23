import { supabase } from "@/integrations/supabase/client";
import type { Dish } from "@/lib/menu";
import type { Tables } from "@/integrations/supabase/types";

export type LiveMenu = { categories: string[]; dishes: Dish[] };
type CategoryRow = Pick<Tables<"menu_categories">, "id" | "name" | "sort_order">;
type DishRow = Pick<
  Tables<"menu_dishes">,
  | "id"
  | "category_id"
  | "name"
  | "image_url"
  | "ingredients"
  | "price_pln"
  | "station"
  | "sort_order"
>;

export function mapMenuRows(categoryRows: CategoryRow[], dishRows: DishRow[]): LiveMenu {
  const categoriesById = new Map(categoryRows.map((category) => [category.id, category.name]));
  const dishes = dishRows.flatMap((dish): Dish[] => {
    const category = categoriesById.get(dish.category_id);
    if (!category) return [];
    return [
      {
        id: dish.id,
        name: dish.name,
        category,
        image: dish.image_url,
        ingredients: dish.ingredients,
        pricePLN: dish.price_pln === null ? null : Number(dish.price_pln),
        station: dish.station === "bar" ? "bar" : "kitchen",
      },
    ];
  });
  return { categories: categoryRows.map((category) => category.name), dishes };
}

export async function loadLiveMenu(): Promise<LiveMenu> {
  const [categoryResult, dishResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, sort_order")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("menu_dishes")
      .select("id, category_id, name, image_url, ingredients, price_pln, station, sort_order")
      .eq("is_available", true)
      .order("sort_order")
      .order("name"),
  ]);
  if (categoryResult.error) throw categoryResult.error;
  if (dishResult.error) throw dishResult.error;
  return mapMenuRows(categoryResult.data, dishResult.data);
}

export function subscribeToMenuChanges(onChange: () => void) {
  return supabase
    .channel("public-menu")
    .on("postgres_changes", { event: "*", schema: "public", table: "menu_categories" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "menu_dishes" }, onChange)
    .subscribe();
}

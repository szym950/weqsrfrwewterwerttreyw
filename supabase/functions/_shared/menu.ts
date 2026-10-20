export const orderableMenu: Record<
  string,
  { category: string; priceGrosz: number; station: "kitchen" | "bar" }
> = {
  "Start Jump": { category: "Burgery", priceGrosz: 3000, station: "kitchen" },
  "Cheese Air": { category: "Burgery", priceGrosz: 3400, station: "kitchen" },
  "Big Air": { category: "Burgery", priceGrosz: 3800, station: "kitchen" },
  "Wake Crash": { category: "Burgery", priceGrosz: 5000, station: "kitchen" },
  "Spice Jump": { category: "Burgery", priceGrosz: 3100, station: "kitchen" },
  Margherita: { category: "Pizza", priceGrosz: 2900, station: "kitchen" },
  Diavola: { category: "Pizza", priceGrosz: 3500, station: "kitchen" },
  Capriciosa: { category: "Pizza", priceGrosz: 3500, station: "kitchen" },
  Parma: { category: "Pizza", priceGrosz: 4000, station: "kitchen" },
  "Salame Due": { category: "Pizza", priceGrosz: 3800, station: "kitchen" },
  Rucola: { category: "Pizza", priceGrosz: 3400, station: "kitchen" },
  Salame: { category: "Pizza", priceGrosz: 3400, station: "kitchen" },
  Prugna: { category: "Pizza", priceGrosz: 3900, station: "kitchen" },
  "Prosciutto e funghi": { category: "Pizza", priceGrosz: 3300, station: "kitchen" },
  Pollo: { category: "Pizza", priceGrosz: 3600, station: "kitchen" },
  Strips: { category: "Strips", priceGrosz: 2800, station: "kitchen" },
};

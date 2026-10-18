// Zdjęcia dań pochodzą z folderu public/ i są serwowane prosto z głównego adresu (np. /Parma.png).
// Nowe danie wystarczy dodać do listy poniżej, wskazując ścieżkę zdjęcia w public/.
const photo = (file: string) => `/${file}`;

export type Category = 'Wszystko' | 'Pizza' | 'Burgery' | 'Loaded fries' | 'Strips';
export type Dish = { name: string; category: Category; image: string; ingredients: string[]; pricePLN: number | null };
const pizzaBase = ['Sos pomidorowy', 'Mozzarella fior di latte'];
export const dishes: Dish[] = [
  { name: 'Start Jump', category: 'Burgery', image: photo('start_jump.png'), ingredients: ['Bułka maślana', 'Wołowina 100 g', 'Grillowana cebula', '2 × cheddar', 'Boczek', 'Ogórek piklowany', 'Sałata lollo rossa', 'Sos Wake'], pricePLN: 30 },
  { name: 'Cheese Air', category: 'Burgery', image: photo('Cheese_Air.png'), ingredients: ['Bułka maślana', 'Wołowina 100 g', 'Grillowana cebula', '2 × cheddar', 'Boczek', 'Pomidor', 'Rukola', 'Ogórek piklowany', 'Sos BBQ'], pricePLN: 34 },
  { name: 'Big Air', category: 'Burgery', image: photo('Big_Air.png'), ingredients: ['Bułka maślana', 'Panierowany filet z kurczaka 160 g', '2 × cheddar', 'Sałata lollo rossa', 'Pomidor', 'Boczek', 'Sos aioli'], pricePLN: 38 },
  { name: 'Wake Crash', category: 'Burgery', image: photo('Wake_Crash.png'), ingredients: ['Bułka maślana', '3 × wołowina 100 g', 'Grillowana cebula', '6 × cheddar', '2 × boczek', 'Sałata lollo rossa', 'Ogórek piklowany', 'Sos BBQ'], pricePLN: 50 },
  { name: 'Spice Jump', category: 'Burgery', image: photo('Spice_Jump.png'), ingredients: ['Bułka maślana', 'Wołowina 100 g', 'Chutney z czerwonej cebuli', '2 × cheddar', 'Jalapeño', 'Sałata lollo rossa', 'Ogórek piklowany', 'Sos chipotle'], pricePLN: 31 },
  { name: 'Margherita', category: 'Pizza', image: photo('Margherita.png'), ingredients: [...pizzaBase, 'Bazylia'], pricePLN: 29 },
  { name: 'Diavola', category: 'Pizza', image: photo('Diavola.png'), ingredients: [...pizzaBase, 'Spinata picante', 'Oliwki', 'Jalapeño'], pricePLN: 35 },
  { name: 'Capriciosa', category: 'Pizza', image: photo('Capriciosa.png'), ingredients: [...pizzaBase, 'Prosciutto cotto', 'Oliwki'], pricePLN: 35 },
  { name: 'Parma', category: 'Pizza', image: photo('Parma.png'), ingredients: [...pizzaBase, 'Prosciutto crudo', 'Rukola', 'Pomidorki koktajlowe', 'Grana Padano'], pricePLN: 40 },
  { name: 'Salame Due', category: 'Pizza', image: photo('Salame_Due.png'), ingredients: [...pizzaBase, 'Salami Napoli', 'Spianata piccante', 'Czosnek'], pricePLN: 38 },
  { name: 'Rucola', category: 'Pizza', image: photo('Rucola.png'), ingredients: [...pizzaBase, 'Pomidorki koktajlowe', 'Rukola', 'Grana Padano'], pricePLN: 34 },
  { name: 'Salame', category: 'Pizza', image: photo('Salame.png'), ingredients: [...pizzaBase, 'Salami Napoli', 'Cebula', 'Czosnek'], pricePLN: 34 },
  { name: 'Prugna', category: 'Pizza', image: photo('Prugna.png'), ingredients: [...pizzaBase, 'Boczek', 'Pomidorki koktajlowe', 'Jalapeño'], pricePLN: 39 },
  { name: 'Prosciutto e funghi', category: 'Pizza', image: photo('Prosciutto_e_funghi.png'), ingredients: [...pizzaBase, 'Prosciutto cotto', 'Pieczarki'], pricePLN: 33 },
  { name: 'Pollo', category: 'Pizza', image: photo('Pollo.png'), ingredients: [...pizzaBase, 'Kurczak', 'Pieczarki', 'Kukurydza', 'Cebula'], pricePLN: 36 },
  { name: 'Loaded Fries — kurczak', category: 'Loaded fries', image: photo('Loaded_Fries.png'), ingredients: ['Frytki', 'Grillowany kurczak 150 g', 'Sos cheddar', 'Kukurydza', 'Szczypiorek'], pricePLN: null },
  { name: 'Loaded Fries — kurczak i wołowina', category: 'Loaded fries', image: photo('Loaded_Fries1.png'), ingredients: ['Frytki', 'Grillowany kurczak 150 g', 'Wołowina 100 g', 'Sos cheddar', 'Kukurydza', 'Szczypiorek'], pricePLN: null },
  { name: 'Strips', category: 'Strips', image: photo('Strips.png'), ingredients: ['Frytki', 'Panierowane stripsy z fileta 150 g', 'Sos czosnkowy'], pricePLN: 28 },
];
export const categories: Category[] = ['Wszystko', 'Burgery', 'Pizza', 'Loaded fries', 'Strips'];

export const formatPrice = (pricePLN: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(pricePLN);

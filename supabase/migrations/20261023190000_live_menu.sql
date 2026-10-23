create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_dishes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete restrict,
  name text not null unique check (length(trim(name)) between 1 and 120),
  image_url text not null default '',
  ingredients text[] not null default '{}',
  price_pln numeric(10, 2) check (price_pln is null or price_pln >= 0),
  station text not null default 'kitchen' check (station in ('kitchen', 'bar')),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_categories enable row level security;
alter table public.menu_dishes enable row level security;

grant select on public.menu_categories, public.menu_dishes to anon, authenticated;
grant insert, update, delete on public.menu_categories, public.menu_dishes to authenticated;

create policy "Anyone can read active menu categories"
  on public.menu_categories for select to anon, authenticated
  using (
    is_active
    or exists (select 1 from public.staff_members where user_id = auth.uid())
  );
create policy "Staff can create menu categories"
  on public.menu_categories for insert to authenticated
  with check (exists (select 1 from public.staff_members where user_id = auth.uid()));
create policy "Staff can update menu categories"
  on public.menu_categories for update to authenticated
  using (exists (select 1 from public.staff_members where user_id = auth.uid()))
  with check (exists (select 1 from public.staff_members where user_id = auth.uid()));
create policy "Staff can delete menu categories"
  on public.menu_categories for delete to authenticated
  using (exists (select 1 from public.staff_members where user_id = auth.uid()));

create policy "Anyone can read available menu dishes"
  on public.menu_dishes for select to anon, authenticated
  using (
    is_available
    or exists (select 1 from public.staff_members where user_id = auth.uid())
  );
create policy "Staff can create menu dishes"
  on public.menu_dishes for insert to authenticated
  with check (exists (select 1 from public.staff_members where user_id = auth.uid()));
create policy "Staff can update menu dishes"
  on public.menu_dishes for update to authenticated
  using (exists (select 1 from public.staff_members where user_id = auth.uid()))
  with check (exists (select 1 from public.staff_members where user_id = auth.uid()));
create policy "Staff can delete menu dishes"
  on public.menu_dishes for delete to authenticated
  using (exists (select 1 from public.staff_members where user_id = auth.uid()));

create or replace function public.set_menu_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_menu_categories_updated_at
  before update on public.menu_categories
  for each row execute function public.set_menu_updated_at();
create trigger set_menu_dishes_updated_at
  before update on public.menu_dishes
  for each row execute function public.set_menu_updated_at();

insert into public.menu_categories (name, sort_order) values
  ('Burgery', 1),
  ('Pizza', 2),
  ('Loaded fries', 3),
  ('Strips', 4)
on conflict (name) do nothing;

insert into public.menu_dishes
  (category_id, name, image_url, ingredients, price_pln, station, sort_order)
select c.id, d.name, d.image_url, d.ingredients, d.price_pln, 'kitchen', d.sort_order
from (values
  ('Burgery', 'Start Jump', '/start_jump.png', array['Bułka maślana', 'Wołowina 100 g', 'Grillowana cebula', '2 × cheddar', 'Boczek', 'Ogórek piklowany', 'Sałata lollo rossa', 'Sos Wake']::text[], 30.00::numeric, 1),
  ('Burgery', 'Cheese Air', '/Cheese_Air.png', array['Bułka maślana', 'Wołowina 100 g', 'Grillowana cebula', '2 × cheddar', 'Boczek', 'Pomidor', 'Rukola', 'Ogórek piklowany', 'Sos BBQ']::text[], 34.00::numeric, 2),
  ('Burgery', 'Big Air', '/Big_Air.png', array['Bułka maślana', 'Panierowany filet z kurczaka 160 g', '2 × cheddar', 'Sałata lollo rossa', 'Pomidor', 'Boczek', 'Sos aioli']::text[], 38.00::numeric, 3),
  ('Burgery', 'Wake Crash', '/Wake_Crash.png', array['Bułka maślana', '3 × wołowina 100 g', 'Grillowana cebula', '6 × cheddar', '2 × boczek', 'Sałata lollo rossa', 'Ogórek piklowany', 'Sos BBQ']::text[], 50.00::numeric, 4),
  ('Burgery', 'Spice Jump', '/Spice_Jump.png', array['Bułka maślana', 'Wołowina 100 g', 'Chutney z czerwonej cebuli', '2 × cheddar', 'Jalapeño', 'Sałata lollo rossa', 'Ogórek piklowany', 'Sos chipotle']::text[], 31.00::numeric, 5),
  ('Pizza', 'Margherita', '/Margherita.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Bazylia']::text[], 29.00::numeric, 1),
  ('Pizza', 'Diavola', '/Diavola.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Spinata picante', 'Oliwki', 'Jalapeño']::text[], 35.00::numeric, 2),
  ('Pizza', 'Capriciosa', '/Capriciosa.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Prosciutto cotto', 'Oliwki']::text[], 35.00::numeric, 3),
  ('Pizza', 'Parma', '/Parma.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Prosciutto crudo', 'Rukola', 'Pomidorki koktajlowe', 'Grana Padano']::text[], 40.00::numeric, 4),
  ('Pizza', 'Salame Due', '/Salame_Due.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Salami Napoli', 'Spianata piccante', 'Czosnek']::text[], 38.00::numeric, 5),
  ('Pizza', 'Rucola', '/Rucola.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Pomidorki koktajlowe', 'Rukola', 'Grana Padano']::text[], 34.00::numeric, 6),
  ('Pizza', 'Salame', '/Salame.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Salami Napoli', 'Cebula', 'Czosnek']::text[], 34.00::numeric, 7),
  ('Pizza', 'Prugna', '/Prugna.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Boczek', 'Pomidorki koktajlowe', 'Jalapeño']::text[], 39.00::numeric, 8),
  ('Pizza', 'Prosciutto e funghi', '/Prosciutto_e_funghi.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Prosciutto cotto', 'Pieczarki']::text[], 33.00::numeric, 9),
  ('Pizza', 'Pollo', '/Pollo.png', array['Sos pomidorowy', 'Mozzarella fior di latte', 'Kurczak', 'Pieczarki', 'Kukurydza', 'Cebula']::text[], 36.00::numeric, 10),
  ('Loaded fries', 'Loaded Fries — kurczak', '/Loaded_Fries.png', array['Frytki', 'Grillowany kurczak 150 g', 'Sos cheddar', 'Kukurydza', 'Szczypiorek']::text[], null::numeric, 1),
  ('Loaded fries', 'Loaded Fries — kurczak i wołowina', '/Loaded_Fries1.png', array['Frytki', 'Grillowany kurczak 150 g', 'Wołowina 100 g', 'Sos cheddar', 'Kukurydza', 'Szczypiorek']::text[], null::numeric, 2),
  ('Strips', 'Strips', '/Strips.png', array['Frytki', 'Panierowane stripsy z fileta 150 g', 'Sos czosnkowy']::text[], 28.00::numeric, 1)
) as d(category, name, image_url, ingredients, price_pln, sort_order)
join public.menu_categories c on c.name = d.category
on conflict (name) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can read menu images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'menu-images');
create policy "Staff can upload menu images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and exists (select 1 from public.staff_members where user_id = auth.uid())
  );
create policy "Staff can update menu images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (select 1 from public.staff_members where user_id = auth.uid())
  )
  with check (
    bucket_id = 'menu-images'
    and exists (select 1 from public.staff_members where user_id = auth.uid())
  );
create policy "Staff can delete menu images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (select 1 from public.staff_members where user_id = auth.uid())
  );

do $$
begin
  alter publication supabase_realtime add table public.menu_categories;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.menu_dishes;
exception when duplicate_object then
  null;
end;
$$;

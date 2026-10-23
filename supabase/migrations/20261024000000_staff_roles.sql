alter table public.staff_members
  add column role text not null default 'orders'
  check (role in ('administrator', 'menu_editor', 'orders'));

update public.staff_members
set role = 'administrator';

create or replace function public.has_staff_role(_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_members
    where user_id = auth.uid()
      and role = any(_roles)
  );
$$;

revoke all on function public.has_staff_role(text[]) from public;
grant execute on function public.has_staff_role(text[]) to anon, authenticated;

drop policy "Staff can read orders" on public.orders;
create policy "Order staff can read orders"
  on public.orders for select to authenticated
  using (public.has_staff_role(array['administrator', 'orders']));

drop policy "Staff can update order status" on public.orders;
create policy "Order staff can update order status"
  on public.orders for update to authenticated
  using (public.has_staff_role(array['administrator', 'orders']))
  with check (public.has_staff_role(array['administrator', 'orders']));

drop policy "Staff can read order items" on public.order_items;
create policy "Order staff can read order items"
  on public.order_items for select to authenticated
  using (public.has_staff_role(array['administrator', 'orders']));

drop policy "Anyone can read active menu categories" on public.menu_categories;
create policy "Anyone can read active menu categories"
  on public.menu_categories for select to anon, authenticated
  using (
    is_active
    or public.has_staff_role(array['administrator', 'menu_editor'])
  );

drop policy "Staff can create menu categories" on public.menu_categories;
create policy "Menu editors can create menu categories"
  on public.menu_categories for insert to authenticated
  with check (public.has_staff_role(array['administrator', 'menu_editor']));

drop policy "Staff can update menu categories" on public.menu_categories;
create policy "Menu editors can update menu categories"
  on public.menu_categories for update to authenticated
  using (public.has_staff_role(array['administrator', 'menu_editor']))
  with check (public.has_staff_role(array['administrator', 'menu_editor']));

drop policy "Staff can delete menu categories" on public.menu_categories;
create policy "Menu editors can delete menu categories"
  on public.menu_categories for delete to authenticated
  using (public.has_staff_role(array['administrator', 'menu_editor']));

drop policy "Anyone can read available menu dishes" on public.menu_dishes;
create policy "Anyone can read available menu dishes"
  on public.menu_dishes for select to anon, authenticated
  using (
    is_available
    or public.has_staff_role(array['administrator', 'menu_editor'])
  );

drop policy "Staff can create menu dishes" on public.menu_dishes;
create policy "Menu editors can create menu dishes"
  on public.menu_dishes for insert to authenticated
  with check (public.has_staff_role(array['administrator', 'menu_editor']));

drop policy "Staff can update menu dishes" on public.menu_dishes;
create policy "Menu editors can update menu dishes"
  on public.menu_dishes for update to authenticated
  using (public.has_staff_role(array['administrator', 'menu_editor']))
  with check (public.has_staff_role(array['administrator', 'menu_editor']));

drop policy "Staff can delete menu dishes" on public.menu_dishes;
create policy "Menu editors can delete menu dishes"
  on public.menu_dishes for delete to authenticated
  using (public.has_staff_role(array['administrator', 'menu_editor']));

drop policy "Staff can upload menu images" on storage.objects;
create policy "Menu editors can upload menu images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and public.has_staff_role(array['administrator', 'menu_editor'])
  );

drop policy "Staff can update menu images" on storage.objects;
create policy "Menu editors can update menu images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and public.has_staff_role(array['administrator', 'menu_editor'])
  )
  with check (
    bucket_id = 'menu-images'
    and public.has_staff_role(array['administrator', 'menu_editor'])
  );

drop policy "Staff can delete menu images" on storage.objects;
create policy "Menu editors can delete menu images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and public.has_staff_role(array['administrator', 'menu_editor'])
  );

drop policy "Staff can manage their own push tokens" on public.staff_push_tokens;
create policy "Order staff can manage their own push tokens"
  on public.staff_push_tokens
  for all
  to authenticated
  using (
    user_id = auth.uid()
    and public.has_staff_role(array['administrator', 'orders'])
  )
  with check (
    user_id = auth.uid()
    and public.has_staff_role(array['administrator', 'orders'])
  );

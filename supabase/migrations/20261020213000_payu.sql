alter table public.orders
  drop constraint orders_payment_method_check,
  drop constraint orders_status_check,
  drop constraint orders_check;

alter table public.orders
  add column customer_email text,
  add column payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'pending', 'paid', 'failed')),
  add column payu_order_id text,
  add column payu_redirect_url text,
  add constraint orders_payment_method_check
    check (payment_method in ('cash_delivery', 'onsite', 'payu')),
  add constraint orders_status_check
    check (status in ('awaiting_payment', 'new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  add constraint orders_payment_fulfillment_check
    check (
      (fulfillment = 'delivery' and delivery_address is not null and payment_method in ('cash_delivery', 'payu'))
      or (fulfillment = 'pickup' and delivery_address is null and payment_method = 'onsite')
    ),
  add constraint orders_payu_email_check
    check (payment_method <> 'payu' or customer_email is not null);

alter table public.orders
  add constraint orders_payment_status_check
  check (
    (payment_method = 'payu' and payment_status in ('pending', 'paid', 'failed'))
    or (payment_method <> 'payu' and payment_status = 'not_required')
  );

drop function public.create_web_order(jsonb, jsonb);

create function public.create_web_order(p_order jsonb, p_items jsonb)
returns table (
  id uuid,
  order_number bigint,
  total numeric(10, 2),
  payment_status text,
  payu_order_id text,
  payu_redirect_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_order_id uuid;
  created_order_number bigint;
  created_order_total numeric(10, 2);
  created_payment_status text;
  existing_order public.orders%rowtype;
begin
  select * into existing_order
  from public.orders
  where idempotency_key = (p_order->>'idempotency_key')::uuid;

  if found then
    return query select
      existing_order.id,
      existing_order.order_number,
      existing_order.total,
      existing_order.payment_status,
      existing_order.payu_order_id,
      existing_order.payu_redirect_url;
    return;
  end if;

  insert into public.orders (
    idempotency_key,
    customer_name,
    customer_email,
    customer_phone,
    fulfillment,
    delivery_address,
    payment_method,
    payment_status,
    status,
    subtotal,
    delivery_cost,
    total
  ) values (
    (p_order->>'idempotency_key')::uuid,
    p_order->>'customer_name',
    nullif(p_order->>'customer_email', ''),
    p_order->>'customer_phone',
    p_order->>'fulfillment',
    nullif(p_order->>'delivery_address', ''),
    p_order->>'payment_method',
    case when p_order->>'payment_method' = 'payu' then 'pending' else 'not_required' end,
    case when p_order->>'payment_method' = 'payu' then 'awaiting_payment' else 'new' end,
    (p_order->>'subtotal')::numeric,
    (p_order->>'delivery_cost')::numeric,
    (p_order->>'total')::numeric
  )
  on conflict (idempotency_key) do nothing
  returning orders.id, orders.order_number, orders.total, orders.payment_status
    into created_order_id, created_order_number, created_order_total, created_payment_status;

  if created_order_id is null then
    select * into existing_order
    from public.orders
    where idempotency_key = (p_order->>'idempotency_key')::uuid;
    return query select
      existing_order.id,
      existing_order.order_number,
      existing_order.total,
      existing_order.payment_status,
      existing_order.payu_order_id,
      existing_order.payu_redirect_url;
    return;
  end if;

  insert into public.order_items (
    order_id, dish_name, category, station, quantity, unit_price, line_total
  )
  select
    created_order_id,
    item->>'dish_name',
    item->>'category',
    item->>'station',
    (item->>'quantity')::integer,
    (item->>'unit_price')::numeric,
    (item->>'line_total')::numeric
  from jsonb_array_elements(p_items) as item;

  return query select
    created_order_id,
    created_order_number,
    created_order_total,
    created_payment_status,
    null::text,
    null::text;
end;
$$;

create or replace function public.save_payu_redirect(
  p_order_id uuid,
  p_payu_order_id text,
  p_redirect_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set payu_order_id = coalesce(payu_order_id, p_payu_order_id),
      payu_redirect_url = coalesce(payu_redirect_url, p_redirect_url)
  where id = p_order_id
    and payment_method = 'payu'
    and payment_status = 'pending';
  return found;
end;
$$;

create or replace function public.apply_payu_notification(
  p_order_id uuid,
  p_payu_order_id text,
  p_total_grosz bigint,
  p_payu_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
begin
  select * into current_order
  from public.orders
  where id = p_order_id
    and payment_method = 'payu'
  for update;

  if not found
    or current_order.payu_order_id is distinct from p_payu_order_id
    or round(current_order.total * 100)::bigint <> p_total_grosz then
    return false;
  end if;

  if current_order.payment_status <> 'pending' then
    return true;
  end if;

  if p_payu_status = 'COMPLETED' then
    update public.orders
    set payment_status = 'paid', status = 'new'
    where id = p_order_id;
    return true;
  end if;

  if p_payu_status = 'CANCELED' then
    update public.orders
    set payment_status = 'failed', status = 'cancelled'
    where id = p_order_id and status = 'awaiting_payment';
    return found;
  end if;

  return true;
end;
$$;

revoke all on function public.create_web_order(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.save_payu_redirect(uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_payu_notification(uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.create_web_order(jsonb, jsonb) to service_role;
grant execute on function public.save_payu_redirect(uuid, text, text) to service_role;
grant execute on function public.apply_payu_notification(uuid, text, bigint, text) to service_role;

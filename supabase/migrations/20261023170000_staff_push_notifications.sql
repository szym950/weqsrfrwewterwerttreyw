alter table public.orders
  add column push_notification_claimed_at timestamptz,
  add column push_notification_sent_at timestamptz;

create table public.staff_push_tokens (
  expo_push_token text primary key,
  user_id uuid not null references public.staff_members(user_id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.staff_push_tokens enable row level security;

grant select, insert, update, delete on public.staff_push_tokens to authenticated;

create policy "Staff can manage their own push tokens"
  on public.staff_push_tokens
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.claim_order_push_notification(p_order_id uuid)
returns table (order_number bigint)
language sql
security definer
set search_path = public
as $$
  update public.orders
  set push_notification_claimed_at = now()
  where id = p_order_id
    and status = 'new'
    and push_notification_sent_at is null
    and (
      push_notification_claimed_at is null
      or push_notification_claimed_at < now() - interval '2 minutes'
    )
  returning public.orders.order_number;
$$;

create or replace function public.complete_order_push_notification(p_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.orders
    set push_notification_sent_at = now(),
        push_notification_claimed_at = null
    where id = p_order_id
      and push_notification_claimed_at is not null
      and push_notification_sent_at is null
    returning 1
  )
  select exists (select 1 from updated);
$$;

create or replace function public.release_order_push_notification(p_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.orders
    set push_notification_claimed_at = null
    where id = p_order_id
      and push_notification_claimed_at is not null
      and push_notification_sent_at is null
    returning 1
  )
  select exists (select 1 from updated);
$$;

revoke all on function public.claim_order_push_notification(uuid) from public, anon, authenticated;
revoke all on function public.complete_order_push_notification(uuid) from public, anon, authenticated;
revoke all on function public.release_order_push_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_order_push_notification(uuid) to service_role;
grant execute on function public.complete_order_push_notification(uuid) to service_role;
grant execute on function public.release_order_push_notification(uuid) to service_role;

-- Refund flow: add the 'refunded' state and allow the paid -> refunded transition.
-- Apply with the Supabase MCP apply_migration or the SQL editor before deploying
-- the refund-order function.

-- 1) Allow 'refunded' as a payment_status.
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending','awaiting_payment','paid','failed','expired','refunded'));

-- 2) set_order_status: permit paid -> refunded (only via source 'refund'),
--    while keeping idempotency and the no-downgrade guard for every other case.
create or replace function public.set_order_status(p_reference text, p_new_status text, p_source text)
returns table(order_id uuid, old_status text, new_status text, changed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_old text;
begin
  select id, payment_status into v_id, v_old
    from public.orders where reference = p_reference for update;
  if v_id is null then
    return query select null::uuid, null::text, p_new_status, false; return;
  end if;
  if v_old = p_new_status then                                   -- idempotent
    return query select v_id, v_old, v_old, false; return;
  end if;
  -- Protect a paid order from any change EXCEPT an explicit refund.
  if v_old = 'paid' and not (p_new_status = 'refunded' and p_source = 'refund') then
    return query select v_id, v_old, v_old, false; return;
  end if;
  perform set_config('app.payment_source', coalesce(p_source, 'system'), true);
  update public.orders set payment_status = p_new_status where id = v_id;
  return query select v_id, v_old, p_new_status, true;
end;
$$;

revoke all on function public.set_order_status(text, text, text) from public, anon, authenticated;
grant execute on function public.set_order_status(text, text, text) to service_role;

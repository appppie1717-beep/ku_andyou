create table if not exists public.live_alert_state (
  id text primary key,
  was_live boolean not null default false,
  alert_pending boolean not null default false,
  alert_in_flight_until timestamptz,
  last_checked_at timestamptz,
  last_live_started_at timestamptz,
  last_alert_sent_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.live_alert_state enable row level security;

grant select, insert, update on public.live_alert_state to service_role;

create or replace function public.claim_live_start_alert(
  p_state_id text,
  p_is_live boolean
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  current_state public.live_alert_state%rowtype;
  inserted_id text;
  should_alert boolean := false;
  reason text := 'not_live';
begin
  insert into public.live_alert_state (id)
  values (p_state_id)
  on conflict (id) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    update public.live_alert_state
    set
      was_live = p_is_live is true,
      alert_pending = false,
      alert_in_flight_until = null,
      last_checked_at = now(),
      last_live_started_at = case when p_is_live is true then now() else null end,
      last_error = null,
      updated_at = now()
    where id = p_state_id;

    return jsonb_build_object(
      'should_alert', false,
      'reason', case when p_is_live is true then 'initialized_live' else 'initialized_not_live' end
    );
  end if;

  select *
  into current_state
  from public.live_alert_state
  where id = p_state_id
  for update;

  if p_is_live is not true then
    update public.live_alert_state
    set
      was_live = false,
      alert_pending = false,
      alert_in_flight_until = null,
      last_checked_at = now(),
      last_error = null,
      updated_at = now()
    where id = p_state_id;

    return jsonb_build_object(
      'should_alert', false,
      'reason', 'not_live'
    );
  end if;

  if current_state.was_live is false then
    update public.live_alert_state
    set
      was_live = true,
      alert_pending = false,
      alert_in_flight_until = now() + interval '2 minutes',
      last_checked_at = now(),
      last_live_started_at = now(),
      last_error = null,
      updated_at = now()
    where id = p_state_id;

    current_state.was_live := true;
    current_state.alert_pending := false;
    current_state.alert_in_flight_until := now() + interval '2 minutes';
    should_alert := true;
    reason := 'live_started';

    return jsonb_build_object(
      'should_alert', should_alert,
      'reason', reason
    );
  elsif current_state.alert_pending is true then
    reason := 'retry_pending_alert';
  else
    update public.live_alert_state
    set
      last_checked_at = now(),
      last_error = null,
      updated_at = now()
    where id = p_state_id;

    return jsonb_build_object(
      'should_alert', false,
      'reason', 'already_alerted'
    );
  end if;

  if current_state.alert_pending is true
    and (
      current_state.alert_in_flight_until is null
      or current_state.alert_in_flight_until <= now()
    )
  then
    should_alert := true;

    update public.live_alert_state
    set
      alert_pending = false,
      alert_in_flight_until = now() + interval '2 minutes',
      last_checked_at = now(),
      last_error = null,
      updated_at = now()
    where id = p_state_id;
  else
    reason := 'alert_in_flight';
  end if;

  return jsonb_build_object(
    'should_alert', should_alert,
    'reason', reason
  );
end;
$$;

create or replace function public.mark_live_start_alert_sent(
  p_state_id text
)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  update public.live_alert_state
  set
    was_live = true,
    alert_pending = false,
    alert_in_flight_until = null,
    last_alert_sent_at = now(),
    last_error = null,
    updated_at = now()
  where id = p_state_id;

  return jsonb_build_object(
    'ok', true
  );
end;
$$;

create or replace function public.mark_live_start_alert_failed(
  p_state_id text,
  p_error text
)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  update public.live_alert_state
  set
    was_live = true,
    alert_pending = true,
    alert_in_flight_until = null,
    last_error = left(coalesce(p_error, 'Discord alert failed'), 500),
    updated_at = now()
  where id = p_state_id;

  return jsonb_build_object(
    'ok', true
  );
end;
$$;

revoke all on function public.claim_live_start_alert(text, boolean) from public;
revoke all on function public.claim_live_start_alert(text, boolean) from anon;
revoke all on function public.claim_live_start_alert(text, boolean) from authenticated;
grant execute on function public.claim_live_start_alert(text, boolean) to service_role;

revoke all on function public.mark_live_start_alert_sent(text) from public;
revoke all on function public.mark_live_start_alert_sent(text) from anon;
revoke all on function public.mark_live_start_alert_sent(text) from authenticated;
grant execute on function public.mark_live_start_alert_sent(text) to service_role;

revoke all on function public.mark_live_start_alert_failed(text, text) from public;
revoke all on function public.mark_live_start_alert_failed(text, text) from anon;
revoke all on function public.mark_live_start_alert_failed(text, text) from authenticated;
grant execute on function public.mark_live_start_alert_failed(text, text) to service_role;

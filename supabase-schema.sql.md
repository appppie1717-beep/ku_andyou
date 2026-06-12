create or replace function public.replace_site_content(
  p_settings jsonb,
  p_clips jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  saved_settings jsonb;
  saved_clips jsonb;
begin
  insert into public.site_settings (
    id,
    hero_lead,
    stream_url,
    schedule_note,
    footer_text,
    social_links,
    profile_items,
    schedule_items
  )
  values (
    'main',
    coalesce(p_settings->>'hero_lead', ''),
    coalesce(p_settings->>'stream_url', ''),
    coalesce(p_settings->>'schedule_note', ''),
    coalesce(p_settings->>'footer_text', ''),
    coalesce(p_settings->'social_links', '[]'::jsonb),
    coalesce(p_settings->'profile_items', '[]'::jsonb),
    coalesce(p_settings->'schedule_items', '[]'::jsonb)
  )
  on conflict (id) do update
  set
    hero_lead = excluded.hero_lead,
    stream_url = excluded.stream_url,
    schedule_note = excluded.schedule_note,
    footer_text = excluded.footer_text,
    social_links = excluded.social_links,
    profile_items = excluded.profile_items,
    schedule_items = excluded.schedule_items;

  delete from public.clips where true;

  insert into public.clips (
    title,
    url,
    video,
    embed_url,
    thumbnail,
    sort_order,
    is_visible
  )
  select
    coalesce(item->>'title', '제목 없는 클립'),
    coalesce(item->>'url', ''),
    coalesce(item->>'video', ''),
    coalesce(item->>'embed_url', ''),
    coalesce(item->>'thumbnail', ''),
    coalesce((item->>'sort_order')::integer, row_number() over ()),
    coalesce((item->>'is_visible')::boolean, true)
  from jsonb_array_elements(coalesce(p_clips, '[]'::jsonb)) as item;

  select to_jsonb(s)
  into saved_settings
  from public.site_settings s
  where s.id = 'main';

  select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order, c.id), '[]'::jsonb)
  into saved_clips
  from public.clips c;

  return jsonb_build_object(
    'settings', saved_settings,
    'clips', saved_clips
  );
end;
$$;

revoke all on function public.replace_site_content(jsonb, jsonb) from public;
revoke all on function public.replace_site_content(jsonb, jsonb) from anon;
revoke all on function public.replace_site_content(jsonb, jsonb) from authenticated;
grant execute on function public.replace_site_content(jsonb, jsonb) to service_role;

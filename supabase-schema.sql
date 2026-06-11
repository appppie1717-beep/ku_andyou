-- ku앤유 사이트 편집 데이터베이스 구조를 정의합니다.
create table if not exists public.site_settings (
  id text primary key default 'main',
  hero_lead text not null default '',
  stream_url text not null default '',
  schedule_note text not null default '',
  footer_text text not null default '',
  social_links jsonb not null default '[]'::jsonb,
  profile_items jsonb not null default '[]'::jsonb,
  schedule_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.clips (
  id bigint generated always as identity primary key,
  title text not null,
  url text not null,
  video text not null default '',
  embed_url text not null default '',
  thumbnail text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at
before update on public.site_settings
for each row
execute function public.set_updated_at();

drop trigger if exists set_clips_updated_at on public.clips;
create trigger set_clips_updated_at
before update on public.clips
for each row
execute function public.set_updated_at();

alter table public.site_settings enable row level security;
alter table public.clips enable row level security;

drop policy if exists "site settings are publicly readable" on public.site_settings;
create policy "site settings are publicly readable"
on public.site_settings
for select
to anon, authenticated
using (true);

drop policy if exists "visible clips are publicly readable" on public.clips;
create policy "visible clips are publicly readable"
on public.clips
for select
to anon, authenticated
using (is_visible = true);

grant select on public.site_settings to anon, authenticated;
grant select on public.clips to anon, authenticated;
grant select, insert, update, delete on public.site_settings to service_role;
grant select, insert, update, delete on public.clips to service_role;
grant usage, select on sequence public.clips_id_seq to service_role;

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

  delete from public.clips;

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
  '게임방송 하고싶대',
  'https://chzzk.naver.com/7f43db49e367d87397c3a38d57dad71f',
  '치지직 방송 기준',
  '애플파이 - asoul122@naver.com',
  '[
    {"platform":"x","label":"X","url":"https://x.com/Ku_10617","sort_order":1,"is_visible":true},
    {"platform":"youtube","label":"YouTube","url":"https://www.youtube.com/@ku_10617","sort_order":2,"is_visible":true},
    {"platform":"tiktok","label":"TikTok","url":"https://www.tiktok.com/@ku10617?_t=ZS-9601t6yyScC","sort_order":3,"is_visible":true},
    {"platform":"discord","label":"Discord","url":"https://discord.com/invite/kryKRuhds9","sort_order":4,"is_visible":true}
  ]'::jsonb,
  '[
    {"label":"키","value":"161cm","sort_order":1,"is_visible":true},
    {"label":"좋아하는 음식","value":"냉면","sort_order":2,"is_visible":true},
    {"label":"싫어하는 음식","value":"유부초밥","sort_order":3,"is_visible":true},
    {"label":"취미","value":"시나리오, 그림","sort_order":4,"is_visible":true},
    {"label":"방송 포인트","value":"말이 많다","sort_order":5,"is_visible":true},
    {"label":"취향","value":"어른 취향 토크","sort_order":6,"is_visible":true}
  ]'::jsonb,
  '[
    {"day":"화요일","time":"오후 6시 - 12시","sort_order":1,"is_visible":true},
    {"day":"목요일","time":"오후 8시 - 10시","sort_order":2,"is_visible":true},
    {"day":"토요일","time":"오후 8시 - 9시","sort_order":3,"is_visible":true}
  ]'::jsonb
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

insert into public.clips (title, url, video, thumbnail, sort_order, is_visible)
select
  '따먹어야겠다',
  'https://chzzk.naver.com/7f43db49e367d87397c3a38d57dad71f',
  'clips/andyou-clip-01.mp4',
  '',
  1,
  true
where not exists (
  select 1
  from public.clips
);

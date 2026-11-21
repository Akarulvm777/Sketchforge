-- Sketchforge online features: run this once in Supabase (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Safe to run again. Everything is protected by row level security: people only see / change their own data,
-- except shared brushes & themes, which everyone can browse.

-- 1. Settings sync: one row per user with their app settings (pens, layout, Custom P theme, ...)
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Shared brushes and themes (community library)
create table if not exists public.shared_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('brush', 'theme')),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  author text not null default '' check (char_length(author) <= 80),
  file_path text not null,
  file_name text not null,
  size integer not null default 0,
  downloads integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.shared_items enable row level security;
drop policy if exists "anyone can browse" on public.shared_items;
create policy "anyone can browse" on public.shared_items for select to anon, authenticated using (true);
drop policy if exists "share as yourself" on public.shared_items;
create policy "share as yourself" on public.shared_items for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "remove your own" on public.shared_items;
create policy "remove your own" on public.shared_items for delete to authenticated using (auth.uid() = user_id);
create or replace function public.count_download(item uuid) returns void
  language sql security definer set search_path = public as
  $$ update public.shared_items set downloads = downloads + 1 where id = item $$;
grant execute on function public.count_download(uuid) to anon, authenticated;

-- 3. Signing in the installed apps: the website hands a one-time login to the app through a secret code
--    (the code is random, 48+ characters, and the row is deleted when the app picks it up or after 15 minutes).
create table if not exists public.device_links (
  id text primary key check (char_length(id) >= 32),
  refresh_token text not null,
  created_at timestamptz not null default now()
);
alter table public.device_links enable row level security;
drop policy if exists "hand over a login" on public.device_links;
create policy "hand over a login" on public.device_links for insert to authenticated with check (true);
create or replace function public.claim_device_link(link_id text) returns text
  language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  delete from public.device_links where created_at < now() - interval '15 minutes';
  delete from public.device_links where id = link_id returning refresh_token into tok;
  return tok;
end $$;
grant execute on function public.claim_device_link(text) to anon, authenticated;

-- 4. File storage: "docs" = each person's cloud drawings (private), "shared" = community brushes / themes (public)
insert into storage.buckets (id, name, public, file_size_limit)
  values ('docs', 'docs', false, 52428800), ('shared', 'shared', true, 20971520)
  on conflict (id) do nothing;
drop policy if exists "own docs read" on storage.objects;
create policy "own docs read" on storage.objects for select to authenticated
  using (bucket_id = 'docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own docs write" on storage.objects;
create policy "own docs write" on storage.objects for insert to authenticated
  with check (bucket_id = 'docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own docs update" on storage.objects;
create policy "own docs update" on storage.objects for update to authenticated
  using (bucket_id = 'docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own docs delete" on storage.objects;
create policy "own docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "share files" on storage.objects;
create policy "share files" on storage.objects for insert to authenticated
  with check (bucket_id = 'shared' and (storage.foldername(name))[1] = auth.uid()::text);
-- uploads can replace a file of your own (upsert): Storage then also needs to read and update it
drop policy if exists "read own shared files" on storage.objects;
create policy "read own shared files" on storage.objects for select to authenticated
  using (bucket_id = 'shared' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "update own shared files" on storage.objects;
create policy "update own shared files" on storage.objects for update to authenticated
  using (bucket_id = 'shared' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "unshare files" on storage.objects;
create policy "unshare files" on storage.objects for delete to authenticated
  using (bucket_id = 'shared' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Community (website › Community): art and time-lapse videos join brushes and themes in shared_items, and
--    comments: a comment on a shared item (item_id) or, without item_id, a review / idea for Sketchforge.
--    Everyone can read; only signed-in people post, under their own name; people remove only their own posts.
alter table public.shared_items drop constraint if exists shared_items_kind_check;
alter table public.shared_items add constraint shared_items_kind_check check (kind in ('brush', 'theme', 'art', 'timelapse'));
update storage.buckets set file_size_limit = 104857600 where id = 'shared';  -- 100 MB (time-lapse videos)
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id uuid references public.shared_items on delete cascade,
  author text not null default '' check (char_length(author) <= 80),
  rating smallint check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
drop policy if exists "anyone can read comments" on public.comments;
create policy "anyone can read comments" on public.comments for select to anon, authenticated using (true);
drop policy if exists "comment as yourself" on public.comments;
create policy "comment as yourself" on public.comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "remove your own comments" on public.comments;
create policy "remove your own comments" on public.comments for delete to authenticated using (auth.uid() = user_id);
create index if not exists comments_item on public.comments (item_id, created_at desc);

-- 6. Access rights for the website and the app (newer Supabase projects do not give them automatically: without these
--    lines posting says "permission denied for table …"). Row level security above still decides which rows.
grant usage on schema public to anon, authenticated;
grant select on public.shared_items, public.comments to anon, authenticated;
grant insert, delete on public.shared_items, public.comments to authenticated;
grant select, insert, update on public.settings to authenticated;
grant insert on public.device_links to authenticated;
grant execute on function public.count_download(uuid) to anon, authenticated;
grant execute on function public.claim_device_link(text) to anon, authenticated;

-- 7. Profiles, "made it myself / credit", reshares and likes (website › Shared, profile.html).
create table if not exists public.profiles (
  id uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text not null default '' check (char_length(avatar_url) <= 500),
  bio text not null default '' check (char_length(bio) <= 1000),
  website text not null default '' check (char_length(website) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "anyone can see profiles" on public.profiles;
create policy "anyone can see profiles" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "make your profile" on public.profiles;
create policy "make your profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "edit your profile" on public.profiles;
create policy "edit your profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
alter table public.shared_items add column if not exists origin text not null default 'own';
alter table public.shared_items drop constraint if exists shared_items_origin_check;
alter table public.shared_items add constraint shared_items_origin_check check (origin in ('own', 'other'));
alter table public.shared_items add column if not exists credit text not null default '';
alter table public.shared_items add column if not exists reshare_of uuid references public.shared_items on delete cascade;
create table if not exists public.reactions (
  item_id uuid not null references public.shared_items on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
alter table public.reactions enable row level security;
drop policy if exists "anyone can see reactions" on public.reactions;
create policy "anyone can see reactions" on public.reactions for select to anon, authenticated using (true);
drop policy if exists "react as yourself" on public.reactions;
create policy "react as yourself" on public.reactions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "change your reaction" on public.reactions;
create policy "change your reaction" on public.reactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "remove your reaction" on public.reactions;
create policy "remove your reaction" on public.reactions for delete to authenticated using (auth.uid() = user_id);
grant select on public.profiles, public.reactions to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.reactions to authenticated;

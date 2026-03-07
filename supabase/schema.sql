-- HealMeal Community Schema (Supabase)
-- Run in Supabase SQL Editor

create extension if not exists pgcrypto;

-- reset community tables (safe for demo environment)
drop table if exists public.bookmarks cascade;
drop table if exists public.likes cascade;
drop table if exists public.comments cascade;
drop table if exists public.posts cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  avatar_url text,
  ingredient_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.posts (
  id bigserial primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  image_url text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.comments (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.bookmarks (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index idx_posts_created_at on public.posts(created_at desc);
create index idx_posts_author_id on public.posts(author_id);
create index idx_comments_post_id on public.comments(post_id);
create index idx_comments_author_id on public.comments(author_id);
create index idx_likes_post_id on public.likes(post_id);
create index idx_likes_user_id on public.likes(user_id);
create index idx_bookmarks_post_id on public.bookmarks(post_id);
create index idx_bookmarks_user_id on public.bookmarks(user_id);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;

-- profiles: public read nickname/avatar allowed; write only self
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
on public.profiles
for select
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_delete_self" on public.profiles;
create policy "profiles_delete_self"
on public.profiles
for delete to authenticated
using (auth.uid() = id);

-- posts: public read; authenticated + self for write
drop policy if exists "posts_select_public" on public.posts;
create policy "posts_select_public"
on public.posts
for select
using (true);

drop policy if exists "posts_insert_self" on public.posts;
create policy "posts_insert_self"
on public.posts
for insert to authenticated
with check (auth.uid() = author_id);

drop policy if exists "posts_update_self" on public.posts;
create policy "posts_update_self"
on public.posts
for update to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "posts_delete_self" on public.posts;
create policy "posts_delete_self"
on public.posts
for delete to authenticated
using (auth.uid() = author_id);

-- comments: public read; authenticated + self for write
drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public"
on public.comments
for select
using (true);

drop policy if exists "comments_insert_self" on public.comments;
create policy "comments_insert_self"
on public.comments
for insert to authenticated
with check (auth.uid() = author_id);

drop policy if exists "comments_update_self" on public.comments;
create policy "comments_update_self"
on public.comments
for update to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "comments_delete_self" on public.comments;
create policy "comments_delete_self"
on public.comments
for delete to authenticated
using (auth.uid() = author_id);

-- likes: public read; authenticated + self write
drop policy if exists "likes_select_public" on public.likes;
create policy "likes_select_public"
on public.likes
for select
using (true);

drop policy if exists "likes_insert_self" on public.likes;
create policy "likes_insert_self"
on public.likes
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "likes_delete_self" on public.likes;
create policy "likes_delete_self"
on public.likes
for delete to authenticated
using (auth.uid() = user_id);

-- bookmarks: public read; authenticated + self write
drop policy if exists "bookmarks_select_public" on public.bookmarks;
create policy "bookmarks_select_public"
on public.bookmarks
for select
using (true);

drop policy if exists "bookmarks_insert_self" on public.bookmarks;
create policy "bookmarks_insert_self"
on public.bookmarks
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "bookmarks_delete_self" on public.bookmarks;
create policy "bookmarks_delete_self"
on public.bookmarks
for delete to authenticated
using (auth.uid() = user_id);

-- Storage bucket for post images
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

drop policy if exists "post_images_public_read" on storage.objects;
create policy "post_images_public_read"
on storage.objects
for select
using (bucket_id = 'post-images');

drop policy if exists "post_images_insert_self_folder" on storage.objects;
create policy "post_images_insert_self_folder"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "post_images_update_self_folder" on storage.objects;
create policy "post_images_update_self_folder"
on storage.objects
for update to authenticated
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "post_images_delete_self_folder" on storage.objects;
create policy "post_images_delete_self_folder"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- HealMeal safe RLS policy fix (no table drop)
-- Run in Supabase SQL Editor when publish/comment/like/bookmark hits RLS errors.

alter table if exists public.profiles enable row level security;
alter table if exists public.posts enable row level security;
alter table if exists public.comments enable row level security;
alter table if exists public.likes enable row level security;
alter table if exists public.bookmarks enable row level security;

-- profiles
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
on public.profiles
for select
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_delete_self" on public.profiles;
create policy "profiles_delete_self"
on public.profiles
for delete to authenticated
using (id = auth.uid());

-- posts
drop policy if exists "posts_select_public" on public.posts;
create policy "posts_select_public"
on public.posts
for select
using (true);

drop policy if exists "posts_insert_self" on public.posts;
create policy "posts_insert_self"
on public.posts
for insert to authenticated
with check (author_id = auth.uid());

drop policy if exists "posts_update_self" on public.posts;
create policy "posts_update_self"
on public.posts
for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "posts_delete_self" on public.posts;
create policy "posts_delete_self"
on public.posts
for delete to authenticated
using (author_id = auth.uid());

-- comments
drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public"
on public.comments
for select
using (true);

drop policy if exists "comments_insert_self" on public.comments;
create policy "comments_insert_self"
on public.comments
for insert to authenticated
with check (author_id = auth.uid());

drop policy if exists "comments_update_self" on public.comments;
create policy "comments_update_self"
on public.comments
for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "comments_delete_self" on public.comments;
create policy "comments_delete_self"
on public.comments
for delete to authenticated
using (author_id = auth.uid());

-- likes
drop policy if exists "likes_select_public" on public.likes;
create policy "likes_select_public"
on public.likes
for select
using (true);

drop policy if exists "likes_insert_self" on public.likes;
create policy "likes_insert_self"
on public.likes
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "likes_delete_self" on public.likes;
create policy "likes_delete_self"
on public.likes
for delete to authenticated
using (user_id = auth.uid());

-- bookmarks
drop policy if exists "bookmarks_select_public" on public.bookmarks;
create policy "bookmarks_select_public"
on public.bookmarks
for select
using (true);

drop policy if exists "bookmarks_insert_self" on public.bookmarks;
create policy "bookmarks_insert_self"
on public.bookmarks
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "bookmarks_delete_self" on public.bookmarks;
create policy "bookmarks_delete_self"
on public.bookmarks
for delete to authenticated
using (user_id = auth.uid());

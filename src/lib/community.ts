"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase/browser";

export interface CommunityPostItem {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  imageUrl?: string;
  tags: string[];
  createdAt: string;
  likes: number;
  comments: number;
  bookmarks: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
}

export interface CommunityCommentItem {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface CommunitySession {
  client: SupabaseClient | null;
  user: User | null;
  session: Session | null;
}

interface RawPostRow {
  id: number;
  author_id: string;
  content: string;
  image_url: string | null;
  tags: unknown;
  created_at: string;
}

interface RawCommentRow {
  id: number;
  post_id: number;
  author_id: string;
  content: string;
  created_at: string;
}

const IMAGE_BUCKET = "post-images";

function toNumericPostId(postId: string | number) {
  const id = typeof postId === "number" ? postId : Number(postId);
  if (!Number.isFinite(id)) {
    throw new Error("invalid post id");
  }
  return id;
}

export async function ensureCommunitySession(nickname?: string): Promise<CommunitySession> {
  const client = getSupabaseBrowserClient();
  if (!client) return { client: null, user: null, session: null };

  const currentSessionRes = await client.auth.getSession();
  if (currentSessionRes.error) throw currentSessionRes.error;
  let session = currentSessionRes.data.session;
  if (!session) {
    const signIn = await client.auth.signInAnonymously({
      options: {
        data: {
          nickname: nickname || "康复伙伴"
        }
      }
    });
    if (signIn.error) throw signIn.error;
    session = signIn.data.session || null;
  }

  const user = session?.user || null;
  if (user) {
    const upsertRes = await client.from("profiles").upsert(
      {
        id: user.id,
        nickname: nickname || user.user_metadata?.nickname || "康复伙伴",
        ingredient_prefs: user.user_metadata?.ingredient_prefs || {}
      },
      { onConflict: "id" }
    );
    if (upsertRes.error && process.env.NODE_ENV === "development") {
      console.warn("[community] profiles upsert skipped:", upsertRes.error);
    }
  }

  return { client, user, session };
}

function mapCount(rows: Array<{ post_id: string }>) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.post_id] = (acc[row.post_id] || 0) + 1;
    return acc;
  }, {});
}

function resolveAuthorNickname(row: RawPostRow, profileMap: Map<string, string>) {
  return profileMap.get(row.author_id) || "康复伙伴";
}

// Normalize raw Supabase rows into stable CommunityPostItem shape used by all pages.
async function hydrateCommunityPosts(client: SupabaseClient, rows: RawPostRow[], userId?: string) {
  const posts = rows || [];
  if (posts.length === 0) return [] as CommunityPostItem[];

  const postIds = posts.map((item) => Number(item.id)).filter((item) => Number.isFinite(item));
  const authorIds = Array.from(new Set(posts.map((item) => item.author_id).filter(Boolean)));

  const [profilesRes, likesRes, bookmarksRes, commentsRes] = await Promise.all([
    authorIds.length > 0 ? client.from("profiles").select("id,nickname").in("id", authorIds) : Promise.resolve({ data: [], error: null }),
    postIds.length > 0 ? client.from("likes").select("post_id,user_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
    postIds.length > 0 ? client.from("bookmarks").select("post_id,user_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
    postIds.length > 0 ? client.from("comments").select("post_id,id").in("post_id", postIds) : Promise.resolve({ data: [], error: null })
  ]);

  if (profilesRes.error && process.env.NODE_ENV === "development") {
    console.warn("[community] profiles query skipped:", profilesRes.error);
  }
  if (likesRes.error) throw likesRes.error;
  if (bookmarksRes.error) throw bookmarksRes.error;
  if (commentsRes.error) throw commentsRes.error;

  const profileMap = new Map((profilesRes.data || []).map((item) => [item.id, item.nickname || "康复伙伴"]));
  const likeRows = likesRes.data || [];
  const bookmarkRows = bookmarksRes.data || [];
  const commentRows = commentsRes.data || [];

  const likesByPost = mapCount(likeRows.map((item) => ({ post_id: String(item.post_id) })));
  const bookmarksByPost = mapCount(bookmarkRows.map((item) => ({ post_id: String(item.post_id) })));
  const commentsByPost = mapCount(commentRows.map((item) => ({ post_id: String(item.post_id) })));

  return posts.map((item) => ({
    id: String(item.id),
    authorId: item.author_id,
    authorName: resolveAuthorNickname(item, profileMap),
    content: item.content,
    imageUrl: item.image_url || undefined,
    tags: Array.isArray(item.tags) ? item.tags : [],
    createdAt: item.created_at,
    likes: likesByPost[String(item.id)] || 0,
    comments: commentsByPost[String(item.id)] || 0,
    bookmarks: bookmarksByPost[String(item.id)] || 0,
    likedByMe: Boolean(userId && likeRows.some((row) => String(row.post_id) === String(item.id) && row.user_id === userId)),
    bookmarkedByMe: Boolean(userId && bookmarkRows.some((row) => String(row.post_id) === String(item.id) && row.user_id === userId))
  }));
}

export async function listCommunityPosts(userId?: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return [] as CommunityPostItem[];

  const postRes = await client
    .from("posts")
    .select("id,author_id,content,image_url,tags,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (postRes.error) throw postRes.error;

  return hydrateCommunityPosts(client, (postRes.data || []) as RawPostRow[], userId);
}

export async function listCommunityPostsByIds(postIds: string[], userId?: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return [] as CommunityPostItem[];

  const ids = Array.from(new Set(postIds.map((item) => Number(item)).filter((item) => Number.isFinite(item))));
  if (ids.length === 0) return [];

  const postRes = await client
    .from("posts")
    .select("id,author_id,content,image_url,tags,created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (postRes.error) throw postRes.error;
  return hydrateCommunityPosts(client, (postRes.data || []) as RawPostRow[], userId);
}

export async function getCommunityPostById(postId: string, userId?: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return null as CommunityPostItem | null;
  const numericPostId = toNumericPostId(postId);

  const postRes = await client
    .from("posts")
    .select("id,author_id,content,image_url,tags,created_at")
    .eq("id", numericPostId)
    .maybeSingle();
  if (postRes.error) throw postRes.error;
  if (!postRes.data) return null;

  const hydrated = await hydrateCommunityPosts(client, [postRes.data as RawPostRow], userId);
  return hydrated[0] || null;
}

export async function createCommunityPost(params: {
  userId: string;
  content: string;
  tags: string[];
  imageUrl?: string;
}) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase 未配置");
  const content = params.content.trim();
  if (!content) {
    throw new Error("post content is empty");
  }

  const { data, error } = await client
    .from("posts")
    .insert({
      author_id: params.userId,
      content,
      image_url: params.imageUrl || null,
      tags: params.tags?.length ? params.tags : []
    })
    .select("id,author_id,content,image_url,tags,created_at")
    .single();

  if (error) throw error;
  return {
    id: String(data.id),
    authorId: data.author_id,
    content: data.content,
    imageUrl: data.image_url || undefined,
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: data.created_at
  };
}

export async function uploadPostImage(userId: string, file: File) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase 未配置");

  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await client.storage.from(IMAGE_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;

  const publicUrl = client.storage.from(IMAGE_BUCKET).getPublicUrl(filePath).data.publicUrl;
  return publicUrl;
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase 未配置");
  const numericPostId = toNumericPostId(postId);
  let error: unknown = null;
  if (liked) {
    error = (await client.from("likes").delete().eq("post_id", numericPostId).eq("user_id", userId)).error;
  } else {
    error = (await client.from("likes").insert({ post_id: numericPostId, user_id: userId })).error;
  }
  if (error) throw error;
}

export async function toggleBookmark(postId: string, userId: string, bookmarked: boolean) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase 未配置");
  const numericPostId = toNumericPostId(postId);
  let error: unknown = null;
  if (bookmarked) {
    error = (await client.from("bookmarks").delete().eq("post_id", numericPostId).eq("user_id", userId)).error;
  } else {
    error = (await client.from("bookmarks").insert({ post_id: numericPostId, user_id: userId })).error;
  }
  if (error) throw error;
}

export async function listPostComments(postId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return [] as CommunityCommentItem[];
  const numericPostId = toNumericPostId(postId);

  const { data, error } = await client
    .from("comments")
    .select("id,post_id,author_id,content,created_at")
    .eq("post_id", numericPostId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data || []) as RawCommentRow[];
  if (rows.length === 0) return [];

  const authorIds = Array.from(new Set(rows.map((item) => item.author_id).filter(Boolean)));
  let profileMap = new Map<string, string>();
  if (authorIds.length > 0) {
    const profilesRes = await client.from("profiles").select("id,nickname").in("id", authorIds);
    if (profilesRes.error && process.env.NODE_ENV === "development") {
      console.warn("[community] comment profiles query skipped:", profilesRes.error);
    }
    profileMap = new Map((profilesRes.data || []).map((item) => [item.id, item.nickname || "康复伙伴"]));
  }

  return rows.map((item) => ({
    id: String(item.id),
    postId: String(item.post_id),
    authorId: item.author_id,
    authorName: profileMap.get(item.author_id) || "康复伙伴",
    content: item.content,
    createdAt: item.created_at
  }));
}

export async function addPostComment(postId: string, userId: string, content: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase 未配置");
  const numericPostId = toNumericPostId(postId);
  const { error } = await client.from("comments").insert({
    post_id: numericPostId,
    author_id: userId,
    content
  });
  if (error) throw error;
}

export async function listMyPostIds(userId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return { myPostIds: [] as string[], likedPostIds: [] as string[], bookmarkedPostIds: [] as string[], commentedPostIds: [] as string[] };

  const [myPostsRes, likesRes, bookmarksRes, commentsRes] = await Promise.all([
    client.from("posts").select("id").eq("author_id", userId),
    client.from("likes").select("post_id").eq("user_id", userId),
    client.from("bookmarks").select("post_id").eq("user_id", userId),
    client.from("comments").select("post_id").eq("author_id", userId)
  ]);
  if (myPostsRes.error) throw myPostsRes.error;
  if (likesRes.error) throw likesRes.error;
  if (bookmarksRes.error) throw bookmarksRes.error;
  if (commentsRes.error) throw commentsRes.error;

  return {
    myPostIds: (myPostsRes.data || []).map((item) => String(item.id)),
    likedPostIds: (likesRes.data || []).map((item) => String(item.post_id)),
    bookmarkedPostIds: (bookmarksRes.data || []).map((item) => String(item.post_id)),
    commentedPostIds: Array.from(new Set((commentsRes.data || []).map((item) => String(item.post_id))))
  };
}

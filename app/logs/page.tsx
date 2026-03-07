"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { useI18n } from "@/src/lib/i18n";
import { listCommunityPosts, toggleBookmark, toggleLike } from "@/src/lib/community";
import { formatSupabaseError, parseSupabaseError } from "@/src/lib/supabase/error";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/src/lib/supabase/browser";
import { getProfile } from "@/src/lib/storage";

type CommunityStatus = "idle" | "auth" | "loading" | "ready" | "error";

const COMMUNITY_INIT_TIMEOUT_MS = 8000;

function formatTime(value: string, locale: "zh" | "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (locale === "en") {
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export default function EcosystemPage() {
  const { locale, t } = useI18n();
  const [status, setStatus] = useState<CommunityStatus>("idle");
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [userId, setUserId] = useState("");
  const [lastErrorDetails, setLastErrorDetails] = useState("");
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof listCommunityPosts>>>([]);
  const initStartedRef = useRef(false);
  const initInFlightRef = useRef(false);
  const initRunIdRef = useRef(0);
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isDev = process.env.NODE_ENV === "development";

  const refreshPosts = useCallback(async (uid: string, runId?: number) => {
    const data = await listCommunityPosts(uid);
    if (typeof runId === "number" && initRunIdRef.current !== runId) return;
    let merged = data;
    if (typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem("community_recent_post");
      if (raw) {
        try {
          const recent = JSON.parse(raw) as {
            id: string;
            content: string;
            tags: string[];
            imageUrl?: string;
            createdAt: string;
          };
          if (recent?.id && !data.some((item) => item.id === recent.id)) {
            const nickname = getProfile()?.nickname || "康复伙伴";
            merged = [
              {
                id: recent.id,
                authorId: uid,
                authorName: nickname,
                content: recent.content,
                imageUrl: recent.imageUrl,
                tags: Array.isArray(recent.tags) ? recent.tags : [],
                createdAt: recent.createdAt || new Date().toISOString(),
                likes: 0,
                comments: 0,
                bookmarks: 0,
                likedByMe: false,
                bookmarkedByMe: false
              },
              ...data
            ];
          }
        } catch {
          // ignore malformed cache
        } finally {
          window.sessionStorage.removeItem("community_recent_post");
        }
      }
    }
    setPosts(merged);
    setStatus("ready");
  }, []);

  const initCommunity = useCallback(async () => {
    if (initInFlightRef.current) return;
    initInFlightRef.current = true;
    const runId = Date.now();
    initRunIdRef.current = runId;
    setError("");
    setLastErrorDetails("");
    setNeedsSetup(false);
    setPosts([]);

    const configuredNow = isSupabaseConfigured();
    if (!configuredNow) {
      setStatus("error");
      setNeedsSetup(true);
      setError(t("logs.setupHint"));
      initInFlightRef.current = false;
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      setStatus("error");
      setNeedsSetup(true);
      setError(t("logs.setupHint"));
      initInFlightRef.current = false;
      return;
    }

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      if (initRunIdRef.current !== runId) return;
      setStatus("error");
      setNeedsSetup(false);
      setError(t("logs.connectTimeout"));
      setLastErrorDetails("community-init-timeout");
    }, COMMUNITY_INIT_TIMEOUT_MS);

    const fail = (message: string, setup = false) => {
      if (timedOut || initRunIdRef.current !== runId) return;
      setStatus("error");
      setNeedsSetup(setup);
      setError(message);
    };

    try {
      setStatus("loading");
      const profile = getProfile();
      const getSessionRes = await client.auth.getSession();
      if (getSessionRes.error) throw getSessionRes.error;
      if (timedOut || initRunIdRef.current !== runId) return;

      authSubscriptionRef.current?.unsubscribe();
      const authListener = client.auth.onAuthStateChange((_event, nextSession) => {
        if (initRunIdRef.current !== runId) return;
        setUserId(nextSession?.user?.id || "");
      });
      authSubscriptionRef.current = authListener.data.subscription;

      let session = getSessionRes.data.session;
      if (!session) {
        setStatus("auth");
        const signInRes = await client.auth.signInAnonymously({
          options: {
            data: {
              nickname: profile?.nickname || "康复伙伴"
            }
          }
        });
        if (signInRes.error) throw signInRes.error;
        session = signInRes.data.session || null;
      }

      if (timedOut || initRunIdRef.current !== runId) return;
      const uid = session?.user?.id || "";
      if (!uid) {
        fail(t("logs.setupHint"), true);
        return;
      }
      setUserId(uid);

      const profileUpsert = await client.from("profiles").upsert(
        {
          id: uid,
          nickname: profile?.nickname || session?.user?.user_metadata?.nickname || "康复伙伴",
          ingredient_prefs: session?.user?.user_metadata?.ingredient_prefs || {}
        },
        { onConflict: "id" }
      );
      if (profileUpsert.error && isDev) {
        console.warn("[community:init] profiles upsert skipped", profileUpsert.error);
      }

      if (timedOut || initRunIdRef.current !== runId) return;
      setStatus("loading");
      await refreshPosts(uid, runId);
    } catch (err) {
      const info = parseSupabaseError(err);
      const detailText = formatSupabaseError(info);
      setLastErrorDetails(detailText);
      if (isDev) {
        console.error("[community:init] failed", info);
      }
      const setupIssue =
        info.message.toLowerCase().includes("anonymous") ||
        info.message.toLowerCase().includes("api key") ||
        info.message.toLowerCase().includes("jwt") ||
        info.code === "401" ||
        info.code === "403" ||
        info.status === "401" ||
        info.status === "403";
      fail(setupIssue ? t("logs.setupHint") : t("logs.loadFailed"), setupIssue);
    } finally {
      window.clearTimeout(timeoutId);
      if (initRunIdRef.current === runId) {
        initInFlightRef.current = false;
      }
    }
  }, [isDev, refreshPosts, t]);

  useEffect(() => {
    if (!initStartedRef.current && reloadToken === 0) {
      initStartedRef.current = true;
      void initCommunity();
      return;
    }
    if (reloadToken > 0) {
      void initCommunity();
    }
  }, [initCommunity, reloadToken]);

  useEffect(() => {
    return () => {
      authSubscriptionRef.current?.unsubscribe();
      authSubscriptionRef.current = null;
    };
  }, []);

  const handleLike = async (postId: string, liked: boolean) => {
    if (!userId || status !== "ready") return;
    try {
      await toggleLike(postId, userId, liked);
      await refreshPosts(userId);
    } catch (err) {
      const info = parseSupabaseError(err);
      setError(t("logs.loadFailed"));
      setStatus("error");
      setLastErrorDetails(formatSupabaseError(info));
    }
  };

  const handleBookmark = async (postId: string, bookmarked: boolean) => {
    if (!userId || status !== "ready") return;
    try {
      await toggleBookmark(postId, userId, bookmarked);
      await refreshPosts(userId);
    } catch (err) {
      const info = parseSupabaseError(err);
      setError(t("logs.loadFailed"));
      setStatus("error");
      setLastErrorDetails(formatSupabaseError(info));
    }
  };

  const handleShare = async (postId: string, content: string) => {
    const url = `${window.location.origin}/logs/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "HealMeal", text: content.slice(0, 40), url });
        return;
      } catch {
        // ignore and fallback
      }
    }
    await navigator.clipboard.writeText(url);
  };

  return (
    <AppContainer>
      <div className="mb-2 flex items-center justify-between">
        <PageTitle title={t("logs.title")} center />
        <div className="flex items-center gap-2">
          <Link href="/logs/me" className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[13px] text-[#636E72]">
            {t("logs.my")}
          </Link>
          <Link href="/logs/publish" className="rounded-full bg-[#8AB4F8] px-3 py-1.5 text-[18px] font-semibold text-white">
            +
          </Link>
        </div>
      </div>

      {status === "idle" || status === "auth" || status === "loading" ? (
        <Card>
          <p className="text-[14px] text-[#636E72]">{status === "auth" ? t("logs.authing") : t("logs.connecting")}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="mt-3">
          <p className="text-[14px] text-[#9A6554]">{error}</p>
          {needsSetup ? (
            <Link href="/supabase-setup" className="mt-2 inline-block rounded-xl bg-[#EEF4FF] px-3 py-1.5 text-[13px] text-[#636E72]">
              {t("logs.setupAction")}
            </Link>
          ) : null}
          {isDev && lastErrorDetails ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(lastErrorDetails)}
                className="rounded-xl bg-[#FDEEE6] px-3 py-1.5 text-[12px] text-[#916348]"
              >
                {t("logs.copyError")}
              </button>
              <p className="text-[12px] text-[#9A6554] line-clamp-2">{lastErrorDetails}</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="space-y-3 pb-6">
        {posts.map((post) => (
          <Card key={post.id}>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-[#2C3E50]">{post.authorName}</p>
              <p className="text-[12px] text-[#95A3AF]">{formatTime(post.createdAt, locale)}</p>
            </div>

            <p className="mt-2 text-[14px] leading-6 text-[#636E72]">{post.content}</p>

            {post.imageUrl ? (
              <Image src={post.imageUrl} alt="post-cover" width={600} height={240} unoptimized className="mt-2 h-40 w-full rounded-2xl object-cover" />
            ) : null}

            {post.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[#EEF4FF] px-2 py-1 text-[12px] text-[#7A8792]">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-4 gap-1 border-t border-[#E7EDF7] pt-2 text-[13px] text-[#636E72]">
              <button type="button" onClick={() => void handleLike(post.id, post.likedByMe)} className={post.likedByMe ? "font-semibold text-[#8AB4F8]" : ""}>
                👍 {post.likes}
              </button>
              <button
                type="button"
                onClick={() => void handleBookmark(post.id, post.bookmarkedByMe)}
                className={post.bookmarkedByMe ? "font-semibold text-[#8AB4F8]" : ""}
              >
                ⭐ {post.bookmarks}
              </button>
              <Link href={`/logs/${post.id}`} className="text-center">
                💬 {post.comments}
              </Link>
              <button type="button" onClick={() => void handleShare(post.id, post.content)}>
                ↗ {t("logs.share")}
              </button>
            </div>
          </Card>
        ))}

        {status === "ready" && !error && posts.length === 0 ? (
          <Card>
            <p className="text-[14px] text-[#636E72]">{t("logs.noPost")}</p>
          </Card>
        ) : null}
      </div>

      {status === "error" ? (
        <div className="pb-6">
          <button
            type="button"
            onClick={() => setReloadToken((prev) => prev + 1)}
            className="w-full rounded-xl bg-[#EEF4FF] px-3 py-2 text-[13px] text-[#636E72]"
          >
            {t("logs.retryConnect")}
          </button>
        </div>
      ) : null}
    </AppContainer>
  );
}

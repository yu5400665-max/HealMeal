"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { useI18n } from "@/src/lib/i18n";
import { ensureCommunitySession, listCommunityPostsByIds, listMyPostIds } from "@/src/lib/community";
import { formatSupabaseError, parseSupabaseError } from "@/src/lib/supabase/error";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/src/lib/supabase/browser";
import { getProfile } from "@/src/lib/storage";

type MyCommunityStatus = "idle" | "loading" | "ready" | "error";
const MY_COMMUNITY_TIMEOUT_MS = 8000;

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

export default function MyCommunityPage() {
  const { locale, t } = useI18n();
  type FeedItems = Awaited<ReturnType<typeof listCommunityPostsByIds>>;
  const [status, setStatus] = useState<MyCommunityStatus>("idle");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [lastErrorDetails, setLastErrorDetails] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [myPosts, setMyPosts] = useState<FeedItems>([]);
  const [likedPosts, setLikedPosts] = useState<FeedItems>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<FeedItems>([]);
  const [commentedPosts, setCommentedPosts] = useState<FeedItems>([]);
  const startedRef = useRef(false);
  const inFlightRef = useRef(false);
  const runIdRef = useRef(0);
  const isDev = process.env.NODE_ENV === "development";

  const loadMyCommunity = useCallback(
    async (options?: { silent?: boolean }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const runId = Date.now();
      runIdRef.current = runId;

      if (!options?.silent) setStatus("loading");
      setError("");
      setLastErrorDetails("");

      if (!isSupabaseConfigured()) {
        setStatus("error");
        setError(t("logs.setupHint"));
        inFlightRef.current = false;
        return;
      }

      let timedOut = false;
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        if (runIdRef.current !== runId) return;
        setStatus("error");
        setError(t("logs.connectTimeout"));
        setLastErrorDetails("my-community-timeout");
      }, MY_COMMUNITY_TIMEOUT_MS);

      try {
        const session = await ensureCommunitySession(getProfile()?.nickname);
        if (!session.client || !session.user) {
          throw new Error("my-community-no-user");
        }
        if (timedOut || runIdRef.current !== runId) return;

        const uid = session.user.id;
        setUserId(uid);

        const ids = await listMyPostIds(uid);
        if (timedOut || runIdRef.current !== runId) return;

        const [mine, liked, bookmarked, commented] = await Promise.all([
          listCommunityPostsByIds(ids.myPostIds, uid),
          listCommunityPostsByIds(ids.likedPostIds, uid),
          listCommunityPostsByIds(ids.bookmarkedPostIds, uid),
          listCommunityPostsByIds(ids.commentedPostIds, uid)
        ]);

        if (timedOut || runIdRef.current !== runId) return;
        setMyPosts(mine);
        setLikedPosts(liked);
        setBookmarkedPosts(bookmarked);
        setCommentedPosts(commented);
        setStatus("ready");
      } catch (err) {
        const info = parseSupabaseError(err);
        const detailText = formatSupabaseError(info);
        setLastErrorDetails(detailText);
        if (isDev) {
          console.error("[my-community:load] failed", info);
        }
        const lower = info.message.toLowerCase();
        if (lower.includes("row-level security") || lower.includes("permission") || lower.includes("401") || lower.includes("403")) {
          setError(t("logs.publishFailedDetail", { message: `${info.message}. ${t("logs.rlsHint")}` }));
        } else {
          setError(t("logs.loadFailed"));
        }
        setStatus("error");
      } finally {
        window.clearTimeout(timeoutId);
        inFlightRef.current = false;
      }
    },
    [isDev, t]
  );

  useEffect(() => {
    if (!startedRef.current && retryToken === 0) {
      startedRef.current = true;
      void loadMyCommunity();
      return;
    }
    if (retryToken > 0) {
      void loadMyCommunity();
    }
  }, [loadMyCommunity, retryToken]);

  useEffect(() => {
    if (!userId) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    // Keep "我的社区" list in sync when likes/bookmarks/comments/posts change.
    const refresh = () => {
      void loadMyCommunity({ silent: true });
    };

    const channel = client
      .channel(`my-community-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookmarks" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, refresh)
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [loadMyCommunity, userId]);

  useEffect(() => {
    const handleFocus = () => {
      if (status === "ready") void loadMyCommunity({ silent: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && status === "ready") {
        void loadMyCommunity({ silent: true });
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadMyCommunity, status]);

  const renderList = (title: string, list: FeedItems) => (
    <Card className="mt-3">
      <p className="text-[16px] font-semibold text-[#2C3E50]">{title}</p>
      <div className="mt-2 space-y-2">
        {list.map((item) => (
          <Link key={item.id} href={`/logs/${item.id}`} className="block rounded-xl bg-[#F4F8FF] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-[#2C3E50]">{item.authorName}</p>
              <p className="text-[12px] text-[#95A3AF]">{formatTime(item.createdAt, locale)}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] text-[#636E72]">{item.content}</p>
            <p className="mt-1 text-[12px] text-[#95A3AF]">👍 {item.likes} · 💬 {item.comments} · ⭐ {item.bookmarks}</p>
          </Link>
        ))}
        {list.length === 0 ? <p className="text-[13px] text-[#7A8792]">{t("logs.noContent")}</p> : null}
      </div>
    </Card>
  );

  return (
    <AppContainer>
      <PageTitle title={t("logs.myCommunity")} showBack center />

      {status === "idle" || status === "loading" ? (
        <Card>
          <p className="text-[14px] text-[#636E72]">{t("logs.connecting")}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="mt-3">
          <p className="text-[14px] text-[#9A6554]">{error}</p>
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
          <button
            type="button"
            onClick={() => setRetryToken((prev) => prev + 1)}
            disabled={status === "loading"}
            className="mt-2 rounded-xl bg-[#EEF4FF] px-3 py-1.5 text-[13px] text-[#636E72] disabled:opacity-60"
          >
            {t("logs.retryConnect")}
          </button>
        </Card>
      ) : null}

      {status === "ready" && !error ? (
        <>
          {renderList(t("logs.myPosts"), myPosts)}
          {renderList(t("logs.likedPosts"), likedPosts)}
          {renderList(t("logs.bookmarkedPosts"), bookmarkedPosts)}
          {renderList(t("logs.commentedPosts"), commentedPosts)}
        </>
      ) : null}
    </AppContainer>
  );
}

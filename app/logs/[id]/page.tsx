"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { useI18n } from "@/src/lib/i18n";
import { addPostComment, ensureCommunitySession, getCommunityPostById, listPostComments, type CommunityPostItem } from "@/src/lib/community";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/src/lib/supabase/browser";
import { getProfile } from "@/src/lib/storage";

export default function PostDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const postId = Array.isArray(params?.id) ? params.id[0] || "" : params?.id || "";
  const [postLoading, setPostLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState("");
  const [post, setPost] = useState<CommunityPostItem | null>(null);
  const [comments, setComments] = useState<Awaited<ReturnType<typeof listPostComments>>>([]);
  const [commentInput, setCommentInput] = useState("");
  const [postError, setPostError] = useState("");
  const [commentError, setCommentError] = useState("");
  const mountedRef = useRef(true);
  const setupHintText = t("logs.setupHint");
  const loadPostFailedText = t("logs.loadPostFailed");
  const commentFailedText = t("logs.commentFailed");

  const refreshComments = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!postId || !isSupabaseConfigured()) return;
      if (!options?.silent) {
        setCommentsLoading(true);
      }
      try {
        const latest = await listPostComments(postId);
        if (!mountedRef.current) return;
        setComments(latest);
        setPost((prev) => (prev ? { ...prev, comments: latest.length } : prev));
        setCommentError("");
      } catch {
        if (!mountedRef.current) return;
        setCommentError(commentFailedText);
      } finally {
        if (!options?.silent && mountedRef.current) {
          setCommentsLoading(false);
        }
      }
    },
    [commentFailedText, postId]
  );

  useEffect(() => {
    let mounted = true;
    mountedRef.current = mounted;
    return () => {
      mounted = false;
      mountedRef.current = mounted;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setPostLoading(true);
      setPostError("");
      try {
        if (!isSupabaseConfigured()) {
          if (mounted) {
            setPost(null);
            setPostError(setupHintText);
          }
          return;
        }
        const session = await ensureCommunitySession(getProfile()?.nickname);
        if (!mounted) return;
        if (!session.user) {
          setPost(null);
          setPostError(setupHintText);
          return;
        }
        const uid = session.user.id;
        setUserId(uid);
        const postDetail = await getCommunityPostById(postId, uid);
        if (!mounted) return;
        setPost(postDetail);
        setPostError(postDetail ? "" : loadPostFailedText);
      } catch {
        if (mounted) {
          setPost(null);
          setPostError(loadPostFailedText);
        }
      } finally {
        if (mounted) {
          setPostLoading(false);
        }
      }
    };
    if (postId) {
      void init();
    } else {
      setPost(null);
      setPostLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [loadPostFailedText, postId, setupHintText]);

  useEffect(() => {
    let mounted = true;
    const initComments = async () => {
      setCommentsLoading(true);
      setCommentError("");
      try {
        if (!isSupabaseConfigured()) {
          if (mounted) {
            setComments([]);
            setCommentError(setupHintText);
          }
          return;
        }
        const latest = await listPostComments(postId);
        if (!mounted) return;
        setComments(latest);
        setPost((prev) => (prev ? { ...prev, comments: latest.length } : prev));
        setCommentError("");
      } catch {
        if (mounted) {
          setCommentError(commentFailedText);
        }
      } finally {
        if (mounted) {
          setCommentsLoading(false);
        }
      }
    };
    if (postId) {
      void initComments();
    } else {
      setComments([]);
      setCommentsLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [commentFailedText, postId, setupHintText]);

  useEffect(() => {
    let mounted = true;
    if (!postId || !isSupabaseConfigured()) {
      return () => {
        mounted = false;
      };
    }
    const numericPostId = Number(postId);
    if (!Number.isFinite(numericPostId)) {
      return () => {
        mounted = false;
      };
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      return () => {
        mounted = false;
      };
    }

    const refresh = () => {
      void (async () => {
        try {
          const latest = await listPostComments(postId);
          if (!mounted) return;
          setComments(latest);
          setPost((prev) => (prev ? { ...prev, comments: latest.length } : prev));
          setCommentError("");
        } catch {
          if (!mounted) return;
          setCommentError(commentFailedText);
        }
      })();
    };

    const channel = client
      .channel(`post-${postId}-detail`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${numericPostId}` }, refresh)
      .subscribe();

    return () => {
      mounted = false;
      void client.removeChannel(channel);
    };
  }, [commentFailedText, postId]);

  const submitComment = async () => {
    const text = commentInput.trim();
    if (!text) return;
    setSubmitting(true);
    setCommentError("");
    const fallbackName = getProfile()?.nickname || "康复伙伴";
    const tempId = `temp-${Date.now()}`;
    let createdOnServer = false;
    try {
      let uid = userId;
      if (!uid) {
        const session = await ensureCommunitySession(getProfile()?.nickname);
        uid = session.user?.id || "";
        if (uid && mountedRef.current) setUserId(uid);
      }
      if (!uid) throw new Error("community-no-user");

      const optimistic = {
        id: tempId,
        postId,
        authorId: uid,
        authorName: fallbackName,
        content: text,
        createdAt: new Date().toISOString()
      };
      if (mountedRef.current) {
        setComments((prev) => [...prev, optimistic]);
        setPost((prev) => (prev ? { ...prev, comments: prev.comments + 1 } : prev));
        setCommentInput("");
      }

      await addPostComment(postId, uid, text);
      createdOnServer = true;
      await refreshComments({ silent: true });
    } catch {
      if (!mountedRef.current) return;
      setCommentError(commentFailedText);
      if (!createdOnServer) {
        setComments((prev) => prev.filter((item) => item.id !== tempId));
        setPost((prev) => (prev ? { ...prev, comments: Math.max(0, prev.comments - 1) } : prev));
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const sharePost = async () => {
    const url = `${window.location.origin}/logs/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "HealMeal", url });
        return;
      } catch {
        // ignore and fallback
      }
    }
    await navigator.clipboard.writeText(url);
  };

  return (
    <AppContainer>
      <PageTitle title={t("logs.postDetail")} center showBack />

      {postLoading ? (
        <Card>
          <p className="text-[14px] text-[#636E72]">{t("common.loading")}</p>
        </Card>
      ) : null}

      {!postLoading && postError ? (
        <Card className="mt-3">
          <p className="text-[14px] text-[#9A6554]">{postError}</p>
        </Card>
      ) : null}

      {!postLoading && post ? (
        <Card className="mt-3">
          <p className="text-[15px] font-semibold text-[#2C3E50]">{post?.authorName || "康复伙伴"}</p>
          <p className="mt-2 text-[14px] leading-6 text-[#636E72] whitespace-pre-line">{post?.content || ""}</p>
          {post?.imageUrl ? (
            <Image src={post.imageUrl} alt="post-cover" width={600} height={240} className="mt-2 h-40 w-full rounded-2xl object-cover" unoptimized />
          ) : null}
          <div className="mt-3 flex items-center justify-between text-[13px] text-[#636E72]">
            <span>👍 {post?.likes || 0} · 💬 {post?.comments || 0} · ⭐ {post?.bookmarks || 0}</span>
            <button type="button" onClick={() => void sharePost()} className="text-[#8AB4F8]">
              {t("logs.share")}
            </button>
          </div>
        </Card>
      ) : null}

      <Card className="mt-3">
        <p className="text-[16px] font-semibold text-[#2C3E50]">{t("logs.comments")}</p>
        <div className="mt-2 flex gap-2">
          <input
            value={commentInput}
            onChange={(event) => setCommentInput(event.target.value)}
            className="flex-1 rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[14px]"
            placeholder={t("logs.commentPlaceholder")}
          />
          <button
            type="button"
            disabled={submitting || commentInput.trim().length === 0}
            onClick={() => void submitComment()}
            className="rounded-xl bg-[#8AB4F8] px-3 py-2 text-[13px] text-white disabled:opacity-60"
          >
            {submitting ? t("common.loading") : t("logs.sendComment")}
          </button>
        </div>

        {commentError ? <p className="mt-2 text-[13px] text-[#9A6554]">{commentError}</p> : null}
        <div className="mt-3 space-y-2">
          {commentsLoading ? <p className="text-[13px] text-[#7A8792]">{t("common.loading")}</p> : null}
          {comments.map((item) => (
            <div key={item.id} className="rounded-xl bg-[#F4F8FF] p-3">
              <p className="text-[13px] font-medium text-[#2C3E50]">{item.authorName}</p>
              <p className="mt-1 text-[13px] text-[#636E72]">{item.content}</p>
            </div>
          ))}
          {!commentsLoading && comments.length === 0 ? <p className="text-[13px] text-[#7A8792]">{t("logs.noComment")}</p> : null}
        </div>
      </Card>
    </AppContainer>
  );
}

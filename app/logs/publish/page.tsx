"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { useI18n } from "@/src/lib/i18n";
import { createCommunityPost, uploadPostImage } from "@/src/lib/community";
import { formatSupabaseError, parseSupabaseError } from "@/src/lib/supabase/error";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/src/lib/supabase/browser";
import { clearPendingPublishDraft, getPendingPublishDraft, getProfile } from "@/src/lib/storage";

const PRESET_TAGS_ZH = ["清淡", "恢复期", "运动", "情绪", "家属", "经验"];
const PRESET_TAGS_EN = ["Light", "Recovery", "Exercise", "Mood", "Family", "Tips"];

export default function PublishPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const profile = useMemo(() => getProfile(), []);
  const presetTags = useMemo(() => (locale === "en" ? PRESET_TAGS_EN : PRESET_TAGS_ZH), [locale]);
  const loadedDraftRef = useRef(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugError, setDebugError] = useState("");
  const [hint, setHint] = useState("");
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (loadedDraftRef.current) return;
    loadedDraftRef.current = true;
    const fromCheckin = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "checkin";
    const draft = getPendingPublishDraft();
    if (!fromCheckin && !draft) return;
    if (draft) {
      setTitle(draft.title || "");
      setContent(draft.content || "");
      setTags(Array.isArray(draft.tags) ? draft.tags : []);
      clearPendingPublishDraft();
    }
    setHint(t("logs.prefillFromCheckin"));
  }, [t]);

  const isRlsError = (message: string) => {
    const lower = message.toLowerCase();
    return (
      lower.includes("row-level security") ||
      lower.includes("violates row-level security") ||
      lower.includes("permission denied") ||
      lower.includes("42501") ||
      lower.includes("401") ||
      lower.includes("403")
    );
  };

  const toggleTag = (value: string) => {
    setTags((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const addCustomTag = () => {
    const next = customTag.trim();
    if (!next) return;
    if (!tags.includes(next)) {
      setTags((prev) => [...prev, next]);
    }
    setCustomTag("");
  };

  const onPickImage = (file: File | null) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const publish = async () => {
    setError("");
    setDebugError("");
    const titleText = title.trim();
    const contentText = content.trim();
    if (!contentText) {
      setError(t("logs.fillContent"));
      return;
    }

    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setError(t("logs.setupHint"));
        return;
      }
      const client = getSupabaseBrowserClient();
      if (!client) {
        setError(t("logs.setupHint"));
        return;
      }
      const getSessionRes = await client.auth.getSession();
      if (getSessionRes.error) throw getSessionRes.error;
      let session = getSessionRes.data.session;
      if (!session) {
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
      const userId = session?.user?.id || "";
      if (!userId) throw new Error("publish-no-user");
      const profileUpsert = await client.from("profiles").upsert(
        {
          id: userId,
          nickname: profile?.nickname || session?.user?.user_metadata?.nickname || "康复伙伴",
          ingredient_prefs: session?.user?.user_metadata?.ingredient_prefs || {}
        },
        { onConflict: "id" }
      );
      if (profileUpsert.error && isDev) {
        console.warn("[community:publish] profiles upsert skipped", profileUpsert.error);
      }

      const finalContent = titleText ? `${titleText}\n${contentText}` : contentText;
      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await uploadPostImage(userId, imageFile);
      }

      const created = await createCommunityPost({
        userId,
        content: finalContent,
        tags,
        imageUrl
      });

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "community_recent_post",
          JSON.stringify({
            id: created.id,
            content: created.content,
            tags: created.tags,
            imageUrl: created.imageUrl,
            createdAt: created.createdAt
          })
        );
      }

      setTitle("");
      setContent("");
      setTags([]);
      setCustomTag("");
      setImageFile(null);
      setImagePreview("");
      router.push("/logs?published=1");
    } catch (err) {
      const info = parseSupabaseError(err);
      const detail = formatSupabaseError(info);
      const message = info.message || t("logs.publishFailed");
      const rlsHint = isRlsError(message) ? ` ${t("logs.rlsHint")}` : "";
      setError(t("logs.publishFailedDetail", { message: `${message}${rlsHint}` }));
      if (isDev) {
        console.error("[community:publish] failed", info);
        setDebugError(detail || String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppContainer withNav={false}>
      <PageTitle title={t("logs.publishTitle")} showBack center />

      <Card>
        {hint ? <p className="mb-2 rounded-xl bg-[#F4F8FF] px-3 py-2 text-[12px] text-[#6D7F93]">{hint}</p> : null}
        <label className="mb-1 block text-[14px] text-[#636E72]">{t("logs.postTitleLabel")}</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[14px]"
          placeholder={t("logs.postTitlePlaceholder")}
        />

        <label className="mt-3 mb-1 block text-[14px] text-[#636E72]">{t("logs.postContentLabel")}</label>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={6}
          className="w-full rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[14px]"
          placeholder={t("logs.postContentPlaceholder")}
        />

        <p className="mt-3 mb-1 text-[14px] text-[#636E72]">{t("logs.postTagsLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {presetTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-[13px] ${
                tags.includes(tag) ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <input
            value={customTag}
            onChange={(event) => setCustomTag(event.target.value)}
            className="flex-1 rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[13px]"
            placeholder={t("logs.postCustomTagPlaceholder")}
          />
          <button type="button" onClick={addCustomTag} className="rounded-xl bg-[#EEF4FF] px-3 text-[13px] text-[#636E72]">
            {t("logs.addTag")}
          </button>
        </div>

        <label className="mt-3 mb-1 block text-[14px] text-[#636E72]">{t("logs.postImageLabel")}</label>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            onPickImage(event.target.files?.[0] || null);
            event.currentTarget.value = "";
          }}
          className="w-full rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[13px]"
        />

        {imagePreview ? (
          <div className="mt-2 relative">
            <Image src={imagePreview} alt="preview" width={600} height={300} className="h-40 w-full rounded-xl object-cover" unoptimized />
            <button
              type="button"
              onClick={() => {
                setImageFile(null);
                setImagePreview("");
              }}
              className="absolute right-2 top-2 rounded bg-[#2C3E50cc] px-1.5 text-[11px] text-white"
            >
              {t("logs.removeImage")}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-2 text-[13px] text-[#C27774]">{error}</p> : null}
        {isDev && debugError ? <p className="mt-1 text-[12px] text-[#9A6554]">{debugError}</p> : null}

        <button
          type="button"
          onClick={() => void publish()}
          disabled={loading}
          className="mt-3 w-full rounded-2xl bg-[#8AB4F8] py-2.5 text-[15px] text-white disabled:opacity-60"
        >
          {loading ? t("logs.publishing") : t("logs.publishNow")}
        </button>
      </Card>
    </AppContainer>
  );
}

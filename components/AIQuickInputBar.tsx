"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSpeechToText } from "@/src/hooks/useSpeechToText";
import { compressImageToDataUrl } from "@/src/lib/image";
import type { AIAttachment } from "@/src/lib/types";
import type { ReactNode } from "react";

interface SendPayload {
  text: string;
  attachments: AIAttachment[];
}

interface AIQuickInputBarProps {
  value: string;
  loading?: boolean;
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
  onSend: (payload?: SendPayload) => void | Promise<void>;
  onOpenChat?: () => void;
  onPlus?: () => void;
}

function toAttachment(file: File): Promise<AIAttachment> {
  return new Promise((resolve, reject) => {
    compressImageToDataUrl(file, 960, 0.82)
      .then((dataUrl) =>
        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl
        })
      )
      .catch(() => reject(new Error("读取图片失败")));
  });
}

function IconButton({
  children,
  onClick,
  label,
  active = false
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-[#7A8792] transition-colors ${
        active ? "bg-[#EAF2FF] text-[#8AB4F8]" : "bg-[#F4F8FF]"
      }`}
    >
      {children}
    </button>
  );
}

export default function AIQuickInputBar({
  value,
  loading,
  placeholder = "我吃这个行不行？",
  className = "",
  onChange,
  onSend,
  onOpenChat,
  onPlus
}: AIQuickInputBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const speechBaseRef = useRef("");
  const [attachments, setAttachments] = useState<AIAttachment[]>([]);
  const [localError, setLocalError] = useState("");
  const { isSupported, isListening, transcript, error, start, stop, reset } = useSpeechToText("zh-CN");

  useEffect(() => {
    if (!isListening || !transcript) return;
    const next = `${speechBaseRef.current} ${transcript}`.trim();
    onChange(next);
  }, [isListening, transcript, onChange]);

  useEffect(() => {
    if (error) setLocalError(error);
  }, [error]);

  const canSend = useMemo(() => value.trim().length > 0 || attachments.length > 0, [value, attachments]);

  const handlePickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLocalError("");
    const picked = Array.from(files).slice(0, 3);
    try {
      const next = await Promise.all(picked.map((file) => toAttachment(file)));
      setAttachments((prev) => [...prev, ...next].slice(0, 3));
    } catch {
      setLocalError("图片读取失败，请重试");
    }
  };

  const handleSend = async () => {
    if (!canSend || loading) return;
    const payload: SendPayload = {
      text: value.trim(),
      attachments
    };
    await onSend(payload);
    setAttachments([]);
    reset();
  };

  const toggleSpeech = () => {
    setLocalError("");
    if (!isSupported) {
      setLocalError("当前浏览器不支持语音输入，请使用 Chrome/Edge 或改用文字输入");
      return;
    }
    if (isListening) {
      stop();
      return;
    }
    speechBaseRef.current = value;
    start();
  };

  return (
    <div className={`rounded-[28px] bg-white p-2.5 shadow-[0_8px_16px_rgba(138,180,248,0.15)] ${className}`}>
      <div className="flex items-center gap-2">
        <IconButton
          label="上传图片"
          onClick={() => {
            onPlus?.();
            fileInputRef.current?.click();
          }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5V19" strokeLinecap="round" />
            <path d="M5 12H19" strokeLinecap="round" />
          </svg>
        </IconButton>

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 flex-1 rounded-full bg-[#F4F8FF] px-4 text-[14px] text-[#2C3E50]"
          placeholder={placeholder}
        />

        <IconButton label={isListening ? "停止听写" : "开始语音"} onClick={toggleSpeech} active={isListening}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="4" width="6" height="10" rx="3" />
            <path d="M6 10C6 13.3 8.7 16 12 16C15.3 16 18 13.3 18 10" strokeLinecap="round" />
            <path d="M12 16V20" strokeLinecap="round" />
          </svg>
        </IconButton>

        <button
          type="button"
          onClick={handleSend}
          disabled={loading || !canSend}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8AB4F8] text-white shadow-[0_8px_16px_rgba(138,180,248,0.3)] disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12H19" strokeLinecap="round" />
            <path d="M13 6L19 12L13 18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(event) => {
          void handlePickFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      {attachments.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((item) => (
            <div key={item.id} className="relative h-14 w-14 overflow-hidden rounded-2xl shadow-[0_3px_9px_rgba(0,0,0,0.08)]">
              <Image src={item.dataUrl} alt={item.name} fill unoptimized className="object-cover" />
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((file) => file.id !== item.id))}
                className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-md bg-[#2C3E50cc] text-[10px] text-white"
                aria-label="删除附件"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between text-[12px] text-[#636E72]">
        <span>{isListening ? "正在听写..." : "支持文本/图片/语音输入"}</span>
        {onOpenChat ? (
          <button type="button" onClick={onOpenChat} className="text-[#8AB4F8]">
            完整会话
          </button>
        ) : null}
      </div>

      {localError ? <p className="mt-1 text-[12px] text-[#C27774]">{localError}</p> : null}
    </div>
  );
}

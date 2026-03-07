"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }

  interface SpeechRecognitionEvent {
    results: ArrayLike<{
      isFinal: boolean;
      length: number;
      item: (index: number) => { transcript: string };
      [index: number]: { transcript: string };
    }>;
  }

  interface SpeechRecognitionErrorEvent {
    error: string;
  }
}

export function useSpeechToText(locale = "zh-CN") {
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const mapSpeechError = useCallback((raw: string) => {
    const code = (raw || "").toLowerCase();
    if (!code) return "语音识别失败，请稍后重试";
    if (code === "not-allowed" || code === "service-not-allowed") return "语音权限未开启，请在浏览器中允许麦克风后重试";
    if (code === "audio-capture") return "未检测到麦克风，请检查设备后重试";
    if (code === "no-speech") return "未识别到语音，请靠近麦克风再试";
    if (code === "network") return "语音识别网络异常，请稍后重试";
    return `语音识别失败（${code}）`;
  }, []);

  useEffect(() => {
    if (!isSupported || typeof window === "undefined") return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = locale;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("")
        .trim();
      setTranscript(text);
    };
    recognition.onerror = (event) => {
      setError(mapSpeechError(event.error || ""));
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [isSupported, locale, mapSpeechError]);

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      setError("当前浏览器不支持语音输入，请使用 Chrome/Edge 或改用文字输入");
      return;
    }
    setError("");
    setTranscript("");
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setError("无法启动语音识别，请稍后重试");
      setIsListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    } finally {
      setIsListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError("");
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    error,
    start,
    stop,
    reset
  };
}

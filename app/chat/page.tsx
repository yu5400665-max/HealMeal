"use client";

import { useEffect, useMemo, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { stripMedicalDisclaimer } from "@/src/lib/disclaimer";
import { getTodayCheckin, getProfile, getTodayMealPlan, getChatSessions, setChatSessions } from "@/src/lib/storage";
import type { ChatMessage, ChatSession, Profile } from "@/src/lib/types";

function createSession(): ChatSession {
  const now = new Date().toISOString();
  return {
    id: `${Date.now()}`,
    title: "新会话",
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

export default function ChatPage() {
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = getProfile();
    setProfileState(p);

    const saved = getChatSessions();
    if (saved.length > 0) {
      setSessions(saved);
      setActiveId(saved[0].id);
    } else {
      const initial = createSession();
      setSessions([initial]);
      setActiveId(initial.id);
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      setChatSessions(sessions);
    }
  }, [sessions]);

  const activeSession = useMemo(() => sessions.find((s) => s.id === activeId), [sessions, activeId]);

  const updateActiveSession = (messages: ChatMessage[]) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeId
          ? {
              ...session,
              title: messages[0]?.content?.slice(0, 8) || session.title,
              messages,
              updatedAt: new Date().toISOString()
            }
          : session
      )
    );
  };

  const send = async () => {
    const q = input.trim();
    if (!q || !activeSession || !profile) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      content: q,
      createdAt: new Date().toISOString()
    };

    const history = [...activeSession.messages, userMessage];
    updateActiveSession(history);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: "home",
          message: q,
          profile,
          todayState: getTodayCheckin(),
          currentMealPlan: getTodayMealPlan(),
          context: {
            chatHistory: history.map((m) => ({ role: m.role, content: m.content }))
          }
        })
      });

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        content: stripMedicalDisclaimer(data?.reply || data?.answer || "当前服务繁忙，请稍后重试。"),
        createdAt: new Date().toISOString()
      };
      updateActiveSession([...history, assistantMessage]);
      console.log("assistantMessage", assistantMessage);
      console.log("history after", [...history, assistantMessage]);
    } catch {
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        content: "当前服务繁忙，请稍后重试。",
        createdAt: new Date().toISOString()
      };
      updateActiveSession([...history, assistantMessage]);
    } finally {
      setLoading(false);
    }
  };

  const newSession = () => {
    const s = createSession();
    setSessions([s, ...sessions]);
    setActiveId(s.id);
  };

  const clearCurrent = () => {
    if (!activeSession) return;
    updateActiveSession([]);
  };

  return (
    <AppContainer>
      <PageTitle title="AI问答" subtitle="基于建档信息的饮食与康复陪伴" />

      {!profile ? (
        <Card className="mt-3">
          <p className="text-sm text-slate-600">请先建档，再使用上下文问答。</p>
        </Card>
      ) : (
        <>
          <Card className="mt-3">
            <div className="flex items-center gap-2 text-xs">
              <select
                value={activeId}
                onChange={(e) => setActiveId(e.target.value)}
                className="flex-1 rounded-xl border border-blue-100 bg-white px-2 py-2"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
              <button onClick={newSession} className="rounded-xl bg-slate-200 px-3 py-2 text-slate-700">
                新建
              </button>
              <button onClick={clearCurrent} className="rounded-xl bg-slate-200 px-3 py-2 text-slate-700">
                清空
              </button>
            </div>

            <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
              {activeSession?.messages.length ? null : <p className="text-xs text-slate-500">开始提问吧。</p>}
              {activeSession?.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl p-2 text-sm ${
                    msg.role === "user" ? "ml-8 bg-brand-100 text-brand-800" : "mr-8 bg-white text-slate-700"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm"
                placeholder="例如：我吃这个行不行？"
              />
              <button
                onClick={send}
                disabled={loading}
                className="rounded-xl bg-brand-500 px-3 text-sm text-white disabled:opacity-60"
              >
                {loading ? "发送中" : "发送"}
              </button>
            </div>
          </Card>
        </>
      )}
    </AppContainer>
  );
}

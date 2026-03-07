import type { AIAttachment, Profile } from "./types";

type AIStreamScenario = "home" | "meal" | "exercise" | "emotion" | "family";
type AISpeedMode = "fast" | "slow";

interface StreamRequestBody {
  scenario: AIStreamScenario;
  message: string;
  profile?: Profile | null;
  context?: Record<string, unknown>;
  attachments?: AIAttachment[];
  speed?: AISpeedMode;
}

function fallbackFriendlyError(text: string) {
  const raw = text.toLowerCase();
  if (raw.includes("not-allowed") || raw.includes("forbidden") || raw.includes("401") || raw.includes("403")) {
    return "当前服务有点忙，请稍后重试。";
  }
  return "暂时无法完成回答，请稍后重试。";
}

export async function streamAIReply(
  body: StreamRequestBody,
  onChunk: (fullText: string) => void
) {
  const response = await fetch("/api/ai/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(fallbackFriendlyError(detail));
  }

  if (!response.body) {
    const text = await response.text();
    onChunk(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onChunk(fullText);
  }

  return fullText.trim();
}


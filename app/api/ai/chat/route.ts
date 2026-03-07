import { NextResponse } from "next/server";

type Scenario = "home" | "meal" | "exercise" | "emotion" | "family";

interface ImageLikeObject {
  url?: string;
  dataUrl?: string;
}

interface Attachment {
  url?: string;
  dataUrl?: string;
}

interface ChatBody {
  scenario?: Scenario;
  message?: string;
  question?: string;
  systemPrompt?: string;
  profile?: unknown;
  context?: unknown;
  chatHistory?: Array<{ role?: "system" | "user" | "assistant"; content?: string }>;
  imageUrl?: string;
  images?: Array<string | ImageLikeObject>;
  attachments?: Attachment[];
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | {
            type: "image_url";
            image_url: { url: string };
          }
      >;
}

const DEFAULT_BASE_URL = "https://api-inference.modelscope.cn/v1";
const DEFAULT_TEXT_MODEL = "Qwen/Qwen3-32B";
const DEFAULT_VISION_MODEL = "Qwen/Qwen3-VL-8B-Instruct";

function cleanBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function getEnvConfig() {
  // 读取优先级：xxx_KEY > AI_* > MODELSCOPE_*（兼容历史配置）
  const provider = (process.env.AI_PROVIDER || "modelscope").toLowerCase();
  const apiKey = (process.env.xxx_KEY || process.env.AI_API_KEY || process.env.XXX_KEY || process.env.MODELSCOPE_API_KEY || "").trim();
  const baseUrl = cleanBaseUrl((process.env.AI_BASE_URL || process.env.MODELSCOPE_BASE_URL || DEFAULT_BASE_URL).trim());
  const textModel = (process.env.AI_MODEL_TEXT || process.env.MODELSCOPE_MODEL || DEFAULT_TEXT_MODEL).trim();
  const visionModel = (process.env.AI_MODEL_VISION || process.env.MODELSCOPE_MODEL_VISION || DEFAULT_VISION_MODEL).trim();

  return { provider, apiKey, baseUrl, textModel, visionModel };
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<Response>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI request timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    const response = await Promise.race([fetch(input, init), timeoutPromise]);
    return response;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getScenarioPrompt(scenario: Scenario = "home") {
  const common =
    "你是愈后食光 HealMeal 的术后康复助手。请使用中文，回答简洁可执行。你不能提供医疗诊断或治疗方案。";

  if (scenario === "meal") return `${common} 当前场景是食愈AI助手：重点回答术后饮食、食材是否可吃、烹饪方式与注意事项。`;
  if (scenario === "exercise") return `${common} 当前场景是动愈AI助手：重点回答安全运动建议、强度控制与停止条件。`;
  if (scenario === "emotion") return `${common} 当前场景是情绪陪伴：先共情，再给1-3条可执行建议。`;
  if (scenario === "family") return `${common} 当前场景是家属协助：给鼓励话术与可执行协助事项。`;

  return `${common} 当前场景是初愈AI助手：可回答饮食、运动、情绪与家属协作问题。`;
}

function pushIfString(list: string[], value?: string) {
  if (!value) return;
  const text = value.trim();
  if (text) list.push(text);
}

function normalizeImageUrls(body: ChatBody) {
  const urls: string[] = [];
  pushIfString(urls, body.imageUrl);

  for (const item of body.images || []) {
    if (typeof item === "string") {
      pushIfString(urls, item);
      continue;
    }
    pushIfString(urls, item?.url);
    pushIfString(urls, item?.dataUrl);
  }

  for (const item of body.attachments || []) {
    pushIfString(urls, item?.url);
    pushIfString(urls, item?.dataUrl);
  }

  // 去重，最多 4 张，防止 payload 过大
  return Array.from(new Set(urls)).slice(0, 4);
}

function historyToMessages(history?: ChatBody["chatHistory"]) {
  if (!history?.length) return [] as OpenAIMessage[];
  return history
    .filter((item) => item.role === "user" || item.role === "assistant")
    .slice(-6)
    .map((item) => ({
      role: item.role as "user" | "assistant",
      content: (item.content || "").trim()
    }))
    .filter((item) => Boolean(item.content)) as OpenAIMessage[];
}

function stringifyContext(body: ChatBody) {
  const contextPayload = {
    profile: body.profile,
    context: body.context
  };
  try {
    const raw = JSON.stringify(contextPayload);
    return raw === "{}" ? "" : raw;
  } catch {
    return "";
  }
}

function buildMessages(body: ChatBody, prompt: string, imageUrls: string[]): OpenAIMessage[] {
  const userText = (body.message || body.question || "").trim();
  const contextText = stringifyContext(body);
  const mergedText = [userText, contextText ? `上下文：${contextText}` : ""].filter(Boolean).join("\n\n");
  const fallbackText = mergedText || (imageUrls.length > 0 ? "请结合图片判断并给出建议。" : "请给我一条术后康复建议。");

  const messages: OpenAIMessage[] = [{ role: "system", content: prompt }, ...historyToMessages(body.chatHistory)];

  if (imageUrls.length === 0) {
    messages.push({ role: "user", content: fallbackText });
    return messages;
  }

  messages.push({
    role: "user",
    content: [
      { type: "text", text: fallbackText },
      ...imageUrls.map((url) => ({
        type: "image_url" as const,
        image_url: { url }
      }))
    ]
  });
  return messages;
}

function normalizeContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: string }).text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatBody;
    const scenario = body.scenario || "home";
    const { provider, apiKey, baseUrl, textModel, visionModel } = getEnvConfig();

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "API key missing",
          detail: "未读取到 xxx_KEY / AI_API_KEY / XXX_KEY / MODELSCOPE_API_KEY，请检查 .env.local"
        },
        { status: 500 }
      );
    }

    const imageUrls = normalizeImageUrls(body);
    const useVision = imageUrls.length > 0;
    const model = useVision ? visionModel : textModel;
    const prompt = body.systemPrompt?.trim() || getScenarioPrompt(scenario);
    const messages = buildMessages(body, prompt, imageUrls);
    const timeoutRaw = Number((process.env.AI_TIMEOUT_MS || "").trim());
    const requestTimeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.floor(timeoutRaw) : 30000;

    const endpoint = `${baseUrl}/chat/completions`;
    const payload: Record<string, unknown> = {
      model,
      temperature: 0.3,
      messages
    };

    // Qwen3 在非流式接口通常需要显式关闭 thinking
    if (provider === "modelscope") {
      payload.enable_thinking = false;
    }

    const upstream = await fetchWithTimeout(
      endpoint,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      cache: "no-store"
      },
      requestTimeoutMs
    );

    const rawBody = await upstream.text();

    if (!upstream.ok) {
      // 失败时打印上游响应，便于你直接在终端定位问题
      console.error("[ModelScope upstream error]", {
        status: upstream.status,
        body: rawBody
      });

      return NextResponse.json(
        {
          ok: false,
          error: "AI 服务暂不可用",
          detail: `upstream_status_${upstream.status}`
        },
        { status: 500 }
      );
    }

    let parsed: { choices?: Array<{ message?: { content?: unknown } }> };
    try {
      parsed = JSON.parse(rawBody) as { choices?: Array<{ message?: { content?: unknown } }> };
    } catch {
      console.error("[ModelScope parse error]", { body: rawBody });
      return NextResponse.json(
        {
          ok: false,
          error: "AI 返回格式异常",
          detail: "invalid_upstream_json"
        },
        { status: 500 }
      );
    }

    const content = normalizeContent(parsed.choices?.[0]?.message?.content);
    if (!content) {
      console.error("[ModelScope empty content]", { body: rawBody });
      return NextResponse.json(
        {
          ok: false,
          error: "AI 暂无有效回复",
          detail: "empty_upstream_response"
        },
        { status: 500 }
      );
    }

    const answer = content;
    return NextResponse.json({
      ok: true,
      source: "ai",
      model,
      answer,
      reply: answer
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/ai/chat] fatal error", error);
    return NextResponse.json(
      {
        ok: false,
        error: "AI route failed",
        detail
      },
      { status: 500 }
    );
  }
}

type AIProvider = "modelscope" | "openai";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIImageAttachment {
  dataUrl: string;
  name?: string;
  type?: string;
}

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  textModel: string;
  visionModel: string;
}

interface ChatOptions {
  temperature?: number;
  attachments?: AIImageAttachment[];
  forceVision?: boolean;
  timeoutMs?: number;
  maxAttempts?: number;
  model?: string;
}

const DEFAULTS = {
  modelscope: {
    baseUrl: "https://api-inference.modelscope.cn/v1",
    textModel: "Qwen/Qwen3-8B",
    visionModel: "Qwen/Qwen3-VL-8B-Instruct"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    textModel: "gpt-4o-mini",
    visionModel: "gpt-4o-mini"
  }
} as const;

function cleanBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function normalizeProvider(raw?: string): AIProvider {
  const value = (raw || "").trim().toLowerCase();
  if (value === "openai") return "openai";
  return "modelscope";
}

function resolveAIConfig(): AIConfig {
  const provider = normalizeProvider(process.env.AI_PROVIDER);

  const apiKey =
    (process.env.xxx_KEY || "").trim() ||
    (process.env.AI_API_KEY || "").trim() ||
    (process.env.XXX_KEY || "").trim() ||
    (provider === "modelscope" ? process.env.MODELSCOPE_API_KEY || "" : process.env.OPENAI_API_KEY || "").trim();

  const baseUrl = cleanBaseUrl(
    (process.env.AI_BASE_URL || "").trim() ||
      (provider === "modelscope"
        ? (process.env.MODELSCOPE_BASE_URL || "").trim()
        : (process.env.OPENAI_BASE_URL || "").trim()) ||
      DEFAULTS[provider].baseUrl
  );

  const textModel =
    (process.env.AI_MODEL_TEXT || "").trim() ||
    (provider === "modelscope" ? (process.env.MODELSCOPE_MODEL || "").trim() : (process.env.OPENAI_MODEL || "").trim()) ||
    DEFAULTS[provider].textModel;

  const visionModel = (process.env.AI_MODEL_VISION || "").trim() || DEFAULTS[provider].visionModel;

  return {
    provider,
    apiKey,
    baseUrl,
    textModel,
    visionModel
  };
}

function getMessageContentValue(
  value: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>
) {
  if (typeof value === "string") return value;
  return value
    .map((item) => (item.type === "text" ? item.text : "[图片]"))
    .join("\n")
    .trim();
}

function normalizeAssistantContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: string }).text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
}

function shouldUseVision(options?: ChatOptions) {
  if (!options?.attachments || options.attachments.length === 0) return false;
  return true;
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

export function isAIConfigured() {
  return Boolean(resolveAIConfig().apiKey);
}

export function getAIConfigStatus() {
  const config = resolveAIConfig();
  return {
    provider: config.provider,
    configured: Boolean(config.apiKey),
    model: config.textModel,
    visionModel: config.visionModel,
    baseUrl: config.baseUrl
  };
}

function buildPayloadMessages(messages: AIMessage[], systemPrompt?: string, attachments?: AIImageAttachment[]) {
  type PayloadMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
  };

  const list: PayloadMessage[] = [];

  if (systemPrompt?.trim()) {
    list.push({ role: "system", content: systemPrompt.trim() });
  }

  const safeMessages: PayloadMessage[] = messages.map((item) => ({ role: item.role, content: item.content || "" }));
  if (safeMessages.length === 0) {
    safeMessages.push({ role: "user", content: "" });
  }

  if (attachments && attachments.length > 0) {
    const last = safeMessages[safeMessages.length - 1];
    const text = getMessageContentValue(last.content);
    const multimodalContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
      { type: "text", text: text || "请结合图片分析。" }
    ];
    attachments.forEach((item) => {
      multimodalContent.push({ type: "image_url", image_url: { url: item.dataUrl } });
    });
    safeMessages[safeMessages.length - 1] = {
      ...last,
      content: multimodalContent
    };
  }

  return [...list, ...safeMessages];
}

export async function chatCompletion(messages: AIMessage[], systemPrompt?: string, options?: ChatOptions) {
  const config = resolveAIConfig();
  if (!config.apiKey) {
    throw new Error("AI key missing");
  }

  const useVision = options?.forceVision || shouldUseVision(options);
  const model = options?.model?.trim() || (useVision ? config.visionModel : config.textModel);
  const payloadMessages = buildPayloadMessages(messages, systemPrompt, options?.attachments);
  const timeoutMs =
    typeof options?.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Math.floor(options.timeoutMs)
      : 30000;
  const maxAttempts =
    typeof options?.maxAttempts === "number" && Number.isFinite(options.maxAttempts) && options.maxAttempts >= 1
      ? Math.min(Math.floor(options.maxAttempts), 5)
      : 3;

  const payload: Record<string, unknown> = {
    model,
    temperature: options?.temperature ?? 0.3,
    messages: payloadMessages
  };

  if (config.provider === "modelscope") {
    // Qwen3 系列在非流式请求里常要求显式关闭 thinking
    payload.enable_thinking = false;
  }

  let lastError: unknown = new Error("AI request failed");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        `${config.baseUrl}/chat/completions`,
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload),
        cache: "no-store"
        },
        timeoutMs
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI request failed: ${response.status} ${text}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const rawContent = data.choices?.[0]?.message?.content;
      const content = normalizeAssistantContent(rawContent);
      if (!content) {
        throw new Error("AI empty response");
      }
      return content;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 600));
      }
    }
  }

  throw lastError;
}

function safeExtractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    const startObj = raw.indexOf("{");
    const endObj = raw.lastIndexOf("}");
    if (startObj >= 0 && endObj > startObj) {
      return JSON.parse(raw.slice(startObj, endObj + 1));
    }
    const startArr = raw.indexOf("[");
    const endArr = raw.lastIndexOf("]");
    if (startArr >= 0 && endArr > startArr) {
      return JSON.parse(raw.slice(startArr, endArr + 1));
    }
    throw new Error("Invalid JSON output");
  }
}

export async function askAIText(systemPrompt: string, userPrompt: string, options?: ChatOptions) {
  return chatCompletion([{ role: "user", content: userPrompt }], systemPrompt, options);
}

export async function askAIJson<T>(systemPrompt: string, userPrompt: string, options?: ChatOptions): Promise<T> {
  const content = await chatCompletion(
    [{ role: "user", content: userPrompt }],
    `${systemPrompt}\n请严格输出 JSON 对象，不要输出 Markdown。`,
    options
  );

  try {
    return safeExtractJson(content) as T;
  } catch {
    const repaired = await chatCompletion(
      [
        {
          role: "user",
          content: `请把下面内容修复为严格 JSON，只输出 JSON 本体：\n${content}`
        }
      ],
      "你是 JSON 修复助手。只返回一个合法 JSON 对象，不要解释。",
      options
    );
    return safeExtractJson(repaired) as T;
  }
}

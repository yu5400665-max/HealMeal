import { askAIText } from "@/src/lib/aiClient";
import { buildAICacheKey, getAICache, setAICache } from "@/src/lib/aiCache";
import { stripMedicalDisclaimer } from "@/src/lib/disclaimer";
import type { Profile } from "@/src/lib/types";

type Scenario = "home" | "meal" | "exercise" | "emotion" | "family";
type SpeedMode = "fast" | "slow";

interface Attachment {
  dataUrl?: string;
  name?: string;
  type?: string;
}

interface StreamBody {
  scenario?: Scenario;
  message?: string;
  profile?: Profile;
  context?: Record<string, unknown>;
  attachments?: Attachment[];
  speed?: SpeedMode;
}

function getScenarioPrompt(scenario: Scenario) {
  const common = "你是愈后食光 HealMeal 的术后康复助手。使用中文，先给1句结论，再给细节建议。不得给出诊断或处方。";
  if (scenario === "meal") return `${common} 场景：饮食建议与食材判断。`;
  if (scenario === "exercise") return `${common} 场景：恢复期运动建议。`;
  if (scenario === "emotion") return `${common} 场景：情绪陪伴与记录总结。`;
  if (scenario === "family") return `${common} 场景：家属协助与沟通。`;
  return `${common} 场景：首页快速问答。`;
}

function parseTimeout(speed: SpeedMode, model?: string) {
  const modelName = (model || "").toLowerCase();
  const fallback =
    speed === "fast"
      ? modelName.includes("32b")
        ? 22000
        : 12000
      : 25000;
  const envKey = speed === "fast" ? process.env.AI_TIMEOUT_FAST_MS : process.env.AI_TIMEOUT_SLOW_MS;
  const value = Number((envKey || "").trim());
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function pickModel(speed: SpeedMode, hasImage: boolean) {
  if (speed === "fast") {
    if (hasImage) return (process.env.AI_MODEL_FAST_VISION || process.env.AI_MODEL_VISION || "").trim() || undefined;
    return (process.env.AI_MODEL_FAST_TEXT || process.env.AI_MODEL_TEXT || "").trim() || undefined;
  }
  if (hasImage) return (process.env.AI_MODEL_SLOW_VISION || process.env.AI_MODEL_VISION || "").trim() || undefined;
  return (process.env.AI_MODEL_SLOW_TEXT || process.env.AI_MODEL_TEXT || "").trim() || undefined;
}

function compactContextKey(body: StreamBody) {
  return {
    date: new Date().toISOString().slice(0, 10),
    scenario: body.scenario,
    speed: body.speed,
    message: (body.message || "").trim(),
    profile: {
      postOpDay: body.profile?.postOpDay,
      surgery: body.profile?.surgeryDisplayName || body.profile?.surgeryFinal,
      avoidFoods: body.profile?.longTermAvoidFoods || body.profile?.avoidFoods || [],
      allergens: body.profile?.allergens || []
    },
    context: {
      dietStage: body.context?.dietStage,
      symptom: body.context?.symptom,
      appetite: body.context?.appetite,
      availableIngredients: body.context?.availableIngredients,
      cookingTimeMinutes: body.context?.cookingTimeMinutes
    }
  };
}

function writeChunked(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, text: string, size = 24) {
  for (let i = 0; i < text.length; i += size) {
    controller.enqueue(encoder.encode(text.slice(i, i + size)));
  }
}

function friendlyErrorText() {
  return "AI服务响应超时或网络波动，请点击重试再试一次。";
}

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  let body: StreamBody;
  try {
    body = (await req.json()) as StreamBody;
  } catch {
    return new Response("请求格式错误", { status: 400 });
  }

  const scenario = body.scenario || "home";
  const speed = body.speed || "fast";
  const question = (body.message || "").trim();
  const cacheKey = buildAICacheKey(compactContextKey({ ...body, scenario, speed }));
  const cached = getAICache(cacheKey);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        try {
          if (cached) {
            writeChunked(controller, encoder, cached);
            controller.close();
            return;
          }

          const prompt = getScenarioPrompt(scenario);
          const userPayload = JSON.stringify(
            {
              message: question || "请结合我的恢复状态给出建议",
              profile: body.profile,
              context: body.context
            },
            null,
            2
          );

          const attachments = (body.attachments || [])
            .filter((item) => Boolean(item?.dataUrl))
            .map((item) => ({ dataUrl: String(item.dataUrl), name: item.name, type: item.type }));

          const pickedModel = pickModel(speed, attachments.length > 0);
          const answer = await askAIText(prompt, userPayload, {
            timeoutMs: parseTimeout(speed, pickedModel),
            maxAttempts: 2,
            attachments,
            model: pickedModel
          });

          const cleanAnswer = stripMedicalDisclaimer(answer);
          writeChunked(controller, encoder, cleanAnswer);
          setAICache(cacheKey, cleanAnswer, 6 * 60 * 60 * 1000);
          controller.close();
        } catch (error) {
          console.error("[/api/ai/stream] failed", error);
          writeChunked(controller, encoder, `\n${friendlyErrorText()}`);
          controller.close();
        }
      })();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

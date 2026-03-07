import { NextResponse } from "next/server";
import { getAIConfigStatus } from "@/src/lib/aiClient";

export async function GET() {
  const status = getAIConfigStatus();

  return NextResponse.json({
    ok: true,
    provider: status.provider,
    configured: status.configured,
    model: status.model,
    visionModel: status.visionModel,
    baseUrl: status.baseUrl
  });
}

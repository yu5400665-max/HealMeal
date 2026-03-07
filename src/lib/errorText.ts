export function toFriendlyError(error: unknown, fallback = "当前服务有点忙，请稍后重试。") {
  const detail = error instanceof Error ? error.message : String(error || "");
  const raw = detail.toLowerCase();
  if (raw.includes("not-allowed") || raw.includes("forbidden") || raw.includes("401") || raw.includes("403")) {
    return "当前服务权限受限，请稍后重试。";
  }
  if (raw.includes("timeout") || raw.includes("abort")) {
    return "响应超时了，请点重试。";
  }
  return fallback;
}


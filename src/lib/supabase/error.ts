export interface SupabaseErrorInfo {
  message: string;
  details: string;
  hint: string;
  code: string;
  status: string;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function statusValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return "";
}

export function parseSupabaseError(error: unknown): SupabaseErrorInfo {
  if (!error) {
    return { message: "Unknown error", details: "", hint: "", code: "", status: "" };
  }

  if (error instanceof Error) {
    const maybe = error as Error & Record<string, unknown>;
    return {
      message: error.message || "Unknown error",
      details: stringValue(maybe.details),
      hint: stringValue(maybe.hint),
      code: stringValue(maybe.code),
      status: statusValue(maybe.status)
    };
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message: stringValue(record.message) || "Unknown error",
      details: stringValue(record.details),
      hint: stringValue(record.hint),
      code: stringValue(record.code),
      status: statusValue(record.status)
    };
  }

  return {
    message: String(error),
    details: "",
    hint: "",
    code: "",
    status: ""
  };
}

export function formatSupabaseError(info: SupabaseErrorInfo) {
  return [info.message, info.code && `code=${info.code}`, info.status && `status=${info.status}`, info.details && `details=${info.details}`, info.hint && `hint=${info.hint}`]
    .filter(Boolean)
    .join(" | ");
}


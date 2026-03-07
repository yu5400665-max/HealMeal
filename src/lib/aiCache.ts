type CacheEntry = {
  value: string;
  expiresAt: number;
};

const GLOBAL_KEY = "__healmeal_ai_cache__";

function getStore() {
  const globalRef = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: Map<string, CacheEntry>;
  };
  if (!globalRef[GLOBAL_KEY]) {
    globalRef[GLOBAL_KEY] = new Map<string, CacheEntry>();
  }
  return globalRef[GLOBAL_KEY] as Map<string, CacheEntry>;
}

export function getAICache(key: string) {
  const store = getStore();
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function setAICache(key: string, value: string, ttlMs = 6 * 60 * 60 * 1000) {
  const store = getStore();
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

function stableSortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortObject(item));
  }
  if (!value || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = stableSortObject(obj[key]);
      return acc;
    }, {});
}

export function buildAICacheKey(payload: Record<string, unknown>) {
  return JSON.stringify(stableSortObject(payload));
}


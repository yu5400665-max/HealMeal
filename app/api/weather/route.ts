import { NextResponse } from "next/server";

const WEATHER_CODE_MAP: Record<number, string> = {
  0: "晴",
  1: "晴间多云",
  2: "多云",
  3: "阴",
  45: "有雾",
  48: "雾凇",
  51: "小毛雨",
  53: "毛毛雨",
  55: "毛毛雨较强",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "阵雨",
  81: "较强阵雨",
  82: "强阵雨",
  95: "雷雨"
};

function toNumber(value: string | null) {
  if (!value) return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = toNumber(url.searchParams.get("lat"));
    const lon = toNumber(url.searchParams.get("lon"));
    const fallbackCity = (url.searchParams.get("city") || "").trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({
        ok: true,
        source: "fallback",
        city: fallbackCity || "所在地区",
        temperature: "--",
        weather: "天气待获取"
      });
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      }
    );

    if (!weatherRes.ok) {
      throw new Error("weather request failed");
    }

    const weatherData = (await weatherRes.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const code = Number(weatherData.current?.weather_code ?? -1);
    const temperature = Math.round(Number(weatherData.current?.temperature_2m ?? 0));
    const weather = WEATHER_CODE_MAP[code] || "多云";

    let city = fallbackCity || "所在地区";
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=zh&count=1`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(12000)
        }
      );
      if (geoRes.ok) {
        const geoData = (await geoRes.json()) as {
          results?: Array<{ name?: string; admin1?: string }>;
        };
        const first = geoData.results?.[0];
        city = first?.name || first?.admin1 || city;
      }
    } catch {
      // reverse geocode失败时使用fallback city
    }

    return NextResponse.json({
      ok: true,
      source: "open-meteo",
      city,
      temperature: Number.isFinite(temperature) ? temperature : "--",
      weather
    });
  } catch {
    return NextResponse.json({
      ok: true,
      source: "fallback",
      city: "所在地区",
      temperature: "--",
      weather: "天气待获取"
    });
  }
}


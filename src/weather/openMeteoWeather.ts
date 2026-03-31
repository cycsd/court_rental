import type { TimeSlotSummary } from "../types/schedule.js";
import { isCourtWetted } from "../notifier/weatherPresentation.js";
import type { WetnessConfig } from "../notifier/weatherPresentation.js";
import type { ProviderWeatherAtHour } from "./metNorwayWeather.js";

type OpenMeteoHourly = {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  weather_code: number[];
};

type OpenMeteoResponse = {
  hourly?: OpenMeteoHourly;
};

const WEATHER_CODE_TO_TEXT: Record<number, string> = {
  0: "晴朗",
  1: "大致晴",
  2: "局部多雲",
  3: "陰",
  45: "霧",
  48: "霧",
  51: "毛毛雨",
  53: "毛毛雨",
  55: "毛毛雨",
  61: "雨",
  63: "雨",
  65: "雨",
  66: "凍雨",
  67: "凍雨",
  71: "雪",
  73: "雪",
  75: "雪",
  80: "陣雨",
  81: "陣雨",
  82: "陣雨",
  95: "雷雨",
  96: "雷雨",
  99: "雷雨"
};

function weatherCodeText(code: number): string {
  return WEATHER_CODE_TO_TEXT[code] ?? "未知天氣";
}

function estimatePrecipitationMm(weatherCode: number, precipitationProbability?: number): number {
  const probability = Math.max(0, Math.min(100, precipitationProbability ?? 0));

  // Convert Open-Meteo probability to MET-like hourly precipitation amount using weather type intensity.
  const typeMaxMm =
    weatherCode >= 95
      ? 10
      : weatherCode >= 80
        ? 6
        : weatherCode >= 66
          ? 3
          : weatherCode >= 61
            ? 4
            : weatherCode >= 51
              ? 1.2
              : weatherCode >= 71 && weatherCode <= 75
                ? 1.8
                : 0;

  const estimatedMm = typeMaxMm * (probability / 100);

  if (typeMaxMm > 0 && probability >= 20) {
    return Math.max(0.1, Number(estimatedMm.toFixed(2)));
  }
  return Number(estimatedMm.toFixed(2));
}

function hourKey(isoTime: string): string {
  const date = isoTime.slice(0, 10);
  const hour = isoTime.slice(11, 13);
  return `${date} ${hour}:00`;
}

export async function fetchOpenMeteoHourlyWeather(
  lat: number,
  lon: number,
  timezone: string
): Promise<Map<string, ProviderWeatherAtHour>> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code");
  url.searchParams.set("timezone", timezone);

  let lastError: unknown;
  let data: OpenMeteoResponse | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Open-Meteo request failed with HTTP ${response.status}`);
      }
      data = (await response.json()) as OpenMeteoResponse;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!data) {
    throw new Error(`Open-Meteo request failed after retries: ${String(lastError)}`);
  }

  const hourly = data.hourly;
  const map = new Map<string, ProviderWeatherAtHour>();

  if (!hourly) {
    return map;
  }

  for (let i = 0; i < hourly.time.length; i++) {
    const key = hourKey(hourly.time[i]);
    const weatherCode = hourly.weather_code[i];
    const precipitationProbability = hourly.precipitation_probability[i];
    map.set(key, {
      weatherText: weatherCodeText(weatherCode),
      temperatureC: hourly.temperature_2m[i],
      precipitationMm: estimatePrecipitationMm(weatherCode, precipitationProbability)
    });
  }

  return map;
}

export function mergeWeatherToSummary(
  summary: TimeSlotSummary[],
  weatherMap: Map<string, ProviderWeatherAtHour>,
  wetnessConfig?: WetnessConfig
): TimeSlotSummary[] {
  // First pass: merge weather fields
  const merged = summary.map((slot) => {
    const weather = weatherMap.get(`${slot.date} ${slot.time}`);
    if (!weather) {
      return slot;
    }
    return {
      ...slot,
      weatherText: weather.weatherText,
      temperatureC: weather.temperatureC,
      precipitationMm: weather.precipitationMm
    };
  });

  // Second pass: compute isWetted in chronological order so previous-hour score can be reused.
  const wetScoreMemory = new Map<string, number>();
  const sortedSlots = [...merged].sort((a, b) => {
    const left = `${a.date} ${a.time}`;
    const right = `${b.date} ${b.time}`;
    return left.localeCompare(right);
  });

  const isWettedByKey = new Map<string, boolean>();
  for (const slot of sortedSlots) {
    const key = `${slot.date} ${slot.time}`;
    isWettedByKey.set(
      key,
      isCourtWetted(slot, (historyKey) => weatherMap.get(historyKey), {
        ...wetnessConfig,
        getWetScore: (historyKey) => wetScoreMemory.get(historyKey),
        setWetScore: (historyKey, wetScore) => {
          wetScoreMemory.set(historyKey, wetScore);
        }
      })
    );
  }

  return merged.map((slot) => {
    const key = `${slot.date} ${slot.time}`;
    return {
      ...slot,
      wetScore: wetScoreMemory.get(key),
      isWetted: isWettedByKey.get(key) ?? isCourtWetted(slot, (historyKey) => weatherMap.get(historyKey), wetnessConfig)
    };
  });
}

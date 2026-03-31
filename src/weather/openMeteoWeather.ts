import type { TimeSlotSummary } from "../types/schedule.js";
import { isCourtWetted } from "../notifier/weatherPresentation.js";
import type { WetnessConfig } from "../notifier/weatherPresentation.js";

type OpenMeteoHourly = {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  weather_code: number[];
};

type OpenMeteoResponse = {
  hourly?: OpenMeteoHourly;
};

type WeatherAtHour = {
  weatherText: string;
  temperatureC: number;
  precipitationProbability: number;
};

function weatherCodeText(code: number): string {
  if (code === 0) return "晴朗";
  if (code === 1) return "大致晴";
  if (code === 2) return "局部多雲";
  if (code === 3) return "陰";
  if (code === 45 || code === 48) return "霧";
  if (code === 51 || code === 53 || code === 55) return "毛毛雨";
  if (code === 61 || code === 63 || code === 65) return "雨";
  if (code === 66 || code === 67) return "凍雨";
  if (code === 71 || code === 73 || code === 75) return "雪";
  if (code === 80 || code === 81 || code === 82) return "陣雨";
  if (code === 95 || code === 96 || code === 99) return "雷雨";
  return "未知天氣";
}

function hourKey(isoTime: string): string {
  const date = isoTime.slice(0, 10);
  const hour = isoTime.slice(11, 13);
  return `${date} ${hour}:00`;
}

export async function fetchTodayHourlyWeather(
  lat: number,
  lon: number,
  timezone: string
): Promise<Map<string, WeatherAtHour>> {
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
  const map = new Map<string, WeatherAtHour>();

  if (!hourly) {
    return map;
  }

  for (let i = 0; i < hourly.time.length; i++) {
    const key = hourKey(hourly.time[i]);
    map.set(key, {
      weatherText: weatherCodeText(hourly.weather_code[i]),
      temperatureC: hourly.temperature_2m[i],
      precipitationProbability: hourly.precipitation_probability[i]
    });
  }

  return map;
}

export function mergeWeatherToSummary(
  summary: TimeSlotSummary[],
  weatherMap: Map<string, WeatherAtHour>,
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
      precipitationProbability: weather.precipitationProbability
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

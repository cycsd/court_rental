import type { TimeSlotSummary } from "../types/schedule.js";
import { isCourtUsable } from "../notifier/weatherPresentation.js";

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
  const hour = isoTime.slice(11, 13);
  return `${hour}:00`;
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

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoResponse;
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
  weatherMap: Map<string, WeatherAtHour>
): TimeSlotSummary[] {
  // First pass: merge weather fields
  const merged = summary.map((slot) => {
    const weather = weatherMap.get(slot.time);
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

  // Second pass: compute isUsable now that every slot has weather data
  // weatherMap has all 24 hours so lookups like 01:00-07:00 work correctly for early slots
  return merged.map((slot) => ({
    ...slot,
    isUsable: isCourtUsable(slot, (key) => weatherMap.get(key))
  }));
}

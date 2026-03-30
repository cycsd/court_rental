import type { TimeSlotSummary } from "../types/schedule.js";

export type WeatherIconType =
  | "thunder"
  | "rain"
  | "snow"
  | "fog"
  | "sunny"
  | "partly-sunny"
  | "partly-cloudy"
  | "cloudy"
  | "unknown";

export function isRainyWeather(weatherText?: string, precipitationProbability?: number): boolean {
  // if ((precipitationProbability ?? 0) >= 30) {
  //   return true;
  // }

  const text = weatherText ?? "";
  return (precipitationProbability ?? 0) >= 30 && /(雨|陣雨|雷雨|毛毛雨|凍雨)/.test(text);
}

export function getWeatherIconType(weatherText?: string): WeatherIconType {
  const text = weatherText ?? "";

  if (/雷雨/.test(text)) return "thunder";
  if (/(陣雨|毛毛雨|凍雨|雨)/.test(text)) return "rain";
  if (/雪/.test(text)) return "snow";
  if (/霧/.test(text)) return "fog";
  if (/晴朗/.test(text)) return "sunny";
  if (/大致晴/.test(text)) return "partly-sunny";
  if (/局部多雲/.test(text)) return "partly-cloudy";
  if (/陰/.test(text)) return "cloudy";

  return "unknown";
}

export function getWeatherTelegramIcon(weatherText?: string): string {
  switch (getWeatherIconType(weatherText)) {
    case "thunder":
      return "⛈️";
    case "rain":
      return "🌧️";
    case "snow":
      return "🌨️";
    case "fog":
      return "🌫️";
    case "sunny":
      return "☀️";
    case "partly-sunny":
      return "🌤️";
    case "partly-cloudy":
      return "⛅";
    case "cloudy":
      return "☁️";
    default:
      return "❔";
  }
}

export function buildWeatherTooltipText(
  weatherText?: string,
  temperatureC?: number,
  precipitationProbability?: number
): string {
  if (!weatherText) {
    return "目前沒有可用的天氣資料。";
  }

  const temperaturePart =
    temperatureC == null ? "氣溫資料暫缺" : `氣溫約 ${temperatureC.toFixed(1)} 度`;
  const precipitationPart =
    precipitationProbability == null
      ? "降雨機率資料暫缺"
      : `降雨機率約 ${precipitationProbability}%`;

  return `目前天氣為${weatherText}，${temperaturePart}，${precipitationPart}。`;
}

export function buildTelegramWeatherSummary(
  weatherText?: string,
  temperatureC?: number,
  precipitationProbability?: number
): string {
  if (!weatherText) {
    return "❔ 無天氣資料";
  }

  const temperaturePart = temperatureC == null ? "--.-C" : `${temperatureC.toFixed(1)}C`;
  const precipitationPart = precipitationProbability == null ? "--%" : `${precipitationProbability}%`;

  return `${getWeatherTelegramIcon(weatherText)} ${weatherText} ${temperaturePart} 降雨 ${precipitationPart}`;
}

export function getWeatherBadgeClassName(
  weatherText?: string,
  precipitationProbability?: number
): string {
  const iconType = getWeatherIconType(weatherText);
  const alertClass = isRainyWeather(weatherText, precipitationProbability)
    ? " weather-alert"
    : "";

  return `weather-badge weather-${iconType}${alertClass}`;
}

export type WeatherSnapshot = {
    weatherText?: string;
    temperatureC?: number;
    precipitationProbability?: number;
};

export type WetnessProfile = "conservative" | "balanced" | "aggressive";

export type WetnessConfig = {
  profile?: WetnessProfile;
  lookbackHours?: number;
  threshold?: number;
};

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseSlotDateHour(ts: TimeSlotSummary): Date | null {
  const dateMatch = ts.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const hourMatch = ts.time.match(/^(\d{2}):\d{2}$/);
  if (!dateMatch || !hourMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(hourMatch[1]);

  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function toHistoryKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:00`;
}

function isRainText(weatherText?: string): boolean {
  return /(雨|陣雨|雷雨|毛毛雨|凍雨)/.test(weatherText ?? "");
}

function rainInput(snapshot?: WeatherSnapshot): number {
  if (!snapshot) return 0;
  const rainByText = isRainText(snapshot.weatherText) ? 0.55 : 0;
  const rainByProbability = 0.45 * clamp(0, 1, (snapshot.precipitationProbability ?? 0) / 100);
  return clamp(0, 1, rainByText + rainByProbability);
}

function dryingFactor(snapshot?: WeatherSnapshot): number {
  const temperatureC = snapshot?.temperatureC ?? 23;
  return clamp(0.08, 0.3, 0.12 + 0.01 * (temperatureC - 20));
}

export function isCourtWetted(
  ts: TimeSlotSummary,
  weatherHistory: (dateHourKey: string) => WeatherSnapshot | undefined,
  config?: WetnessConfig
): boolean {
  const currentDateHour = parseSlotDateHour(ts);
  if (!currentDateHour) {
    return isRainyWeather(ts.weatherText, ts.precipitationProbability);
  }

  // If current weather is entirely missing, keep conservative behavior.
  const currentSnapshot = weatherHistory(toHistoryKey(currentDateHour));
  if (!currentSnapshot && !ts.weatherText && ts.temperatureC == null && ts.precipitationProbability == null) {
    return true;
  }

  const profile = config?.profile ?? "balanced";
  const defaultsByProfile: Record<WetnessProfile, { lookbackHours: number; threshold: number }> = {
    conservative: { lookbackHours: 10, threshold: 0.35 },
    balanced: { lookbackHours: 8, threshold: 0.45 },
    aggressive: { lookbackHours: 6, threshold: 0.55 }
  };

  const defaultConfig = defaultsByProfile[profile];

  // Wetness memory model: previous wetness decays with temperature and accumulates rain input.
  // This captures "rain stopped but court is still wet" behavior.
  const lookbackHours = clamp(
    3,
    24,
    config?.lookbackHours ?? defaultConfig.lookbackHours
  );
  const wetThreshold = clamp(
    0.1,
    0.95,
    config?.threshold ?? defaultConfig.threshold
  );
  let wetScore = 0;

  for (let offset = lookbackHours - 1; offset >= 0; offset--) {
    const hourDate = new Date(currentDateHour.getTime() - offset * 60 * 60 * 1000);
    const snapshot = weatherHistory(toHistoryKey(hourDate));
    const dry = dryingFactor(snapshot);
    const rain = rainInput(snapshot);
    wetScore = clamp(0, 1, wetScore * (1 - dry) + rain);
  }

  return wetScore >= wetThreshold;
}

export function isCourtUsable(ts: TimeSlotSummary): boolean {
    // 條件一 + 濕地判斷：有可用場地且場地不濕，才適合打球
    return ts.available > 0 && !(ts.isWetted ?? true);
}
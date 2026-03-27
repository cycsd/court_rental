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
  if ((precipitationProbability ?? 0) >= 30) {
    return true;
  }

  const text = weatherText ?? "";
  return /(雨|陣雨|雷雨|毛毛雨|凍雨)/.test(text);
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

export function isCourtUsable(
    ts: TimeSlotSummary,
    weatherHistory: (hourKey: string) => WeatherSnapshot | undefined
): boolean {
    // 條件一：該時段至少有一個場地未被租借
    if (ts.available === 0) return false;

    // 條件二：當前時段不在下雨
    if (isRainyWeather(ts.weatherText, ts.precipitationProbability)) return false;

    // 條件三：（前 7 個小時均不下雨）或（前 5 個小時均不下雨且溫度皆超過 23 度）
    // 可在修改成只要前一個時段判定為可使用就好，因為目前的場地是否還是溼的可以依據前一個時段的場地是否是溼的來判斷即可
    const currentHour = parseInt(ts.time.slice(0, 2), 10);

    const lookupPrevHours = (count: number): WeatherSnapshot[] =>
        Array.from({ length: count }, (_, i) => currentHour - count + i)
            .filter((h) => h >= 0)
            .map((h) => weatherHistory(`${String(h).padStart(2, "0")}:00`))
            .filter((w): w is WeatherSnapshot => w != null);

    const prev7 = lookupPrevHours(7);
    const prev5 = lookupPrevHours(5);

    const prev7NoRain = prev7.every(
        (s) => !isRainyWeather(s.weatherText, s.precipitationProbability)
    );
    const prev5NoRainAndWarm = prev5.every(
        (s) =>
            !isRainyWeather(s.weatherText, s.precipitationProbability) &&
            (s.temperatureC ?? 0) > 23
    );

    if (!prev7NoRain && !prev5NoRainAndWarm) return false;

    return true;
}
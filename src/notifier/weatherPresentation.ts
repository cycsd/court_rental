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
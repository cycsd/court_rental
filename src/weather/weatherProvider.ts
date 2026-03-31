import { fetchMetNorwayHourlyWeather, type ProviderWeatherAtHour } from "./metNorwayWeather.js";
import { fetchOpenMeteoHourlyWeather } from "./openMeteoWeather.js";

export type WeatherProvider = "met-norway" | "open-meteo";

function mergeMetWithOpenMeteoFallback(
    metMap: Map<string, ProviderWeatherAtHour>,
    openMeteoMap: Map<string, ProviderWeatherAtHour>
): Map<string, ProviderWeatherAtHour> {
    const merged = new Map(metMap);

    for (const [key, openValue] of openMeteoMap.entries()) {
        const metValue = merged.get(key);
        if (!metValue) {
            merged.set(key, openValue);
            continue;
        }

        // Keep MET as primary; only patch clearly missing/unknown fields.
        if (metValue.weatherText === "未知天氣" && openValue.weatherText !== "未知天氣") {
            merged.set(key, {
                weatherText: openValue.weatherText,
                temperatureC: metValue.temperatureC,
                precipitationMm: metValue.precipitationMm
            });
        }
    }

    return merged;
}

export async function fetchTodayHourlyWeatherByProvider(
  provider: WeatherProvider,
  lat: number,
  lon: number,
  timezone: string,
  metUserAgent: string
): Promise<Map<string, ProviderWeatherAtHour>> {
  if (provider === "open-meteo") {
    return fetchOpenMeteoHourlyWeather(lat, lon, timezone);
  }

    const [metResult, openMeteoResult] = await Promise.allSettled([
        fetchMetNorwayHourlyWeather(lat, lon, timezone, metUserAgent),
        fetchOpenMeteoHourlyWeather(lat, lon, timezone)
    ]);

    if (metResult.status === "fulfilled") {
        if (openMeteoResult.status === "fulfilled") {
            return mergeMetWithOpenMeteoFallback(metResult.value, openMeteoResult.value);
        }
        return metResult.value;
    }

    if (openMeteoResult.status === "fulfilled") {
        return openMeteoResult.value;
    }

    throw new Error(
        `Weather providers failed. MET: ${String(metResult.reason)} | Open-Meteo: ${String(openMeteoResult.reason)}`
    );
}

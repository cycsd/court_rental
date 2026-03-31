export type ProviderWeatherAtHour = {
  weatherText: string;
  temperatureC: number;
  precipitationMm: number;
};

type MetTimeseriesEntry = {
  time: string;
  data: {
    instant?: {
      details?: {
        air_temperature?: number;
      };
    };
    next_1_hours?: {
      summary?: {
        symbol_code?: string;
      };
      details?: {
        precipitation_amount?: number;
      };
    };
  };
};

type MetCompactResponse = {
  properties?: {
    timeseries?: MetTimeseriesEntry[];
  };
};

function toLocalHourKey(isoTime: string, timezone: string): string {
  const date = new Date(isoTime);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  return `${year}-${month}-${day} ${hour}:00`;
}

const MET_SYMBOL_TEXT_MAP: Record<string, string> = {
    clearsky: "晴朗",
    fair: "大致晴",
    partlycloudy: "局部多雲",
    cloudy: "陰",
    fog: "霧",

    lightrain: "雨",
    rain: "雨",
    heavyrain: "雨",
    rainshowers: "陣雨",
    lightrainshowers: "陣雨",
    heavyrainshowers: "陣雨",
    rainandthunder: "雷雨",
    lightrainandthunder: "雷雨",
    heavyrainandthunder: "雷雨",
    rainshowersandthunder: "雷雨",
    lightrainshowersandthunder: "雷雨",
    heavyrainshowersandthunder: "雷雨",

    lightsleet: "凍雨",
    sleet: "凍雨",
    heavysleet: "凍雨",
    sleetshowers: "陣雨",
    lightsleetshowers: "陣雨",
    heavysleetshowers: "陣雨",
    sleetandthunder: "雷雨",
    lightsleetandthunder: "雷雨",
    heavysleetandthunder: "雷雨",
    sleetshowersandthunder: "雷雨",
    lightsleetshowersandthunder: "雷雨",
    heavysleetshowersandthunder: "雷雨",

    lightsnow: "雪",
    snow: "雪",
    heavysnow: "雪",
    snowshowers: "雪",
    lightsnowshowers: "雪",
    heavysnowshowers: "雪",
    snowandthunder: "雷雨",
    lightsnowandthunder: "雷雨",
    heavysnowandthunder: "雷雨",
    snowshowersandthunder: "雷雨",
    lightsnowshowersandthunder: "雷雨",
    heavysnowshowersandthunder: "雷雨",

    // Historical typo aliases in MET icon codes.
    lightssleetshowersandthunder: "雷雨",
    lightssnowshowersandthunder: "雷雨"
};

function normalizeMetSymbol(symbolCode?: string): string {
    if (!symbolCode) {
        return "";
    }
    return symbolCode.replace(/_(day|night|polartwilight)$/, "").toLowerCase();
}

function metSymbolToText(symbolCode?: string): string {
    const normalized = normalizeMetSymbol(symbolCode);
    const mapped = MET_SYMBOL_TEXT_MAP[normalized];
    if (mapped) {
        return mapped;
    }

    // Safety fallbacks for any future symbol additions.
    if (normalized.includes("thunder")) return "雷雨";
    if (normalized.includes("snow")) return "雪";
    if (normalized.includes("sleet") || normalized.includes("freezingrain")) return "凍雨";
    if (normalized.includes("showers") || normalized.includes("rain")) return "雨";
    if (normalized.includes("drizzle")) return "毛毛雨";
    if (normalized.includes("fog")) return "霧";
    if (normalized.includes("partlycloudy")) return "局部多雲";
    if (normalized.includes("cloudy")) return "陰";
    if (normalized.includes("clearsky")) return "晴朗";
    if (normalized.includes("fair")) return "大致晴";

  return "未知天氣";
}

export async function fetchMetNorwayHourlyWeather(
  lat: number,
  lon: number,
  timezone: string,
  userAgent: string
): Promise<Map<string, ProviderWeatherAtHour>> {
  const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  let lastError: unknown;
  let data: MetCompactResponse | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": userAgent
        }
      });
      if (!response.ok) {
        throw new Error(`MET Norway request failed with HTTP ${response.status}`);
      }
      data = (await response.json()) as MetCompactResponse;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!data) {
    throw new Error(`MET Norway request failed after retries: ${String(lastError)}`);
  }

  const map = new Map<string, ProviderWeatherAtHour>();
  const timeseries = data.properties?.timeseries ?? [];

  for (const entry of timeseries) {
    const key = toLocalHourKey(entry.time, timezone);
    const symbolCode = entry.data.next_1_hours?.summary?.symbol_code;
    const precipitationMm = entry.data.next_1_hours?.details?.precipitation_amount ?? 0;
    const temperatureC = entry.data.instant?.details?.air_temperature;
    if (temperatureC == null) {
      continue;
    }

    map.set(key, {
      weatherText: metSymbolToText(symbolCode),
      temperatureC,
      precipitationMm
    });
  }

  return map;
}

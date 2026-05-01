"""Weather proxy — Open-Meteo forecast + air quality, with climate-based
estimate fallback for out-of-horizon trips.

Routing logic on each cache miss:
  1. Try /forecast (16-day horizon) + /air-quality in parallel.
  2. If forecast returns 400 with "out of allowed range" → estimate path.
  3. Estimate path: parallel /climate (MRI_AGCM3_2_S) + /archive (-365d).
     Blend continuous fields 0.6 climate + 0.4 historical, leader weather
     code from historical, diurnal temperature curve from climate mean.
  4. Both estimate APIs fail → return source=unavailable, days=[].

Caches are per-source. Process-local dict; restarts wipe it.
"""
from __future__ import annotations

import asyncio
import logging
import math
import re
import time
from collections import defaultdict
from datetime import date as Date, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.limiter import limiter

logger = logging.getLogger("roam.weather")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(
        logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s", datefmt="%H:%M:%S")
    )
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)


router = APIRouter(prefix="/weather", tags=["weather"])


FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
CLIMATE_URL = "https://climate-api.open-meteo.com/v1/climate"
HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"

FORECAST_CACHE_TTL_SEC = 24 * 60 * 60          # 24 hours
ESTIMATE_CACHE_TTL_SEC = 30 * 24 * 60 * 60     # 30 days
UPSTREAM_TIMEOUT_SEC = 10.0
ESTIMATE_TIMEOUT_SEC = 15.0  # climate API is slower than forecast

OUT_OF_RANGE_RE = re.compile(r"out of allowed range", re.IGNORECASE)

HOURLY_FORECAST_FIELDS = ",".join([
    "weather_code",
    "precipitation",
    "snowfall",
    "cloud_cover",
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "wind_speed_10m",
    "wind_direction_10m",
    "visibility",
    "relative_humidity_2m",
    "apparent_temperature",
    "uv_index",
])
DAILY_FORECAST_FIELDS = ",".join([
    "sunrise",
    "sunset",
    "temperature_2m_max",
    "temperature_2m_min",
])
HOURLY_AIR_FIELDS = ",".join(["us_aqi", "pm2_5", "pm10"])

# Climate API daily fields. weather_code added so we can pick a leader
# pattern when historical is unavailable.
DAILY_CLIMATE_FIELDS = ",".join([
    "temperature_2m_mean",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "cloud_cover_mean",
    "wind_speed_10m_mean",
    "wind_direction_10m_dominant",
    "weather_code",
])

# Try the higher-resolution model first; fall back if upstream rejects it.
CLIMATE_MODELS = ["MRI_AGCM3_2_S", "EC_Earth3P_HR"]


# Module-level cache. Key includes ":estimate" suffix for estimate
# responses so a forecast cache hit can never serve an estimate request
# (or vice versa).
_cache: dict[str, dict[str, Any]] = {}


# --------------------------------------------------------------------------- #
# Helpers — index/parse                                                       #
# --------------------------------------------------------------------------- #

def _at(arr: list, i: int, default: Any = 0) -> Any:
    """Defensive index — returns default if out-of-range or value is None."""
    if i < 0 or i >= len(arr):
        return default
    val = arr[i]
    return default if val is None else val


def _air_value(arr: list, i: int | None) -> float | None:
    """Index helper for air-quality fields. Returns None when air data is
    absent (best-effort fetch failed) or the slot is missing/null."""
    if i is None or i < 0 or i >= len(arr):
        return None
    val = arr[i]
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _shortest_arc(a: float, b: float, t: float) -> float:
    """Compass-angle blend along the shortest arc. t in [0,1]."""
    delta = ((b - a + 540.0) % 360.0) - 180.0
    return ((a + delta * t) + 360.0) % 360.0


# --------------------------------------------------------------------------- #
# Forecast transform (existing, unchanged)                                    #
# --------------------------------------------------------------------------- #

def _transform_forecast(
    forecast: dict[str, Any],
    air: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    hourly = forecast.get("hourly") or {}
    daily = forecast.get("daily") or {}
    air_hourly = (air or {}).get("hourly") or {}

    times: list[str] = hourly.get("time") or []
    weather_codes = hourly.get("weather_code") or []
    precip = hourly.get("precipitation") or []
    snow = hourly.get("snowfall") or []
    cloud = hourly.get("cloud_cover") or []
    cloud_low = hourly.get("cloud_cover_low") or []
    cloud_mid = hourly.get("cloud_cover_mid") or []
    cloud_high = hourly.get("cloud_cover_high") or []
    wind_kmh = hourly.get("wind_speed_10m") or []
    wind_dir_from = hourly.get("wind_direction_10m") or []
    visibility = hourly.get("visibility") or []
    humidity = hourly.get("relative_humidity_2m") or []
    apparent = hourly.get("apparent_temperature") or []
    uv = hourly.get("uv_index") or []

    air_times: list[str] = air_hourly.get("time") or []
    aqi = air_hourly.get("us_aqi") or []
    pm25 = air_hourly.get("pm2_5") or []
    pm10 = air_hourly.get("pm10") or []
    air_idx_by_time = {t: i for i, t in enumerate(air_times)}

    days_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for i, t in enumerate(times):
        try:
            date_str, hour_str = t.split("T", 1)
            hour = int(hour_str.split(":", 1)[0])
        except (ValueError, IndexError):
            continue

        kmh = _at(wind_kmh, i, 0)
        wdir_from = _at(wind_dir_from, i, 0)
        air_i = air_idx_by_time.get(t)

        days_map[date_str].append({
            "hour": hour,
            "weatherCode": int(_at(weather_codes, i, 0)),
            "precipitationMmHr": float(_at(precip, i, 0)),
            "snowfallCmHr": float(_at(snow, i, 0)),
            "cloudCover": float(_at(cloud, i, 0)),
            "cloudCoverLow": float(_at(cloud_low, i, 0)),
            "cloudCoverMid": float(_at(cloud_mid, i, 0)),
            "cloudCoverHigh": float(_at(cloud_high, i, 0)),
            "windSpeedMps": float(kmh) / 3.6,
            "windAngleDeg": (float(wdir_from) + 180.0) % 360.0,
            "visibilityM": float(_at(visibility, i, 10000)),
            "humidity": float(_at(humidity, i, 50)),
            "apparentTempC": float(_at(apparent, i, 18)),
            "uvIndex": float(_at(uv, i, 0)),
            "usAqi": _air_value(aqi, air_i),
            "pm25": _air_value(pm25, air_i),
            "pm10": _air_value(pm10, air_i),
        })

    daily_dates: list[str] = daily.get("time") or []
    sunrises = daily.get("sunrise") or []
    sunsets = daily.get("sunset") or []
    tmaxs = daily.get("temperature_2m_max") or []
    tmins = daily.get("temperature_2m_min") or []

    daily_map: dict[str, dict[str, Any]] = {}
    for i, d in enumerate(daily_dates):
        daily_map[d] = {
            "sunrise": _at(sunrises, i, f"{d}T06:00"),
            "sunset":  _at(sunsets, i, f"{d}T19:00"),
            "maxTempC": float(_at(tmaxs, i, 20)),
            "minTempC": float(_at(tmins, i, 10)),
        }

    out: list[dict[str, Any]] = []
    for date_str in sorted(days_map.keys()):
        out.append({
            "date": date_str,
            "hourly": sorted(days_map[date_str], key=lambda h: h["hour"]),
            "daily": daily_map.get(date_str, {
                "sunrise": f"{date_str}T06:00",
                "sunset":  f"{date_str}T19:00",
                "maxTempC": 20.0,
                "minTempC": 10.0,
            }),
        })
    return out


# --------------------------------------------------------------------------- #
# Estimate transform (climate + historical → blended hourly)                  #
# --------------------------------------------------------------------------- #

def _build_climate_daily_map(climate: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    """date_str -> {temp_mean, temp_max, ..., weather_code} from climate API."""
    out: dict[str, dict[str, Any]] = {}
    if not climate:
        return out
    daily = climate.get("daily") or {}
    dates: list[str] = daily.get("time") or []
    for i, d in enumerate(dates):
        out[d] = {
            "temp_mean":   _at(daily.get("temperature_2m_mean") or [], i, None),
            "temp_max":    _at(daily.get("temperature_2m_max") or [], i, None),
            "temp_min":    _at(daily.get("temperature_2m_min") or [], i, None),
            "precip_sum":  _at(daily.get("precipitation_sum") or [], i, 0),
            "cloud_mean":  _at(daily.get("cloud_cover_mean") or [], i, 30),
            "wind_speed":  _at(daily.get("wind_speed_10m_mean") or [], i, 3),
            "wind_dir":    _at(daily.get("wind_direction_10m_dominant") or [], i, 0),
            "weather_code": _at(daily.get("weather_code") or [], i, 0),
        }
    return out


def _build_historical_maps(
    historical: dict[str, Any] | None,
) -> tuple[dict[tuple[str, int], dict[str, Any]], dict[str, dict[str, Any]]]:
    """Return (hourly_by_(date,hour), daily_by_date) from archive API."""
    hourly_map: dict[tuple[str, int], dict[str, Any]] = {}
    daily_map: dict[str, dict[str, Any]] = {}
    if not historical:
        return hourly_map, daily_map

    h_hourly = historical.get("hourly") or {}
    times: list[str] = h_hourly.get("time") or []
    for i, t in enumerate(times):
        try:
            date_str, hour_str = t.split("T", 1)
            hour = int(hour_str.split(":", 1)[0])
        except (ValueError, IndexError):
            continue
        hourly_map[(date_str, hour)] = {
            "weather_code": _at(h_hourly.get("weather_code") or [], i, 0),
            "precip":       _at(h_hourly.get("precipitation") or [], i, 0),
            "snow":         _at(h_hourly.get("snowfall") or [], i, 0),
            "cloud":        _at(h_hourly.get("cloud_cover") or [], i, 50),
            "cloud_low":    _at(h_hourly.get("cloud_cover_low") or [], i, 30),
            "cloud_mid":    _at(h_hourly.get("cloud_cover_mid") or [], i, 15),
            "cloud_high":   _at(h_hourly.get("cloud_cover_high") or [], i, 5),
            "wind_speed":   _at(h_hourly.get("wind_speed_10m") or [], i, 3),
            "wind_dir":     _at(h_hourly.get("wind_direction_10m") or [], i, 0),
            "visibility":   _at(h_hourly.get("visibility") or [], i, 10000),
            "humidity":     _at(h_hourly.get("relative_humidity_2m") or [], i, 50),
            "apparent":     _at(h_hourly.get("apparent_temperature") or [], i, 18),
        }

    h_daily = historical.get("daily") or {}
    h_dates: list[str] = h_daily.get("time") or []
    for i, d in enumerate(h_dates):
        daily_map[d] = {
            "sunrise": _at(h_daily.get("sunrise") or [], i, f"{d}T06:00"),
            "sunset":  _at(h_daily.get("sunset") or [], i, f"{d}T19:00"),
            "tmax":    _at(h_daily.get("temperature_2m_max") or [], i, 20),
            "tmin":    _at(h_daily.get("temperature_2m_min") or [], i, 10),
        }
    return hourly_map, daily_map


def _blend_estimate(
    climate: dict[str, Any] | None,
    historical: dict[str, Any] | None,
    start: Date,
    end: Date,
) -> list[dict[str, Any]]:
    """Build days[] from blended climate + historical. Either source may be
    None — at least one must be present (caller enforces). Diurnal temp
    curve uses climate's daily mean ± amplitude; weather_code prefers
    historical's hourly value (more specific) and falls back to climate's
    daily code."""
    climate_map = _build_climate_daily_map(climate)
    hist_hourly_map, hist_daily_map = _build_historical_maps(historical)

    days: list[dict[str, Any]] = []
    cur = start
    while cur <= end:
        date_str = cur.isoformat()
        hist_date_str = (cur - timedelta(days=365)).isoformat()

        c = climate_map.get(date_str, {})
        # Default scaffolding when climate is missing — historical drives.
        temp_mean = c.get("temp_mean")
        temp_max = c.get("temp_max")
        temp_min = c.get("temp_min")
        if temp_mean is None:
            # No climate row — derive from historical's daily extremes.
            hd = hist_daily_map.get(hist_date_str, {})
            temp_max = float(hd.get("tmax", 22))
            temp_min = float(hd.get("tmin", 12))
            temp_mean = (temp_max + temp_min) / 2
        else:
            temp_mean = float(temp_mean)
            temp_max = float(temp_max if temp_max is not None else temp_mean + 5)
            temp_min = float(temp_min if temp_min is not None else temp_mean - 5)

        amplitude = (temp_max - temp_min) / 2
        precip_sum = float(c.get("precip_sum") or 0)
        climate_precip_per_hour = precip_sum / 24.0
        cloud_mean = float(c.get("cloud_mean") or 30)
        wind_speed_d = float(c.get("wind_speed") or 3)
        wind_dir_d = float(c.get("wind_dir") or 0)
        leader_code = int(c.get("weather_code") or 0)

        hourly_entries: list[dict[str, Any]] = []
        for hour in range(24):
            hist = hist_hourly_map.get((hist_date_str, hour))

            # Diurnal temperature curve from climate; minimum near 9 → -1 phase
            # so 9:00 is the daily low and ~21:00 the high (close to real life).
            synth_temp = temp_mean + amplitude * math.sin((hour - 9) * math.pi / 12.0)

            if hist is not None:
                hist_apparent = float(hist.get("apparent", synth_temp))
                blended_temp = 0.6 * synth_temp + 0.4 * hist_apparent
                blended_precip = 0.6 * climate_precip_per_hour + 0.4 * float(hist.get("precip", 0))
                blended_cloud = 0.6 * cloud_mean + 0.4 * float(hist.get("cloud", cloud_mean))
                blended_cloud_low = 0.6 * (cloud_mean * 0.6) + 0.4 * float(hist.get("cloud_low", cloud_mean * 0.6))
                blended_cloud_mid = 0.6 * (cloud_mean * 0.3) + 0.4 * float(hist.get("cloud_mid", cloud_mean * 0.3))
                blended_cloud_high = 0.6 * (cloud_mean * 0.1) + 0.4 * float(hist.get("cloud_high", cloud_mean * 0.1))
                blended_wind_speed_kmh = 0.6 * wind_speed_d + 0.4 * float(hist.get("wind_speed", wind_speed_d))
                blended_wind_dir = _shortest_arc(wind_dir_d, float(hist.get("wind_dir", wind_dir_d)), 0.4)
                visibility = float(hist.get("visibility", 10000))
                humidity = float(hist.get("humidity", 50))
                snow = float(hist.get("snow", 0))
                # Historical hourly weather_code is more specific than climate's daily code.
                weather_code = int(hist.get("weather_code", leader_code))
            else:
                blended_temp = synth_temp
                blended_precip = climate_precip_per_hour
                blended_cloud = cloud_mean
                blended_cloud_low = cloud_mean * 0.6
                blended_cloud_mid = cloud_mean * 0.3
                blended_cloud_high = cloud_mean * 0.1
                blended_wind_speed_kmh = wind_speed_d
                blended_wind_dir = wind_dir_d
                visibility = 10000.0
                humidity = 50.0
                snow = 0.0
                weather_code = leader_code

            hourly_entries.append({
                "hour": hour,
                "weatherCode": int(weather_code),
                "precipitationMmHr": float(blended_precip),
                "snowfallCmHr": float(snow),
                "cloudCover": float(blended_cloud),
                "cloudCoverLow": float(blended_cloud_low),
                "cloudCoverMid": float(blended_cloud_mid),
                "cloudCoverHigh": float(blended_cloud_high),
                "windSpeedMps": float(blended_wind_speed_kmh) / 3.6,
                "windAngleDeg": (float(blended_wind_dir) + 180.0) % 360.0,
                "visibilityM": float(visibility),
                "humidity": float(humidity),
                "apparentTempC": float(blended_temp),
                "uvIndex": 3.0,
                "usAqi": None,
                "pm25": None,
                "pm10": None,
            })

        # Sunrise/sunset: take from historical, swap the year to the trip's date
        # so the ISO timestamp's date portion stays consistent with `date`.
        hd = hist_daily_map.get(hist_date_str, {})
        sunrise_iso = str(hd.get("sunrise") or f"{date_str}T06:00")
        sunset_iso = str(hd.get("sunset") or f"{date_str}T19:00")
        sunrise_for_trip = sunrise_iso.replace(hist_date_str, date_str, 1) if hist_date_str in sunrise_iso else f"{date_str}T06:00"
        sunset_for_trip = sunset_iso.replace(hist_date_str, date_str, 1) if hist_date_str in sunset_iso else f"{date_str}T19:00"

        days.append({
            "date": date_str,
            "hourly": hourly_entries,
            "daily": {
                "sunrise": sunrise_for_trip,
                "sunset": sunset_for_trip,
                "maxTempC": float(temp_max),
                "minTempC": float(temp_min),
            },
        })
        cur = cur + timedelta(days=1)
    return days


# --------------------------------------------------------------------------- #
# Upstream wrappers                                                           #
# --------------------------------------------------------------------------- #

class OutOfForecastRange(Exception):
    """Raised when the forecast endpoint signals the trip is beyond horizon."""


def _coerce_response(result: Any, label: str) -> dict[str, Any] | None:
    """For best-effort/optional fetches — log + return None on any failure."""
    if isinstance(result, BaseException):
        logger.warning(f"{label} unavailable ({type(result).__name__}: {result})")
        return None
    if result.status_code >= 400:
        logger.warning(f"{label} upstream {result.status_code}: {result.text[:200]}")
        return None
    try:
        return result.json()
    except ValueError as e:
        logger.warning(f"{label} non-JSON: {e}")
        return None


async def _try_forecast(
    client: httpx.AsyncClient,
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Returns (forecast_data, air_data_or_None). Raises OutOfForecastRange if
    upstream signals the date range is beyond horizon. Raises HTTPException
    for hard upstream failures."""
    forecast_params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "auto",
        "hourly": HOURLY_FORECAST_FIELDS,
        "daily": DAILY_FORECAST_FIELDS,
    }
    air_params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "auto",
        "hourly": HOURLY_AIR_FIELDS,
    }

    forecast_result, air_result = await asyncio.gather(
        client.get(FORECAST_URL, params=forecast_params),
        client.get(AIR_QUALITY_URL, params=air_params),
        return_exceptions=True,
    )

    # Forecast leg — critical, but a horizon 400 is special.
    if isinstance(forecast_result, httpx.TimeoutException):
        logger.error(f"forecast timeout: {forecast_result}")
        raise HTTPException(status_code=503, detail="Weather upstream timeout")
    if isinstance(forecast_result, httpx.HTTPError):
        logger.error(f"forecast network error: {type(forecast_result).__name__}: {forecast_result}")
        raise HTTPException(status_code=503, detail="Weather upstream unreachable")
    if isinstance(forecast_result, BaseException):
        logger.error(f"forecast unexpected: {type(forecast_result).__name__}: {forecast_result}")
        raise HTTPException(status_code=503, detail="Weather upstream unreachable")

    if forecast_result.status_code == 400:
        body = forecast_result.text or ""
        if OUT_OF_RANGE_RE.search(body):
            logger.info(f"forecast out-of-range signal: {body[:200]}")
            raise OutOfForecastRange()
        logger.error(f"forecast 400: {body[:200]}")
        raise HTTPException(status_code=502, detail=f"Forecast upstream 400")

    if forecast_result.status_code >= 400:
        logger.error(f"forecast upstream {forecast_result.status_code}: {forecast_result.text[:200]}")
        raise HTTPException(status_code=502, detail=f"Forecast upstream {forecast_result.status_code}")

    try:
        forecast_data = forecast_result.json()
    except ValueError as e:
        logger.error(f"forecast non-JSON: {e}")
        raise HTTPException(status_code=502, detail="Weather upstream malformed")

    # Air-quality leg — best-effort.
    air_data = _coerce_response(air_result, "air-quality")
    return forecast_data, air_data


async def _try_climate(
    client: httpx.AsyncClient,
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """Try climate models in priority order. Returns (data, model_name) on
    first success, (None, None) if all fail."""
    for model in CLIMATE_MODELS:
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date,
            "end_date": end_date,
            "models": model,
            "daily": DAILY_CLIMATE_FIELDS,
        }
        try:
            resp = await client.get(CLIMATE_URL, params=params)
        except (httpx.TimeoutException, httpx.HTTPError) as e:
            logger.warning(f"climate({model}) network: {type(e).__name__}: {e}")
            continue
        if resp.status_code >= 400:
            logger.warning(f"climate({model}) upstream {resp.status_code}: {resp.text[:200]}")
            continue
        try:
            return resp.json(), model
        except ValueError as e:
            logger.warning(f"climate({model}) non-JSON: {e}")
            continue
    return None, None


async def _try_estimate(
    client: httpx.AsyncClient,
    lat: float,
    lon: float,
    start: Date,
    end: Date,
) -> tuple[list[dict[str, Any]] | None, str | None]:
    """Returns (days, climate_model_used) on success. (None, None) on full
    failure (both climate and historical unavailable)."""
    start_str = start.isoformat()
    end_str = end.isoformat()
    hist_start = (start - timedelta(days=365)).isoformat()
    hist_end = (end - timedelta(days=365)).isoformat()

    climate_task = _try_climate(client, lat, lon, start_str, end_str)
    hist_params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": hist_start,
        "end_date": hist_end,
        "timezone": "auto",
        "hourly": HOURLY_FORECAST_FIELDS,
        "daily": DAILY_FORECAST_FIELDS,
    }
    historical_task = client.get(HISTORICAL_URL, params=hist_params)

    (climate_outcome, historical_result) = await asyncio.gather(
        climate_task,
        historical_task,
        return_exceptions=True,
    )

    if isinstance(climate_outcome, BaseException):
        logger.warning(f"climate unexpected: {type(climate_outcome).__name__}: {climate_outcome}")
        climate_data, climate_model = None, None
    else:
        climate_data, climate_model = climate_outcome

    historical_data = _coerce_response(historical_result, "historical-archive")

    if climate_data is None and historical_data is None:
        return None, None

    try:
        days = _blend_estimate(climate_data, historical_data, start, end)
    except Exception as e:  # noqa: BLE001
        logger.error(f"estimate blend failed: {type(e).__name__}: {e}")
        return None, climate_model
    return days, climate_model


# --------------------------------------------------------------------------- #
# Validation                                                                  #
# --------------------------------------------------------------------------- #

MAX_TRIP_DAYS = 90  # estimate path supports longer ranges than forecast

def _validate(lat: float, lon: float, start_date: str, end_date: str) -> tuple[Date, Date]:
    if not (-90.0 <= lat <= 90.0):
        raise HTTPException(status_code=400, detail="lat out of range [-90, 90]")
    if not (-180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail="lon out of range [-180, 180]")
    try:
        s = Date.fromisoformat(start_date)
        e = Date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="start_date/end_date must be YYYY-MM-DD")
    if e < s:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")
    if (e - s).days > MAX_TRIP_DAYS:
        raise HTTPException(status_code=400, detail=f"date range exceeds {MAX_TRIP_DAYS}-day cap")
    return s, e


# --------------------------------------------------------------------------- #
# Endpoint                                                                    #
# --------------------------------------------------------------------------- #

@router.get("")
@limiter.limit("60/minute")
async def get_weather(
    request: Request,
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
):
    s, e = _validate(lat, lon, start_date, end_date)

    lat_r = round(lat, 2)
    lon_r = round(lon, 2)
    base_key = f"weather:{lat_r:.2f}:{lon_r:.2f}:{start_date}:{end_date}"
    forecast_key = base_key
    estimate_key = f"{base_key}:estimate"

    now = time.time()

    # Cache lookups: forecast TTL is shorter, so check it first.
    cached_forecast = _cache.get(forecast_key)
    if cached_forecast is not None and (now - cached_forecast["fetched_at"]) < FORECAST_CACHE_TTL_SEC:
        age_min = (now - cached_forecast["fetched_at"]) / 60.0
        logger.info(f"cache HIT key={forecast_key} source=forecast age={age_min:.1f}m")
        return cached_forecast["data"]

    cached_estimate = _cache.get(estimate_key)
    if cached_estimate is not None and (now - cached_estimate["fetched_at"]) < ESTIMATE_CACHE_TTL_SEC:
        age_min = (now - cached_estimate["fetched_at"]) / 60.0
        logger.info(f"cache HIT key={estimate_key} source=estimate age={age_min:.1f}m")
        return cached_estimate["data"]

    logger.info(f"cache MISS key={base_key} → upstream")

    try:
        async with httpx.AsyncClient(timeout=ESTIMATE_TIMEOUT_SEC) as client:
            try:
                forecast_data, air_data = await _try_forecast(
                    client, lat_r, lon_r, start_date, end_date,
                )
            except OutOfForecastRange:
                # Trip beyond forecast horizon — entire range routes to estimate.
                logger.info(f"routing → estimate path (start={start_date} end={end_date})")
                days, model_used = await _try_estimate(client, lat_r, lon_r, s, e)
                if days is None:
                    logger.warning(
                        f"both climate and historical unavailable; "
                        f"returning unavailable for {base_key}"
                    )
                    # Failures are not cached.
                    return {
                        "days": [],
                        "fetchedAt": int(time.time()),
                        "source": "unavailable",
                        "outOfRange": True,
                    }
                logger.info(
                    f"estimate built source=estimate model={model_used or 'historical-only'} "
                    f"days={len(days)}"
                )
                response = {
                    "days": days,
                    "fetchedAt": int(time.time()),
                    "source": "estimate",
                }
                _cache[estimate_key] = {"data": response, "fetched_at": time.time()}
                return response

            # Forecast path succeeded.
            try:
                days = _transform_forecast(forecast_data, air_data)
            except Exception as e:  # noqa: BLE001
                logger.error(f"forecast transform failed: {type(e).__name__}: {e}")
                raise HTTPException(status_code=502, detail=f"Weather parse error: {type(e).__name__}")

            response = {
                "days": days,
                "fetchedAt": int(time.time()),
                "source": "forecast",
            }
            _cache[forecast_key] = {"data": response, "fetched_at": time.time()}
            logger.info(f"cached source=forecast key={forecast_key} days={len(days)}")
            return response
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — outermost client setup failure
        logger.error(f"httpx client failure: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=503, detail="Weather upstream unreachable")

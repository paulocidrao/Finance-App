import axios from 'axios'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const BELO_HORIZONTE_COORDINATES = {
  latitude: -19.9167,
  longitude: -43.9345,
} as const
const GEOLOCATION_TIMEOUT_MS = 10_000
const WEATHER_CACHE_KEY = 'finance-current-weather'
const WEATHER_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000

interface Coordinates {
  latitude: number
  longitude: number
}

interface CurrentWeatherResponse {
  current?: {
    temperature_2m?: number
  }
}

export interface CurrentTemperature {
  temperature: number
  updatedAt: number
  fromCache: boolean
}

interface CachedTemperature {
  temperature: number
  updatedAt: number
  latitude: number
  longitude: number
}

export const CURRENT_WEATHER_QUERY_KEY = ['weather', 'current', 'belo-horizonte'] as const

function getUserCoordinates(): Promise<Coordinates> {
  if (!navigator.geolocation) {
    return Promise.resolve(BELO_HORIZONTE_COORDINATES)
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
      },
      () => {
        resolve(BELO_HORIZONTE_COORDINATES)
      },
      {
        enableHighAccuracy: false,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 15 * 60 * 1000,
      },
    )
  })
}

function readCachedTemperature(coordinates: Coordinates): CurrentTemperature | null {
  try {
    const rawCache = localStorage.getItem(WEATHER_CACHE_KEY)
    if (!rawCache) {
      return null
    }

    const cache = JSON.parse(rawCache) as Partial<CachedTemperature>
    if (
      typeof cache.temperature !== 'number' ||
      !Number.isFinite(cache.temperature) ||
      typeof cache.updatedAt !== 'number' ||
      !Number.isFinite(cache.updatedAt) ||
      typeof cache.latitude !== 'number' ||
      typeof cache.longitude !== 'number' ||
      Date.now() - cache.updatedAt > WEATHER_CACHE_MAX_AGE_MS ||
      Math.abs(cache.latitude - coordinates.latitude) > 0.1 ||
      Math.abs(cache.longitude - coordinates.longitude) > 0.1
    ) {
      return null
    }

    return {
      temperature: cache.temperature,
      updatedAt: cache.updatedAt,
      fromCache: true,
    }
  } catch {
    return null
  }
}

function writeCachedTemperature(temperature: number, coordinates: Coordinates): number {
  const updatedAt = Date.now()

  try {
    localStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({
        temperature,
        updatedAt,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      } satisfies CachedTemperature),
    )
  } catch {
    // The API response remains usable when browser storage is unavailable.
  }

  return updatedAt
}

export async function getCurrentTemperature(): Promise<CurrentTemperature> {
  const coordinates = await getUserCoordinates()
  try {
    const response = await axios.get<CurrentWeatherResponse>(OPEN_METEO_URL, {
      params: {
        ...coordinates,
        current: 'temperature_2m',
      },
    })
    const temperature = response.data.current?.temperature_2m

    if (typeof temperature !== 'number' || !Number.isFinite(temperature)) {
      throw new Error('A resposta da Open-Meteo não contém uma temperatura válida.')
    }

    return {
      temperature,
      updatedAt: writeCachedTemperature(temperature, coordinates),
      fromCache: false,
    }
  } catch (error) {
    const cachedTemperature = readCachedTemperature(coordinates)
    if (cachedTemperature) {
      return cachedTemperature
    }

    throw error
  }
}

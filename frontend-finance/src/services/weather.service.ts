import axios from 'axios'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const BELO_HORIZONTE_COORDINATES = {
  latitude: -19.9167,
  longitude: -43.9345,
} as const
const GEOLOCATION_TIMEOUT_MS = 10_000

interface Coordinates {
  latitude: number
  longitude: number
}

interface CurrentWeatherResponse {
  current?: {
    temperature_2m?: number
  }
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

export async function getCurrentTemperature(): Promise<number> {
  const coordinates = await getUserCoordinates()
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

  return temperature
}

'use client'
import { useCallback, useEffect, useState } from 'react'

export type Coords = { lat: number; lng: number; accuracy_m: number }

export type GeolocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'

export interface UseGeolocationReturn {
  coords: Coords | null
  status: GeolocationStatus
  error: string | null
  request: () => void
}

const STORAGE_KEY = 'joola.userLocation.v1'

function readCached(): Coords | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Coords
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') return parsed
    return null
  } catch {
    return null
  }
}

function writeCached(coords: Coords): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords))
  } catch {
    // sessionStorage unavailable — silently skip
  }
}

export function useGeolocation(options: { autoRequest?: boolean } = {}): UseGeolocationReturn {
  const { autoRequest = true } = options
  const [coords, setCoords] = useState<Coords | null>(() => readCached())
  const [status, setStatus] = useState<GeolocationStatus>(() => (readCached() ? 'granted' : 'idle'))
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unavailable')
      setError('Geolocation is not supported by this browser')
      return
    }

    setStatus('requesting')
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: Coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
        }
        setCoords(next)
        setStatus('granted')
        writeCached(next)
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setStatus('denied')
          setError('Location permission denied')
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setStatus('unavailable')
          setError('Location unavailable')
        } else {
          setStatus('error')
          setError(geoError.message)
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    )
  }, [])

  useEffect(() => {
    if (autoRequest && status === 'idle') request()
  }, [autoRequest, status, request])

  return { coords, status, error, request }
}

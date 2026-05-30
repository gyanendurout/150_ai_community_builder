// Geographic utilities for distance calculation, court filtering, and reverse geocoding.
// All functions are pure and testable in isolation. The reverse-geocode call is the
// only side-effectful function; it can be mocked via the fetcher argument.

export type LatLng = { lat: number; lng: number }

export type CourtForFilter = {
  // null means "external court — not in our DB". The AI is instructed to put
  // these into location_name + address rather than referencing court_id.
  id: string | null
  name: string
  address: string | null
  indoor_outdoor: 'indoor' | 'outdoor' | 'both' | null
  latitude: number | null
  longitude: number | null
}

export type RankedCourt = CourtForFilter & { distance_km: number | null }

export type ReverseGeocodeResult = {
  city: string | null
  region: string | null
  country: string | null
  country_code: string | null
}

export const DEFAULT_MAX_COURT_KM = 100

// Haversine great-circle distance in kilometers.
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Compute distance + filter (when user location is known) + sort ascending.
// If user has no location, return courts as-is with null distances, alphabetical.
// If user has location, drop courts beyond maxKm — we will not suggest a court
// that is 10,000 km away.
export function filterAndSortCourts(
  courts: CourtForFilter[],
  userLocation: LatLng | null,
  maxKm: number = DEFAULT_MAX_COURT_KM
): RankedCourt[] {
  const enriched: RankedCourt[] = courts.map(c => ({
    ...c,
    distance_km:
      userLocation && c.latitude != null && c.longitude != null
        ? Math.round(distanceKm(userLocation, { lat: c.latitude, lng: c.longitude }) * 10) / 10
        : null,
  }))

  const filtered = userLocation
    ? enriched.filter(c => c.distance_km != null && c.distance_km <= maxKm)
    : enriched

  return filtered.sort((a, b) => {
    if (a.distance_km == null && b.distance_km == null) return a.name.localeCompare(b.name)
    if (a.distance_km == null) return 1
    if (b.distance_km == null) return -1
    return a.distance_km - b.distance_km
  })
}

// Cache key rounds to 0.05° (≈ 5 km) so nearby requests reuse the same lookup.
function geoCacheKey(lat: number, lng: number): string {
  const r = (n: number) => Math.round(n * 20) / 20
  return `${r(lat)},${r(lng)}`
}

const reverseGeocodeCache = new Map<string, ReverseGeocodeResult>()

// Pluggable fetcher so tests can mock the Nominatim call without hitting the network.
export type ReverseGeocodeFetcher = (lat: number, lng: number) => Promise<unknown>

const defaultFetcher: ReverseGeocodeFetcher = async (lat, lng) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Joola-Community-POC/1.0' },
  })
  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`)
  return res.json()
}

// Reverse-geocode lat/lng → city/region/country. Returns nulls on failure rather
// than throwing — geocoding is best-effort, the chat must still work without it.
export async function reverseGeocode(
  lat: number,
  lng: number,
  fetcher: ReverseGeocodeFetcher = defaultFetcher
): Promise<ReverseGeocodeResult> {
  const key = geoCacheKey(lat, lng)
  const cached = reverseGeocodeCache.get(key)
  if (cached) return cached

  const empty: ReverseGeocodeResult = { city: null, region: null, country: null, country_code: null }

  try {
    const raw = await fetcher(lat, lng)
    if (!raw || typeof raw !== 'object') return empty
    const data = raw as { address?: Record<string, string | undefined> }
    const addr = data.address ?? {}
    const result: ReverseGeocodeResult = {
      city: addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.suburb ?? null,
      region: addr.state ?? addr.county ?? null,
      country: addr.country ?? null,
      country_code: addr.country_code ? addr.country_code.toUpperCase() : null,
    }
    reverseGeocodeCache.set(key, result)
    return result
  } catch {
    return empty
  }
}

// Visible for tests — lets tests reset the cache between runs.
export function _resetReverseGeocodeCache(): void {
  reverseGeocodeCache.clear()
}

// ────────────────────────────────────────────────────────────────────────────
// OpenStreetMap Overpass — real-time court lookup
// ────────────────────────────────────────────────────────────────────────────

export type OsmFetcher = (overpassQuery: string) => Promise<unknown>

type OverpassElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string | undefined>
}

type OverpassResponse = { elements?: OverpassElement[] }

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const OSM_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const osmCourtsCache = new Map<string, { courts: CourtForFilter[]; expiresAt: number }>()

const defaultOsmFetcher: OsmFetcher = async (query) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3500) // hard cap so chat stays snappy
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Joola-Community-POC/1.0' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Overpass returned ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

function pickElementCoords(el: OverpassElement): { lat: number; lng: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lng: el.lon }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon }
  return null
}

function osmTagsToAddress(tags: Record<string, string | undefined>): string | null {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] ?? tags['addr:neighbourhood'],
    tags['addr:city'],
    tags['addr:state'],
  ].filter((p): p is string => !!p)
  return parts.length > 0 ? parts.join(', ') : null
}

function osmTagsToIndoorOutdoor(tags: Record<string, string | undefined>): 'indoor' | 'outdoor' | 'both' | null {
  const v = tags.indoor ?? tags['leisure:indoor']
  if (v === 'yes') return 'indoor'
  if (v === 'no') return 'outdoor'
  return null // unknown — better to say nothing than guess
}

// Query OSM for pickleball courts within radius_m of (lat, lng).
// Returns [] on any failure — court lookup must NEVER break the chat.
// Courts have `id=null` to signal "external — not in our DB" — the AI is
// instructed to put these into location_name + address, not court_id.
export async function findOsmCourts(
  lat: number,
  lng: number,
  radius_m: number = 50000,
  fetcher: OsmFetcher = defaultOsmFetcher
): Promise<CourtForFilter[]> {
  const cacheKey = `${geoCacheKey(lat, lng)}@${radius_m}`
  const cached = osmCourtsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.courts

  // ONLY pickleball — never widen to tennis/other sports (would be misleading).
  const query = `[out:json][timeout:3];
(
  nwr["sport"~"pickleball",i](around:${radius_m},${lat},${lng});
);
out tags center;`

  try {
    const raw = await fetcher(query)
    if (!raw || typeof raw !== 'object') return []
    const data = raw as OverpassResponse
    const elements = data.elements ?? []

    const seen = new Set<string>()
    const courts: CourtForFilter[] = []

    for (const el of elements) {
      const coords = pickElementCoords(el)
      const tags = el.tags ?? {}
      const name = tags.name ?? tags['name:en']
      if (!coords || !name) continue
      const dedupeKey = `${name.toLowerCase()}|${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      courts.push({
        id: null, // external, not in our DB
        name,
        address: osmTagsToAddress(tags),
        indoor_outdoor: osmTagsToIndoorOutdoor(tags),
        latitude: coords.lat,
        longitude: coords.lng,
      })
    }

    osmCourtsCache.set(cacheKey, { courts, expiresAt: Date.now() + OSM_CACHE_TTL_MS })
    return courts
  } catch {
    return []
  }
}

export function _resetOsmCourtsCache(): void {
  osmCourtsCache.clear()
}

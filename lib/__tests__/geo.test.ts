import { describe, test, expect, beforeEach } from 'bun:test'
import {
  distanceKm,
  filterAndSortCourts,
  reverseGeocode,
  findOsmCourts,
  _resetReverseGeocodeCache,
  _resetOsmCourtsCache,
  type CourtForFilter,
} from '../geo'

// --- Real cities (lat/lng from Wikipedia, rounded to 4dp) ---
const SF = { lat: 37.7749, lng: -122.4194 }
const NYC = { lat: 40.7128, lng: -74.006 }
const LONDON = { lat: 51.5074, lng: -0.1278 }
const BENGALURU = { lat: 12.9716, lng: 77.5946 }
const MUMBAI = { lat: 19.076, lng: 72.8777 }
const SYDNEY = { lat: -33.8688, lng: 151.2093 }
const TOKYO = { lat: 35.6762, lng: 139.6503 }

// --- Real seeded courts (from supabase/seed.sql) ---
const SEED_COURTS: CourtForFilter[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    name: 'Joola Court A',
    address: '123 Pickleball Ave, San Francisco, CA',
    indoor_outdoor: 'indoor',
    latitude: 37.7749,
    longitude: -122.4194,
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    name: 'Sunset Recreation Center',
    address: '456 Sunset Blvd, San Francisco, CA',
    indoor_outdoor: 'outdoor',
    latitude: 37.7539,
    longitude: -122.4864,
  },
  {
    id: '00000000-0000-0000-0000-000000000105',
    name: 'Golden Gate PB Center',
    address: '100 Park Drive, San Francisco, CA',
    indoor_outdoor: 'outdoor',
    latitude: 37.7694,
    longitude: -122.4862,
  },
]

describe('distanceKm — real city pairs', () => {
  test('SF → NYC ≈ 4128 km', () => {
    expect(Math.round(distanceKm(SF, NYC))).toBeWithin(4100, 4160)
  })

  test('SF → Bengaluru ≈ 13900 km (huge — should never suggest each other)', () => {
    expect(Math.round(distanceKm(SF, BENGALURU))).toBeGreaterThan(13000)
  })

  test('SF → Mumbai ≈ 13700 km', () => {
    expect(Math.round(distanceKm(SF, MUMBAI))).toBeGreaterThan(13000)
  })

  test('Bengaluru → Mumbai ≈ 837 km', () => {
    expect(Math.round(distanceKm(BENGALURU, MUMBAI))).toBeWithin(820, 870)
  })

  test('identical points = 0 km', () => {
    expect(distanceKm(SF, SF)).toBe(0)
  })

  test('SF → London ≈ 8616 km', () => {
    expect(Math.round(distanceKm(SF, LONDON))).toBeWithin(8500, 8700)
  })
})

describe('filterAndSortCourts — 10 real-user scenarios', () => {
  // Scenario 1: User in Bengaluru, India — SF courts MUST be filtered out
  test('[1] Bengaluru user → 0 nearby courts (SF is 13000+ km away)', () => {
    const result = filterAndSortCourts(SEED_COURTS, BENGALURU)
    expect(result).toHaveLength(0)
  })

  // Scenario 2: User in Mumbai, India — same expected behavior
  test('[2] Mumbai user → 0 nearby courts', () => {
    const result = filterAndSortCourts(SEED_COURTS, MUMBAI)
    expect(result).toHaveLength(0)
  })

  // Scenario 3: User in San Francisco — all 3 courts appear, sorted by distance
  test('[3] SF user → all 3 SF courts shown, sorted ascending by distance', () => {
    const result = filterAndSortCourts(SEED_COURTS, SF)
    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('Joola Court A') // closest (same point)
    expect(result[0].distance_km).toBe(0)
    // distances must be monotonically non-decreasing
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distance_km!).toBeGreaterThanOrEqual(result[i - 1].distance_km!)
    }
  })

  // Scenario 4: User in NYC — SF courts >4000km, filtered out
  test('[4] NYC user → 0 nearby courts (SF is 4000+ km away)', () => {
    const result = filterAndSortCourts(SEED_COURTS, NYC)
    expect(result).toHaveLength(0)
  })

  // Scenario 5: User in London — SF courts >8000km, filtered out
  test('[5] London user → 0 nearby courts', () => {
    const result = filterAndSortCourts(SEED_COURTS, LONDON)
    expect(result).toHaveLength(0)
  })

  // Scenario 6: User in Sydney (southern hemisphere) — antipode-ish to SF
  test('[6] Sydney user → 0 nearby courts', () => {
    const result = filterAndSortCourts(SEED_COURTS, SYDNEY)
    expect(result).toHaveLength(0)
  })

  // Scenario 7: User in Tokyo — SF still 8000+ km
  test('[7] Tokyo user → 0 nearby courts', () => {
    const result = filterAndSortCourts(SEED_COURTS, TOKYO)
    expect(result).toHaveLength(0)
  })

  // Scenario 8: No user location shared — courts shown alphabetically with null distance
  test('[8] No location → all 3 courts shown alphabetically with null distance', () => {
    const result = filterAndSortCourts(SEED_COURTS, null)
    expect(result).toHaveLength(3)
    expect(result.every(c => c.distance_km === null)).toBe(true)
    expect(result[0].name).toBe('Golden Gate PB Center') // G < J < S
    expect(result[1].name).toBe('Joola Court A')
    expect(result[2].name).toBe('Sunset Recreation Center')
  })

  // Scenario 9: User ~95 km away — INSIDE 100 km threshold, courts INCLUDED
  test('[9] User ~95 km from SF courts → courts INCLUDED (under 100 km threshold)', () => {
    // 0.85° latitude ≈ 94.6 km — comfortably under 100 km
    const userInside = { lat: SF.lat + 0.85, lng: SF.lng }
    const result = filterAndSortCourts(SEED_COURTS, userInside)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].distance_km!).toBeLessThanOrEqual(100)
    expect(result[0].distance_km!).toBeGreaterThan(90)
  })

  // Scenario 10: User >100km away from all courts → all filtered
  test('[10] Court 200 km away → FILTERED OUT (over 100 km threshold)', () => {
    // 2° lat ≈ 222 km away from SF — beyond default threshold
    const farUser = { lat: SF.lat + 2.0, lng: SF.lng }
    const result = filterAndSortCourts(SEED_COURTS, farUser)
    expect(result).toHaveLength(0)
  })

  // Bonus: custom max-distance threshold
  test('[bonus] custom maxKm=500 lets a 200km-away user see SF courts', () => {
    const user = { lat: SF.lat + 2.0, lng: SF.lng }
    const result = filterAndSortCourts(SEED_COURTS, user, 500)
    expect(result.length).toBe(3)
  })
})

describe('reverseGeocode — uses Nominatim, returns city/region/country', () => {
  beforeEach(() => _resetReverseGeocodeCache())

  test('parses a Bengaluru-shaped Nominatim response', async () => {
    const mockFetch = async () => ({
      address: {
        suburb: 'Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        country_code: 'in',
      },
    })
    const result = await reverseGeocode(BENGALURU.lat, BENGALURU.lng, mockFetch)
    expect(result.city).toBe('Bengaluru')
    expect(result.region).toBe('Karnataka')
    expect(result.country).toBe('India')
    expect(result.country_code).toBe('IN')
  })

  test('falls back through city → town → village', async () => {
    const mockFetch = async () => ({
      address: { village: 'Tinytown', country: 'Nowhereistan', country_code: 'xx' },
    })
    const result = await reverseGeocode(0, 0, mockFetch)
    expect(result.city).toBe('Tinytown')
    expect(result.country).toBe('Nowhereistan')
    expect(result.country_code).toBe('XX')
  })

  test('returns all-null on fetcher error (geocoding is best-effort)', async () => {
    const mockFetch = async () => {
      throw new Error('network down')
    }
    const result = await reverseGeocode(SF.lat, SF.lng, mockFetch)
    expect(result).toEqual({ city: null, region: null, country: null, country_code: null })
  })

  test('returns all-null on malformed response', async () => {
    const mockFetch = async () => 'not an object'
    const result = await reverseGeocode(SF.lat, SF.lng, mockFetch)
    expect(result).toEqual({ city: null, region: null, country: null, country_code: null })
  })

  test('caches by rounded coordinates — second call does not re-fetch', async () => {
    let calls = 0
    const mockFetch = async () => {
      calls++
      return { address: { city: 'Bengaluru', country: 'India', country_code: 'in' } }
    }
    await reverseGeocode(BENGALURU.lat, BENGALURU.lng, mockFetch)
    await reverseGeocode(BENGALURU.lat + 0.001, BENGALURU.lng + 0.001, mockFetch) // same cache bucket
    expect(calls).toBe(1)
  })
})

describe('findOsmCourts — Overpass-driven real-time lookup', () => {
  beforeEach(() => _resetOsmCourtsCache())

  test('parses an Overpass response into CourtForFilter entries with id=null', async () => {
    const mockFetch = async () => ({
      elements: [
        {
          type: 'node',
          id: 12345,
          lat: 12.9716,
          lon: 77.5946,
          tags: {
            name: 'Bengaluru Pickle Club',
            sport: 'pickleball',
            'addr:street': 'MG Road',
            'addr:city': 'Bengaluru',
            indoor: 'yes',
          },
        },
      ],
    })
    const courts = await findOsmCourts(BENGALURU.lat, BENGALURU.lng, 50000, mockFetch)
    expect(courts).toHaveLength(1)
    expect(courts[0].id).toBeNull() // external — not in our DB
    expect(courts[0].name).toBe('Bengaluru Pickle Club')
    expect(courts[0].address).toContain('MG Road')
    expect(courts[0].indoor_outdoor).toBe('indoor')
    expect(courts[0].latitude).toBe(12.9716)
  })

  test('skips elements without a name (cannot show unnamed courts to users)', async () => {
    const mockFetch = async () => ({
      elements: [
        { type: 'node', id: 1, lat: 0, lon: 0, tags: { sport: 'pickleball' } }, // no name
        { type: 'node', id: 2, lat: 1, lon: 1, tags: { sport: 'pickleball', name: 'Real Court' } },
      ],
    })
    const courts = await findOsmCourts(0, 0, 1000, mockFetch)
    expect(courts).toHaveLength(1)
    expect(courts[0].name).toBe('Real Court')
  })

  test('uses center coords for ways/relations (no top-level lat/lon)', async () => {
    const mockFetch = async () => ({
      elements: [
        {
          type: 'way',
          id: 99,
          center: { lat: 12.97, lon: 77.59 },
          tags: { name: 'Sports Center', sport: 'pickleball' },
        },
      ],
    })
    const courts = await findOsmCourts(12.97, 77.59, 1000, mockFetch)
    expect(courts).toHaveLength(1)
    expect(courts[0].latitude).toBe(12.97)
    expect(courts[0].longitude).toBe(77.59)
  })

  test('returns indoor_outdoor=null when OSM does not specify (no guessing)', async () => {
    const mockFetch = async () => ({
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 12.97,
          lon: 77.59,
          tags: { name: 'Unknown Facility Court', sport: 'pickleball' },
        },
      ],
    })
    const courts = await findOsmCourts(12.97, 77.59, 1000, mockFetch)
    expect(courts[0].indoor_outdoor).toBeNull()
  })

  test('deduplicates entries with same name + coords', async () => {
    const mockFetch = async () => ({
      elements: [
        { type: 'node', id: 1, lat: 12.97, lon: 77.59, tags: { name: 'Dup Court', sport: 'pickleball' } },
        { type: 'node', id: 2, lat: 12.97, lon: 77.59, tags: { name: 'Dup Court', sport: 'pickleball' } },
      ],
    })
    const courts = await findOsmCourts(12.97, 77.59, 1000, mockFetch)
    expect(courts).toHaveLength(1)
  })

  test('returns [] (NOT throwing) on Overpass network error', async () => {
    const mockFetch = async () => {
      throw new Error('Overpass timeout')
    }
    const courts = await findOsmCourts(12.97, 77.59, 1000, mockFetch)
    expect(courts).toEqual([])
  })

  test('returns [] on malformed Overpass response (no elements array)', async () => {
    const mockFetch = async () => ({ remark: 'rate limited' })
    const courts = await findOsmCourts(12.97, 77.59, 1000, mockFetch)
    expect(courts).toEqual([])
  })

  test('caches results — second call with same coords does not re-fetch', async () => {
    let calls = 0
    const mockFetch = async () => {
      calls++
      return { elements: [{ type: 'node', id: 1, lat: 12.97, lon: 77.59, tags: { name: 'X', sport: 'pickleball' } }] }
    }
    await findOsmCourts(12.97, 77.59, 50000, mockFetch)
    await findOsmCourts(12.97, 77.59, 50000, mockFetch)
    expect(calls).toBe(1)
  })
})

// Custom matcher helper since bun:test does not ship toBeWithin
declare module 'bun:test' {
  interface Matchers<T> {
    toBeWithin(min: number, max: number): T
  }
}
import { expect as bunExpect } from 'bun:test'
bunExpect.extend({
  toBeWithin(received: number, min: number, max: number) {
    const pass = received >= min && received <= max
    return {
      pass,
      message: () => `expected ${received} to be within [${min}, ${max}]`,
    }
  },
})

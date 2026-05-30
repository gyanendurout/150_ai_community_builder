import { describe, test, expect } from 'bun:test'
import { WeatherService } from '../weather.service'

describe('WeatherService', () => {
  test('getForecast always returns ok', async () => {
    const service = new WeatherService()
    const result = await service.getForecast('2026-06-07')
    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
  })

  test('getForecast returns sunny forecast with outdoor suitability', async () => {
    const service = new WeatherService()
    const result = await service.getForecast('2026-06-07')
    expect(result.data?.condition).toBe('Sunny')
    expect(result.data?.suitable_for_outdoor).toBe(true)
    expect(typeof result.data?.temp_c).toBe('number')
  })

  test('getForecast passes through the date in the response', async () => {
    const service = new WeatherService()
    const result = await service.getForecast('2026-06-14')
    expect(result.data?.date).toBe('2026-06-14')
  })
})

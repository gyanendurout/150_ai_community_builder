import { logger } from '@/lib/logger'
import { ok, type Result } from '@/lib/errors'

export type WeatherForecast = {
  date: string
  condition: string
  temp_c: number
  suitable_for_outdoor: boolean
  description: string
}

export class WeatherService {
  async getForecast(date: string, _location?: string): Promise<Result<WeatherForecast>> {
    logger.debug('WeatherService.getForecast (stub)', { date })
    return ok({
      date,
      condition: 'Sunny',
      temp_c: 22,
      suitable_for_outdoor: true,
      description: 'Great day for pickleball!',
    })
  }
}

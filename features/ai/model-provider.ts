import { openai } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'

export const AI_MODEL = 'gpt-4o' as const

export type ModelConfig = {
  model: string
  temperature: number
  maxTokens: number
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  model: AI_MODEL,
  temperature: 0.3,
  maxTokens: 2000,
}

export function createLanguageModel(modelId: string = AI_MODEL): Result<LanguageModel> {
  if (!process.env.OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY not set')
    return err('OpenAI API key not configured', 'MISSING_API_KEY', 500)
  }
  try {
    const model = openai(modelId as Parameters<typeof openai>[0])
    logger.debug('Language model created', { model: modelId })
    return ok(model as LanguageModel)
  } catch (e) {
    logger.error('Model creation failed', { error: String(e) })
    return err('Failed to create language model', 'MODEL_INIT_FAILED', 500)
  }
}

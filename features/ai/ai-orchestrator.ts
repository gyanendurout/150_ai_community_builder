import { generateObject } from 'ai'
import type { ModelMessage } from 'ai'
import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import { createLanguageModel } from './model-provider'
import { buildSystemPrompt, type PromptContext } from './prompt-builder'
import { AIResponseSchema, type AIResponse } from './structured-output-schema'

export type MessageInput = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type OrchestratorInput = {
  userMessage: string
  conversationHistory: MessageInput[]
  context: PromptContext
}

export type OrchestratorOutput = AIResponse & {
  usage: { inputTokens: number; outputTokens: number }
}

// Hard ceiling on a single OpenAI structured-output call. Must stay below the
// client's 30s fetch timeout (hooks/useAIChat.ts) so the user always sees a
// proper error message instead of a generic "timed out" from the browser.
const ORCHESTRATOR_TIMEOUT_MS = 25_000

export async function runOrchestrator(
  input: OrchestratorInput
): Promise<Result<OrchestratorOutput>> {
  logger.info('Orchestrator starting', {
    messageLength: input.userMessage.length,
    historyLength: input.conversationHistory.length,
    conversationType: input.context.conversationType,
  })

  const modelResult = createLanguageModel()
  if (modelResult.error) return modelResult

  const systemPrompt = buildSystemPrompt(input.context)

  const messages = [
    ...input.conversationHistory
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: input.userMessage },
  ]

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS)

  try {
    const result = await generateObject({
      model: modelResult.data,
      schema: AIResponseSchema,
      schemaName: 'AIResponse',
      schemaDescription: 'Structured response from the Joola AI community assistant',
      system: systemPrompt,
      messages: messages as unknown as ModelMessage[],
      abortSignal: controller.signal,
    })

    logger.info('Orchestrator completed', {
      intent: result.object.intent,
      requiresApproval: result.object.requires_approval,
      hasDraftUpdate: !!result.object.draft_update,
      toolCalls: result.object.tool_calls ?? [],
    })

    return ok({
      ...result.object,
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
      },
    })
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === 'AbortError') ||
      (e instanceof Error && /abort/i.test(e.message))
    if (aborted) {
      logger.error('Orchestrator timed out', { timeoutMs: ORCHESTRATOR_TIMEOUT_MS })
      return err('AI took too long to respond — please try again', 'ORCHESTRATOR_TIMEOUT', 504)
    }
    logger.error('Orchestrator failed', { error: String(e) })
    return err('AI orchestrator failed', 'ORCHESTRATOR_FAILED', 500)
  } finally {
    clearTimeout(timeoutId)
  }
}

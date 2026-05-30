# Implementation Report: Phase 2 — AI Core

## Summary
Implemented five AI Core service modules inside `features/ai/`: a Zod structured-output schema (`AIResponseSchema`), an OpenAI model-provider abstraction (`createLanguageModel`), a tool-registry with 8 stub tool definitions using Vercel AI SDK v6's `tool()` helper, a system-prompt builder with memory-context injection (`buildSystemPrompt`), and an orchestrator that calls `generateObject` and returns a typed `Result<OrchestratorOutput>`. Added `bun test` unit tests for schemas and prompt builder, and added `test`/`test:ai` scripts to `package.json`.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Confidence | 8/10 | 9/10 |
| Files Changed | 9 | 10 (tsconfig.json also updated) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `features/ai/structured-output-schema.ts` | Complete | |
| 2 | `features/ai/model-provider.ts` | Complete | |
| 3 | `features/ai/tool-registry.ts` | Complete | Deviated — `z.record(z.unknown())` → `z.record(z.string(), z.unknown())` (Zod v4 requires key schema) |
| 4 | `features/ai/prompt-builder.ts` | Complete | |
| 5 | `features/ai/ai-orchestrator.ts` | Complete | Deviated — usage via direct property access; messages cast via `unknown as ModelMessage[]` |
| 6 | `features/ai/index.ts` | Complete | |
| 7 | `package.json` scripts | Complete | |
| 8 | `features/ai/__tests__/structured-output-schema.test.ts` | Complete | 10 tests |
| 9 | `features/ai/__tests__/prompt-builder.test.ts` | Complete | 7 tests |
| +  | `tsconfig.json` | Complete | Excluded `**/__tests__/**` so `bun:test` module doesn't cause tsc errors |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Type Check | Pass | Exit 0, 0 errors |
| Unit Tests | Pass | 17 tests, 25 expect() calls across 2 files |
| Build | Pass | Exit 0, 5 routes generated (unchanged from Phase 1) |
| Integration | N/A | No API routes in Phase 2 |
| Edge Cases | Pass | Covered by test suite |

## Files Changed

| File | Action | Notes |
|---|---|---|
| `features/ai/structured-output-schema.ts` | CREATED | Zod schemas for AIResponse, EventDraftUpdate, ConversationIntent, ApprovalAction |
| `features/ai/model-provider.ts` | CREATED | createLanguageModel() wrapping @ai-sdk/openai |
| `features/ai/tool-registry.ts` | CREATED | 8 tool stubs with inputSchema + execute |
| `features/ai/prompt-builder.ts` | CREATED | buildSystemPrompt() with memory + draft injection |
| `features/ai/ai-orchestrator.ts` | CREATED | runOrchestrator() returning Result<OrchestratorOutput> |
| `features/ai/index.ts` | UPDATED | Replaced placeholder with 5 barrel exports |
| `features/ai/__tests__/structured-output-schema.test.ts` | CREATED | 10 tests |
| `features/ai/__tests__/prompt-builder.test.ts` | CREATED | 7 tests |
| `package.json` | UPDATED | Added `test` and `test:ai` scripts |
| `tsconfig.json` | UPDATED | Excluded `**/__tests__/**` from tsc |

## Deviations from Plan

| Deviation | Reason |
|---|---|
| `z.record(z.string(), z.unknown())` instead of `z.record(z.unknown())` | Zod v4 requires explicit key schema as first argument; one-argument form causes TS2554 |
| `result.usage.inputTokens` direct access instead of `Record<string, number>` cast | SDK v6 `LanguageModelUsage` has `inputTokens` and `outputTokens` directly; the intermediate cast failed type-check because the type has non-number nested properties (`inputTokenDetails`) |
| `messages as unknown as ModelMessage[]` double-cast | `Parameters<typeof generateObject>[0]['messages']` resolves to `ModelMessage[] \| undefined` across overloads; double-cast avoids the `undefined` incompatibility |
| `tsconfig.json` exclude `**/__tests__/**` | `bun:test` module is not in `@types/bun` devDependency; excluding test files from tsc is the correct approach for a Next.js project using bun as the test runner |

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `features/ai/__tests__/structured-output-schema.test.ts` | 10 | AIResponseSchema validation, EventDraftUpdateSchema, validateAIResponse, edge cases |
| `features/ai/__tests__/prompt-builder.test.ts` | 7 | Branding content, user injection, memory injection, draft injection, draft omission |

## Next Steps
- [ ] Set real `OPENAI_API_KEY` in `.env.local` before testing the orchestrator against OpenAI
- [ ] Run `/prp-plan .claude/PRPs/prds/ai-community-assistant-platform.prd.md` for Phase 3 (Feature Services) and Phase 4 (UI Components) which can run in parallel

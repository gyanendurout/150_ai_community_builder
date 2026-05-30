// DUPR (Dynamic Universal Pickleball Rating) lookup contracts.
//
// The service is intentionally abstracted so the POC stub backed by
// `mock_dupr_ratings` can be swapped for the real DUPR API later without
// touching callers. All callers must handle EVERY status value.

export type DuprStatus =
  | 'found'
  | 'not_found'
  | 'multiple'
  | 'error'
  | 'skipped'
  | 'not_checked'

export type DuprMatch = {
  dupr_id: string
  full_name: string
  rating: number // 2.0 - 8.0
}

// Discriminated union — narrowing by status gives exhaustive handling.
export type DuprLookupResult =
  | { status: 'found'; match: DuprMatch }
  | { status: 'multiple'; matches: DuprMatch[] }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'skipped' }

export type DuprLookupQuery =
  | { kind: 'by_id'; dupr_id: string }
  | { kind: 'by_name'; name: string }
  | { kind: 'skip' }

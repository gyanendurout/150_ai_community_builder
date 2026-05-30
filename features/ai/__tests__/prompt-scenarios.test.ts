import { describe, test, expect } from 'bun:test'
import { buildSystemPrompt } from '../prompt-builder'
import type { PromptContext, CourtContextEntry, UserLocationContext } from '../prompt-builder'

// --- Fixtures: real seeded SF courts + real cities ---
const SF_COURT_1: CourtContextEntry = {
  id: '00000000-0000-0000-0000-000000000101',
  name: 'Joola Court A',
  address: '123 Pickleball Ave, San Francisco, CA',
  indoor_outdoor: 'indoor',
  latitude: 37.7749,
  longitude: -122.4194,
  distance_km: 0.2,
}

const SF_COURT_2: CourtContextEntry = {
  id: '00000000-0000-0000-0000-000000000105',
  name: 'Golden Gate PB Center',
  address: '100 Park Drive, San Francisco, CA',
  indoor_outdoor: 'outdoor',
  latitude: 37.7694,
  longitude: -122.4862,
  distance_km: 5.8,
}

const BENGALURU_LOC: UserLocationContext = {
  lat: 12.9716,
  lng: 77.5946,
  accuracy_m: 50,
  city: 'Bengaluru',
  region: 'Karnataka',
  country: 'India',
  country_code: 'IN',
}

const SF_LOC: UserLocationContext = {
  lat: 37.7749,
  lng: -122.4194,
  accuracy_m: 30,
  city: 'San Francisco',
  region: 'California',
  country: 'United States',
  country_code: 'US',
}

const NYC_LOC: UserLocationContext = {
  lat: 40.7128,
  lng: -74.006,
  accuracy_m: 40,
  city: 'New York',
  region: 'New York',
  country: 'United States',
  country_code: 'US',
}

function ctx(over: Partial<PromptContext>): PromptContext {
  return {
    conversationType: 'event_creation',
    userName: 'Test User',
    memories: [],
    currentDraft: null,
    availableCourts: [],
    userLocation: null,
    userTimezone: null,
    profileMode: null,
    ...over,
  }
}

describe('Prompt scenarios — 10 real user situations', () => {
  // ─── Scenario 1: India user, no nearby courts ───
  test('[1] Bengaluru user with no nearby courts → prompt tells AI to acknowledge Bengaluru and ask for venue', () => {
    const prompt = buildSystemPrompt(ctx({ userLocation: BENGALURU_LOC, availableCourts: [] }))
    expect(prompt).toContain('Bengaluru')
    expect(prompt).toContain('India')
    expect(prompt).toContain('NONE within 100 km')
    expect(prompt).toContain('DO NOT suggest distant courts')
    expect(prompt).toContain('venue name and address')
  })

  // ─── Scenario 2: SF user with real nearby courts ───
  test('[2] SF user with 2 nearby courts → courts listed with distances, marked as filtered', () => {
    const prompt = buildSystemPrompt(ctx({ userLocation: SF_LOC, availableCourts: [SF_COURT_1, SF_COURT_2] }))
    expect(prompt).toContain('San Francisco')
    expect(prompt).toContain('Joola Court A')
    expect(prompt).toContain('Golden Gate PB Center')
    expect(prompt).toContain('0.2 km away')
    expect(prompt).toContain('5.8 km away')
    expect(prompt).toContain('already filtered to ≤100 km')
  })

  // ─── Scenario 3: NYC user — SF courts hidden ───
  test('[3] NYC user → empty list → prompt acknowledges New York and asks for venue', () => {
    const prompt = buildSystemPrompt(ctx({ userLocation: NYC_LOC, availableCourts: [] }))
    expect(prompt).toContain('New York')
    expect(prompt).toContain('NONE within 100 km')
    expect(prompt).not.toContain('Joola Court A')
  })

  // ─── Scenario 4: User shared no location at all ───
  test('[4] No location shared → prompt instructs AI to ask before suggesting', () => {
    const prompt = buildSystemPrompt(ctx({ userLocation: null, availableCourts: [SF_COURT_1] }))
    expect(prompt).toContain('USER LOCATION: not shared')
    expect(prompt).toContain('ask the user to share location first')
    expect(prompt).toContain('DO NOT pre-suggest courts')
  })

  // ─── Scenario 5: Reverse geocode failed — coords only, no city ───
  test('[5] Location shared but reverse-geocode failed → USER LOCATION line shows coords only', () => {
    const noCityLoc: UserLocationContext = { ...BENGALURU_LOC, city: null, region: null, country: null, country_code: null }
    const prompt = buildSystemPrompt(ctx({ userLocation: noCityLoc, availableCourts: [] }))

    // Assert ONLY the actual USER LOCATION line is clean — the instructions section
    // may legitimately mention example city names for the AI's guidance.
    const locationLine = prompt.split('\n').find(l => l.startsWith('USER LOCATION:'))
    expect(locationLine).toBeDefined()
    expect(locationLine!).toContain('lat=12.9716')
    expect(locationLine!).toContain('lng=77.5946')
    expect(locationLine!).not.toContain('Bengaluru')
    expect(locationLine!).not.toContain('Karnataka')
    expect(locationLine!).not.toContain('India')

    expect(prompt).toContain('NONE within 100 km')
  })

  // ─── Scenario 6: User has memory but it should never be invented ───
  test('[6] AI is forbidden from claiming memory-not-in-list as user preference', () => {
    const prompt = buildSystemPrompt(ctx({ memories: [{ key: 'preferred_day', value: 'Saturday', confidence: 0.9 }] }))
    expect(prompt).toContain('preferred_day')
    expect(prompt).toContain('NEVER claim a user preference exists unless it is present in the USER MEMORY')
  })

  // ─── Scenario 7: Empty memory → AI must not invent preferences ───
  test('[7] Empty memory → prompt explicitly says (none — ask before assuming)', () => {
    const prompt = buildSystemPrompt(ctx({ memories: [] }))
    expect(prompt).toContain('USER MEMORY: (none — ask for preferences before assuming any)')
  })

  // ─── Scenario 8: Approval gate enforced (no Untitled Event) ───
  test('[8] APPROVAL GATE rule blocks approval when title is missing or "Untitled"', () => {
    const prompt = buildSystemPrompt(ctx({}))
    expect(prompt).toContain('APPROVAL GATE')
    expect(prompt).toContain('title is set in the draft (not "Untitled Event", not empty)')
    expect(prompt).toContain('TITLE GENERATION')
    expect(prompt).toContain('Format: "[Capacity]-Player [Event Type] — [Day]"')
  })

  // ─── Scenario 9: User mentions a court NOT in the available list ───
  test('[9] AI is told to refuse unknown courts and propose alternatives or manual venue', () => {
    const prompt = buildSystemPrompt(ctx({ userLocation: SF_LOC, availableCourts: [SF_COURT_1] }))
    expect(prompt).toContain('NEVER invent court names')
    expect(prompt).toContain("I don't have that court in my system")
    expect(prompt).toContain('add the location as a free-text venue')
  })

  // ─── Scenario 10: AI must not claim weather/web/Maps capabilities ───
  test('[10] AI is forbidden from claiming it can browse web, Google Maps, or check live weather', () => {
    const prompt = buildSystemPrompt(ctx({}))
    expect(prompt).toContain('NEVER claim to access weather, Google Maps, the web')
    expect(prompt).toContain('The only data you have is what appears in this prompt')
  })

  // ─── Scenario 11: One question per turn (was bundling 2 questions before) ───
  test('[11] AI is instructed to ask EXACTLY ONE question per turn', () => {
    const prompt = buildSystemPrompt(ctx({}))
    expect(prompt).toContain('Ask EXACTLY ONE question per turn')
    expect(prompt).toContain('Never bundle two or more questions')
    expect(prompt).toContain('quick_replies (up to 4 chips) must DIRECTLY answer the single question')
  })

  // ─── Scenario 12: External (OSM) courts handled correctly ───
  test('[12] External OSM court (id=null) → prompt tells AI to use location_name + address, not court_id', () => {
    const osmCourt: CourtContextEntry = {
      id: null,
      name: 'Bengaluru Pickle Club',
      address: 'MG Road, Bengaluru',
      indoor_outdoor: 'indoor',
      latitude: 12.9716,
      longitude: 77.5946,
      distance_km: 1.2,
    }
    const prompt = buildSystemPrompt(ctx({ userLocation: BENGALURU_LOC, availableCourts: [osmCourt] }))
    expect(prompt).toContain('Bengaluru Pickle Club')
    expect(prompt).toContain('(external — OSM)')
    expect(prompt).toContain('put the name into location_name and the address into address')
    expect(prompt).toContain('do NOT set court_id')
  })

  // ─── Scenario 13: Mixed list — seeded UUID + OSM external entries ───
  test('[13] Mixed seeded + OSM courts → AI told which to use as court_id vs location_name', () => {
    const osmCourt: CourtContextEntry = {
      id: null,
      name: 'OSM Court',
      address: null,
      indoor_outdoor: null,
      latitude: 37.77,
      longitude: -122.42,
      distance_km: 0.3,
    }
    const prompt = buildSystemPrompt(ctx({ userLocation: SF_LOC, availableCourts: [SF_COURT_1, osmCourt] }))
    expect(prompt).toContain('id=00000000-0000-0000-0000-000000000101')
    expect(prompt).toContain('(external — OSM)')
    expect(prompt).toContain('For entries with id=<uuid>, set court_id=<uuid>')
  })

  // ─── Scenario 14: Browser timezone is authoritative, overrides memory ───
  test('[14] Browser timezone Asia/Kolkata overrides memory user_timezone=America/Los_Angeles', () => {
    const prompt = buildSystemPrompt(ctx({
      userTimezone: 'Asia/Kolkata',
      memories: [
        { key: 'user_timezone', value: 'America/Los_Angeles', confidence: 0.99 },
      ],
    }))
    expect(prompt).toContain('USER TIMEZONE: Asia/Kolkata (AUTHORITATIVE')
    expect(prompt).toContain('IGNORE any user_timezone value in USER MEMORY')
    expect(prompt).toContain('+05:30')
  })

  // ─── Scenario 15: No browser timezone provided → fall back ───
  test('[15] No browser timezone → prompt tells AI to fall back to memory then UTC', () => {
    const prompt = buildSystemPrompt(ctx({ userTimezone: null }))
    expect(prompt).toContain('USER TIMEZONE: not provided')
    expect(prompt).toContain('fall back to USER MEMORY user_timezone')
  })

  // ─── Scenario 16: The "AI claims event was created" hallucination ───
  test('[16] Prompt forbids "event has been created/booked" hallucination', () => {
    const prompt = buildSystemPrompt(ctx({}))
    expect(prompt).toContain('You do NOT create events')
    expect(prompt).toContain('Your event has been created')
    expect(prompt).toContain('Your event has been booked')
    expect(prompt).toContain('CRITICAL FORBIDDEN PHRASES')
    expect(prompt).toContain("Approve & Create")
  })

  // ─── Scenario 17: User types "yes" — must NOT claim event created ───
  test('[17] When user types "yes" after approval was raised, AI must redirect to the button', () => {
    const prompt = buildSystemPrompt(ctx({}))
    expect(prompt).toContain('When the user types "yes" / "confirm"')
    expect(prompt).toContain("click 'Approve & Create' on the right panel to finalize")
    expect(prompt).toContain('Keep requires_approval=true so the approval card stays visible')
  })

  // ─── Scenario 18: Explicit example for Asia/Kolkata offset (the exact bug we hit) ───
  test('[18] Prompt teaches "3 PM in Kolkata → +05:30 offset, NOT -07:00"', () => {
    const prompt = buildSystemPrompt(ctx({ userTimezone: 'Asia/Kolkata' }))
    expect(prompt).toContain('"2026-05-30T15:00:00+05:30"')
    expect(prompt).toContain('DO NOT output a -07:00 (PST) offset for a user whose browser timezone is Asia/Kolkata')
  })
})

// ============================================================================
// PROFILE MODE — Phase 3 scenarios (NEW)
// ============================================================================

describe('Profile mode — Phase 3 scenarios', () => {
  // ─── P1: profile mode appended only when conversationType === 'profile_creation' AND profileMode set
  test('[P1] event-mode prompt does NOT include the profile-mode block', () => {
    const prompt = buildSystemPrompt(ctx({ conversationType: 'event_creation', profileMode: null }))
    expect(prompt).not.toContain('PROFILE CREATION MODE')
    expect(prompt).not.toContain('PROFILE ANTI-HALLUCINATION RULES')
  })

  test('[P2] profile-mode prompt includes the profile rules', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null,
        existingSkill: null,
        duprLookupResult: null,
        assessmentResult: null,
      },
    }))
    expect(prompt).toContain('PROFILE CREATION MODE')
    expect(prompt).toContain('PROFILE ANTI-HALLUCINATION RULES')
    expect(prompt).toContain('display_name')
    expect(prompt).toContain('Approve & Save Profile')
  })

  // ─── DUPR anti-hallucination ───────────────────────────────────────────
  test('[P3] DUPR LOOKUP RESULT=null → AI told NOT to mention any rating', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: null, assessmentResult: null,
      },
    }))
    expect(prompt).toContain('DUPR LOOKUP RESULT: none this turn')
    expect(prompt).toContain('do NOT mention or quote any DUPR rating yet')
  })

  test('[P4] DUPR status=found → AI may quote the EXACT rating', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: {
          status: 'found',
          matches: [{ dupr_id: 'DUPR-DEMO-0001', full_name: 'Alex Chen', rating: 3.75 }],
          message: null,
        },
        assessmentResult: null,
      },
    }))
    expect(prompt).toContain('status=found')
    expect(prompt).toContain('rating=3.75')
    expect(prompt).toContain('dupr_id="DUPR-DEMO-0001"')
    expect(prompt).toContain('You MAY quote this exact rating')
  })

  test('[P5] DUPR status=not_found → AI told NOT to invent a rating', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: { status: 'not_found', matches: [], message: null },
        assessmentResult: null,
      },
    }))
    expect(prompt).toContain('status=not_found')
    expect(prompt).toContain("I couldn't find your DUPR rating")
    expect(prompt).toContain('Do NOT mention any rating')
  })

  test('[P6] DUPR status=multiple → AI told to ask user to disambiguate', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: {
          status: 'multiple',
          matches: [
            { dupr_id: 'D1', full_name: 'Alex Chen', rating: 3.75 },
            { dupr_id: 'D2', full_name: 'Alex Karim', rating: 4.20 },
          ],
          message: null,
        },
        assessmentResult: null,
      },
    }))
    expect(prompt).toContain('status=multiple')
    expect(prompt).toContain('Alex Chen')
    expect(prompt).toContain('Alex Karim')
    expect(prompt).toContain('Do NOT pick one automatically')
  })

  test('[P7] DUPR status=error → AI told to offer assessment/manual fallback', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: { status: 'error', matches: [], message: 'DUPR API timeout' },
        assessmentResult: null,
      },
    }))
    expect(prompt).toContain('status=error')
    expect(prompt).toContain('DUPR API timeout')
    expect(prompt).toContain('DUPR lookup is unavailable right now')
  })

  // ─── Assessment anti-recompute ─────────────────────────────────────────
  test('[P8] No assessment result yet → AI told not to quote any rating', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: null, assessmentResult: null,
      },
    }))
    expect(prompt).toContain('ASSESSMENT RESULT: none yet')
    expect(prompt).toContain('do NOT quote any assessment-derived rating')
    expect(prompt).toContain('assessment_action="start"')
  })

  test('[P9] Assessment result present → AI told to quote EXACTLY, not recompute', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: null,
        assessmentResult: {
          app_skill_rating: 3.4,
          skill_label: 'intermediate',
          style_profile: 'control_focused_player',
          confidence_score: 0.9,
        },
      },
    }))
    expect(prompt).toContain('app_skill_rating: 3.4')
    expect(prompt).toContain('skill_label: intermediate')
    expect(prompt).toContain('style_profile: control_focused_player')
    expect(prompt).toContain('quote EXACTLY')
    expect(prompt).toContain('do NOT recompute')
  })

  // ─── Save finality (same as event_creation pattern) ────────────────────
  test('[P10] Profile mode forbids "profile saved/created" hallucination', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: null, assessmentResult: null,
      },
    }))
    expect(prompt).toContain('NEVER claim the profile has been saved')
    expect(prompt).toContain('Your profile has been saved')
    expect(prompt).toContain('Profile created')
    expect(prompt).toContain('Approve & Save Profile')
  })

  // ─── Existing profile is acknowledged ──────────────────────────────────
  test('[P11] Existing profile is acknowledged so AI does not re-ask saved fields', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: {
          display_name: 'Alex Chen',
          visibility: 'public',
          home_court_id: '00000000-0000-0000-0000-000000000101',
          home_court_name: 'Joola Court A',
          home_location_text: null,
          has_dob: false,
          has_gender: false,
          has_bio: false,
        },
        existingSkill: null,
        duprLookupResult: null,
        assessmentResult: null,
      },
    }))
    expect(prompt).toContain('EXISTING PROFILE')
    expect(prompt).toContain('Alex Chen')
    expect(prompt).toContain('Joola Court A')
    expect(prompt).toContain("don't re-ask these fields")
  })

  // ─── Skill source isolation rule must be visible to AI ─────────────────
  test('[P12] Skill source rules: manual → self_rating; dupr → dupr_rating+id; assessment → result fields', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: null, assessmentResult: null,
      },
    }))
    expect(prompt).toContain('skill_source (manual | dupr | assessment)')
    expect(prompt).toContain('If skill_source=manual: self_rating (1.0-5.0)')
    expect(prompt).toContain('If skill_source=dupr: dupr_rating (2.0-8.0) AND dupr_id')
  })

  // ─── Approval gate uses save_profile, not create_event ─────────────────
  test('[P13] Approval action in profile mode is save_profile', () => {
    const prompt = buildSystemPrompt(ctx({
      conversationType: 'profile_creation',
      profileMode: {
        existingProfile: null, existingSkill: null,
        duprLookupResult: null, assessmentResult: null,
      },
    }))
    expect(prompt).toContain('approval_action="save_profile"')
  })
})

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProfileService } from '@/features/profiles/profile.service'
import { CourtService } from '@/features/courts/court.service'
import { EntityPreviewCard } from '@/components/event-draft/EntityPreviewCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { getEligibilityWarnings, type ProfileDraft } from '@/features/profiles/profile.types'
import type { StatusBadgeVariant } from '@/components/shared/StatusBadge'

// Map user_profiles.status onto the StatusBadge palette. 'active' isn't a
// StatusBadge variant — surface saved profiles as 'approved' (green) which
// matches the "this is live, ready to use" semantics.
function mapProfileStatus(status: string): StatusBadgeVariant {
  if (status === 'active') return 'approved'
  if (status === 'draft') return 'draft'
  if (status === 'suspended') return 'cancelled'
  if (status === 'deleted') return 'rejected'
  return 'draft'
}

function formatLabel(s: string | null | undefined): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatRating(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toFixed(2)
}

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const profileService = new ProfileService()
  const result = await profileService.getById(id)

  if (result.error || !result.data) {
    notFound()
  }

  const { profile, skill, latest_assessment } = result.data

  // Resolve home_court_id to a name so the page reads like a profile, not a
  // database dump. Best-effort — falls back to home_location_text or em-dash.
  let homeCourtName: string | null = null
  if (profile.home_court_id) {
    const courtService = new CourtService()
    const courtResult = await courtService.getCourt(profile.home_court_id)
    homeCourtName = courtResult.data?.name ?? null
  }

  // Eligibility warnings are derived from the same logic the chat surfaces —
  // surfacing them on the profile page tells the player which fields, if
  // added, would unlock more events.
  const warnings = getEligibilityWarnings({
    display_name: profile.display_name ?? undefined,
    avatar_url: profile.avatar_url ?? undefined,
    dob: profile.dob ?? undefined,
    age_band: profile.age_band ?? undefined,
    gender: profile.gender ?? undefined,
    home_court_id: profile.home_court_id ?? undefined,
    home_location_text: profile.home_location_text ?? undefined,
    bio: profile.bio ?? undefined,
    visibility: profile.visibility,
    skill_source:
      skill?.skill_source === 'manual' ||
      skill?.skill_source === 'dupr' ||
      skill?.skill_source === 'assessment'
        ? skill.skill_source
        : undefined,
    self_rating: skill?.self_rating ?? undefined,
    dupr_rating: skill?.dupr_rating ?? undefined,
    app_skill_rating: skill?.app_skill_rating ?? undefined,
    skill_label: (skill?.skill_label as ProfileDraft['skill_label']) ?? undefined,
  })

  const identityFields = [
    { label: 'Display Name', value: profile.display_name ?? '—' },
    { label: 'Visibility',   value: formatLabel(profile.visibility) },
    { label: 'Age Band',     value: formatLabel(profile.age_band) },
    { label: 'Gender',       value: formatLabel(profile.gender) },
    { label: 'Home Court',   value: homeCourtName ?? profile.home_location_text ?? '—' },
    { label: 'Bio',          value: profile.bio ?? '—' },
    { label: 'Source',       value: profile.source },
    { label: 'Completion',   value: `${profile.profile_completion_percentage}%` },
  ]

  // Skill panel only renders when a skill row exists. If the user saved
  // identity-only (rare in practice), we omit it instead of showing dashes.
  const skillFields = skill
    ? [
        { label: 'Source',        value: formatLabel(skill.skill_source) },
        { label: 'Self Rating',   value: skill.self_rating != null ? skill.self_rating.toFixed(1) : '—' },
        { label: 'DUPR Rating',   value: formatRating(skill.dupr_rating) },
        { label: 'DUPR Status',   value: formatLabel(skill.dupr_status) },
        { label: 'App Rating',    value: skill.app_skill_rating != null ? skill.app_skill_rating.toFixed(1) : '—' },
        { label: 'Skill Label',   value: formatLabel(skill.skill_label) },
        { label: 'Style',         value: formatLabel(skill.style_profile) },
        { label: 'Confidence',    value: skill.confidence_score != null ? skill.confidence_score.toFixed(2) : '—' },
        { label: 'Last Assessed', value: skill.last_assessed_at ?? '—' },
      ]
    : null

  // Latest assessment is rendered as a separate card so a player can see the
  // exact run that produced their skill numbers (anti-hallucination: every
  // value is a real DB row, never an AI invention).
  const assessmentFields = latest_assessment
    ? [
        { label: 'Total Score',  value: latest_assessment.total_score },
        { label: 'App Rating',   value: latest_assessment.app_skill_rating.toFixed(1) },
        { label: 'Skill Label',  value: formatLabel(latest_assessment.skill_label) },
        { label: 'Style',        value: formatLabel(latest_assessment.style_profile) },
        { label: 'Confidence',   value: latest_assessment.confidence_score?.toFixed(2) ?? '—' },
        { label: 'Taken',        value: latest_assessment.created_at },
      ]
    : null

  return (
    <main className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <Link
          href="/profiles"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← All Players
        </Link>

        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 break-words text-xl font-bold text-ink sm:text-2xl">
            {profile.display_name ?? 'Unnamed Player'}
          </h1>
          <StatusBadge status={mapProfileStatus(profile.status)} />
        </div>

        <EntityPreviewCard title="Profile" fields={identityFields} />

        {skillFields && (
          <EntityPreviewCard title="Skill Profile" fields={skillFields} />
        )}

        {assessmentFields && (
          <EntityPreviewCard title="Latest Assessment" fields={assessmentFields} />
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-sky-800">
              Suggestions to unlock more events
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-sky-700">
              {warnings.map(w => (
                <li key={w.field}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}

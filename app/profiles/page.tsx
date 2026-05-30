import Link from 'next/link'
import { ProfileService } from '@/features/profiles/profile.service'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { StatusBadgeVariant } from '@/components/shared/StatusBadge'

function mapProfileStatus(status: string): StatusBadgeVariant {
  if (status === 'active') return 'approved'
  if (status === 'suspended') return 'cancelled'
  if (status === 'deleted') return 'rejected'
  return 'draft'
}

function formatLabel(s: string | null | undefined): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function skillSummary(
  skillLevel: string | null,
  duprRating: number | null,
  appSkillRating: number | null,
): string {
  if (duprRating != null) return `DUPR ${duprRating.toFixed(2)}`
  if (appSkillRating != null) return `App ${appSkillRating.toFixed(1)}`
  if (skillLevel) return formatLabel(skillLevel)
  return '—'
}

export default async function ProfilesListPage() {
  const service = new ProfileService()
  const result = await service.listProfiles()
  const profiles = result.data ?? []

  return (
    <main className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-y-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">Players</h1>
            <p className="mt-1 text-sm text-muted">
              {profiles.length} player{profiles.length !== 1 ? 's' : ''} registered
            </p>
          </div>
          <Link
            href="/ai-profile"
            className="rounded-full bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            + My Profile
          </Link>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-xl border border-border bg-white p-10 text-center">
            <p className="text-muted">No player profiles yet.</p>
            <Link href="/ai-profile" className="mt-2 inline-block text-sm text-primary hover:underline">
              Create your profile →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map(profile => (
              <Link
                key={profile.id}
                href={`/profiles/${profile.id}`}
                className="group rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-ink group-hover:text-primary line-clamp-1">
                    {profile.display_name ?? 'Unnamed Player'}
                  </h2>
                  <StatusBadge status={mapProfileStatus(profile.status)} />
                </div>

                <dl className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-medium text-ink/50">Skill</dt>
                    <dd className="text-ink/80">
                      {skillSummary(profile.skill_level, profile.dupr_rating, profile.app_skill_rating)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-medium text-ink/50">Gender</dt>
                    <dd className="text-ink/80">{formatLabel(profile.gender)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-medium text-ink/50">Visibility</dt>
                    <dd className="text-ink/80">{formatLabel(profile.visibility)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-medium text-ink/50">Complete</dt>
                    <dd className="text-ink/80">{profile.profile_completion_percentage}%</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

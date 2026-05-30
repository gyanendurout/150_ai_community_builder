import Link from 'next/link'
import { ProfileService } from '@/features/profiles/profile.service'
import { DEMO_USER_ID } from '@/lib/constants'
import { ProfileEditClient } from './ProfileEditClient'

export default async function MyProfilePage() {
  const service = new ProfileService()
  const result = await service.getCombined(DEMO_USER_ID)

  if (result.error || !result.data) {
    return (
      <main className="min-h-screen bg-cream px-4 py-8">
        <div className="mx-auto max-w-lg space-y-6">
          <h1 className="text-xl font-bold text-ink">My Profile</h1>
          <div className="rounded-xl border border-border bg-white p-10 text-center">
            <p className="text-muted">You haven&apos;t created a profile yet.</p>
            <Link
              href="/ai-profile"
              className="mt-3 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              Create Profile →
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const { profile, skill } = result.data

  return (
    <main className="min-h-screen bg-cream px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        <ProfileEditClient profile={profile} skill={skill} />
      </div>
    </main>
  )
}

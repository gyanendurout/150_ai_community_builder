'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserProfileRow, PlayerSkillProfileRow } from '@/lib/supabase/types'
import { StatusBadge } from '@/components/shared/StatusBadge'

function fmt(s: string | null | undefined): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

interface Props {
  profile: UserProfileRow
  skill: PlayerSkillProfileRow | null
}

type FormState = {
  display_name: string
  visibility: string
  age_band: string
  gender: string
  home_location_text: string
  bio: string
  skill_source: string
  self_rating: string
  dupr_rating: string
  skill_label: string
}

export function ProfileEditClient({ profile, skill }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    display_name: profile.display_name ?? '',
    visibility: profile.visibility ?? 'public',
    age_band: profile.age_band ?? '',
    gender: profile.gender ?? '',
    home_location_text: profile.home_location_text ?? '',
    bio: profile.bio ?? '',
    skill_source: skill?.skill_source ?? 'manual',
    self_rating: skill?.self_rating != null ? String(skill.self_rating) : '',
    dupr_rating: skill?.dupr_rating != null ? String(skill.dupr_rating) : '',
    skill_label: skill?.skill_label ?? '',
  })

  function field(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        display_name: form.display_name,
        visibility: form.visibility,
        age_band: form.age_band || null,
        gender: form.gender || null,
        home_location_text: form.home_location_text || null,
        bio: form.bio || null,
        skill_source: form.skill_source,
        skill_label: form.skill_label || null,
      }
      if (form.skill_source === 'manual' && form.self_rating) {
        body.self_rating = Number(form.self_rating)
      }
      if (form.skill_source === 'dupr' && form.dupr_rating) {
        body.dupr_rating = Number(form.dupr_rating)
      }

      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40'
  const labelCls = 'block text-xs font-medium text-ink/60 mb-1'

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-ink">Edit My Profile</h1>
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setError(null) }}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-soft transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="rounded-xl border border-border bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Identity</h2>
          <div>
            <label className={labelCls}>Display Name *</label>
            <input className={inputCls} value={form.display_name} onChange={e => field('display_name', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Visibility</label>
              <select className={inputCls} value={form.visibility} onChange={e => field('visibility', e.target.value)}>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="friends">Friends</option>
                <option value="friends_only">Friends Only</option>
                <option value="event_participants">Event Participants</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Age Band</label>
              <select className={inputCls} value={form.age_band} onChange={e => field('age_band', e.target.value)}>
                <option value="">—</option>
                <option value="under_18">Under 18</option>
                <option value="18_29">18–29</option>
                <option value="30_39">30–39</option>
                <option value="40_49">40–49</option>
                <option value="50_59">50–59</option>
                <option value="60_plus">60+</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Gender</label>
              <select className={inputCls} value={form.gender} onChange={e => field('gender', e.target.value)}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="self_describe">Self-describe</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Home Location</label>
              <input className={inputCls} placeholder="City, area, or venue name" value={form.home_location_text} onChange={e => field('home_location_text', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Bio</label>
            <textarea rows={3} className={inputCls} value={form.bio} onChange={e => field('bio', e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Skill</h2>
          <div>
            <label className={labelCls}>Skill Source</label>
            <select className={inputCls} value={form.skill_source} onChange={e => field('skill_source', e.target.value)}>
              <option value="manual">Manual (self-rating)</option>
              <option value="dupr">DUPR</option>
              <option value="assessment">App Assessment</option>
            </select>
          </div>
          {form.skill_source === 'manual' && (
            <div>
              <label className={labelCls}>Self Rating (1.0 – 5.0)</label>
              <input type="number" step="0.1" min="1" max="5" className={inputCls} value={form.self_rating} onChange={e => field('self_rating', e.target.value)} />
            </div>
          )}
          {form.skill_source === 'dupr' && (
            <div>
              <label className={labelCls}>DUPR Rating (2.0 – 8.0)</label>
              <input type="number" step="0.01" min="2" max="8" className={inputCls} value={form.dupr_rating} onChange={e => field('dupr_rating', e.target.value)} />
            </div>
          )}
          <div>
            <label className={labelCls}>Skill Label</label>
            <select className={inputCls} value={form.skill_label} onChange={e => field('skill_label', e.target.value)}>
              <option value="">—</option>
              <option value="beginner">Beginner</option>
              <option value="developing">Developing</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold text-ink sm:text-2xl">
            {profile.display_name ?? 'My Profile'}
          </h1>
          <p className="mt-0.5 text-sm text-muted">{profile.profile_completion_percentage}% complete</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={profile.status === 'active' ? 'approved' : 'draft'} />
          <button
            onClick={() => setEditing(true)}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-soft transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Identity</h2>
        <dl className="space-y-2 text-sm">
          {[
            ['Visibility',    fmt(profile.visibility)],
            ['Age Band',      fmt(profile.age_band)],
            ['Gender',        fmt(profile.gender)],
            ['Home Location', profile.home_location_text ?? '—'],
            ['Bio',           profile.bio ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-24 shrink-0 text-xs font-medium text-ink/50">{label}</dt>
              <dd className="text-ink/80 whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {skill && (
        <div className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Skill Profile</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Source',      fmt(skill.skill_source)],
              ['Label',       fmt(skill.skill_label)],
              ['Self Rating', skill.self_rating != null ? skill.self_rating.toFixed(1) : '—'],
              ['DUPR',        skill.dupr_rating != null ? skill.dupr_rating.toFixed(2) : '—'],
              ['App Rating',  skill.app_skill_rating != null ? skill.app_skill_rating.toFixed(1) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-24 shrink-0 text-xs font-medium text-ink/50">{label}</dt>
                <dd className="text-ink/80">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

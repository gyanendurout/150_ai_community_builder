'use client'
import Link from 'next/link'
import { Calendar, User, LayoutList, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AppTab =
  | 'event_creation'
  | 'profile_creation'
  | 'events_list'
  | 'profiles_list'

/** @deprecated use AppTab */
export type ChatMode = AppTab

export interface ModeSwitcherProps {
  active: AppTab
  className?: string
}

const TABS = [
  { id: 'events_list' as AppTab,      href: '/events',        label: 'Events',        Icon: LayoutList },
  { id: 'event_creation' as AppTab,   href: '/ai-community',  label: 'Create Event',  Icon: Calendar   },
  { id: 'profiles_list' as AppTab,    href: '/profiles',      label: 'Players',       Icon: Users      },
  { id: 'profile_creation' as AppTab, href: '/ai-profile',    label: 'My Profile',    Icon: User       },
]

export function ModeSwitcher({ active, className }: ModeSwitcherProps) {
  return (
    <nav
      aria-label="App navigation"
      className={cn(
        'flex items-center gap-1 rounded-full border border-border bg-white p-1 shadow-sm',
        className,
      )}
    >
      {TABS.map(({ id, href, label, Icon }) => (
        <Link
          key={id}
          href={href}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-2.5 sm:px-3 text-xs font-medium transition-colors',
            active === id
              ? 'bg-primary text-white'
              : 'text-muted hover:bg-soft hover:text-ink',
          )}
          aria-current={active === id ? 'page' : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </Link>
      ))}
    </nav>
  )
}

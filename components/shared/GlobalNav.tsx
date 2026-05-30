'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, LayoutList, UserPlus, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/ai-community', label: 'Create Event',     Icon: Calendar   },
  { href: '/events',       label: 'View/Edit Events', Icon: LayoutList  },
  { href: '/ai-profile',   label: 'Create Profile',   Icon: UserPlus   },
  { href: '/my-profile',   label: 'My Profile',       Icon: User       },
  { href: '/profiles',     label: 'All Profiles',     Icon: Users      },
]

export function GlobalNav() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <nav
        className="mx-auto flex max-w-5xl items-center gap-0.5 overflow-x-auto px-4 py-2 scrollbar-none"
        aria-label="App navigation"
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-muted hover:bg-soft hover:text-ink',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </header>
  )
}

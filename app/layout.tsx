import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { GlobalNav } from '@/components/shared/GlobalNav'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'AI Community Assistant | Joola',
  description: 'Create pickleball events through natural conversation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-cream text-ink antialiased min-h-screen">
        <GlobalNav />
        {children}
      </body>
    </html>
  )
}

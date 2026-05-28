'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'

interface Props {
  roleLabel: string
  namn: string
}

const NAV = [
  { href: '/dashboard',           label: 'Översikt' },
  { href: '/funktionarsuppdrag',  label: 'Funktionärsuppdrag' },
  { href: '/funktionarer',        label: 'Funktionärer' },
  { href: '/karta',               label: 'Karta' },
]

export default function AdminHeader({ roleLabel, namn }: Props) {
  const pathname = usePathname()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Logotyp + användare */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0066CC] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">ST</span>
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 leading-tight">
                STHLM <span className="text-[#FF6B35]">Triathlon</span> 2026
              </p>
              <p className="text-[11px] text-gray-400">9 aug · Stora Skuggan</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs bg-blue-50 text-[#0066CC] px-2 py-1 rounded-full font-medium">
              {roleLabel}
            </span>
            <span className="text-sm text-gray-600 hidden sm:block truncate max-w-[160px]">{namn}</span>
            <SignOutButton />
          </div>
        </div>

        {/* Navigering */}
        <nav className="flex gap-0 -mb-px overflow-x-auto scrollbar-hide">
          {NAV.map(({ href, label }) => {
            const isAktiv = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isAktiv
                    ? 'border-[#0066CC] text-[#0066CC]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

'use client'

import { useState } from 'react'
import type { SektionBemanningsgrad } from '@/lib/database.types'
import SektionKarta from '@/components/SektionKarta'
import FunktionarHem from '@/components/FunktionarHem'
import FunktionarProfil from '@/components/FunktionarProfil'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Flik = 'hem' | 'profil' | 'karta'

export type TilldelningInfo = {
  pass_namn: string
  starttid: string
  sluttid: string
  sektion_namn: string
  sektion_farg: string
  sektionsledare_namn: string | null
  sektionsledare_email: string | null
} | null

export type ProfilData = {
  id: string
  email: string
  full_name: string | null
  telefon: string | null
  klubb: string | null
  sektion_preferens: string | null
  pass_preferens: string | null
  kompetenser: string[] | null
  erfarenhet: string | null
  specialkost: string | null
  registrerad_at: string | null
}

export type SektionVal = {
  id: string
  namn: string
}

interface Props {
  profil: ProfilData
  tilldelning: TilldelningInfo
  sektioner: SektionBemanningsgrad[]
  sektionVal: SektionVal[]
  initialFlik?: Flik
}

export default function FunktionarApp({
  profil,
  tilldelning,
  sektioner,
  sektionVal,
  initialFlik = 'hem',
}: Props) {
  const [aktivFlik, setAktivFlik] = useState<Flik>(initialFlik)
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">

      {/* Topbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#0066CC] flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold">ST</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">
                STHLM <span className="text-[#FF6B35]">Triathlon</span> 2026
              </h1>
              <p className="text-[10px] text-gray-400 leading-tight">9 aug · Stora Skuggan</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded"
          >
            Logga ut
          </button>
        </div>
      </header>

      {/* Innehåll */}
      <main className="flex-1 overflow-y-auto pb-20">
        {aktivFlik === 'hem' && (
          <FunktionarHem
            profil={profil}
            tilldelning={tilldelning}
            onGåTillProfil={() => setAktivFlik('profil')}
          />
        )}
        {aktivFlik === 'profil' && (
          <FunktionarProfil
            profil={profil}
            sektionVal={sektionVal}
          />
        )}
        {aktivFlik === 'karta' && (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Sektionskarta</h2>
            <SektionKarta sektioner={sektioner} />
          </div>
        )}
      </main>

      {/* Tab-bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-200 z-10">
        <div className="flex">
          <TabKnapp
            label="Hem"
            aktiv={aktivFlik === 'hem'}
            onClick={() => setAktivFlik('hem')}
            ikon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            }
          />
          <TabKnapp
            label="Profil"
            aktiv={aktivFlik === 'profil'}
            onClick={() => setAktivFlik('profil')}
            ikon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            }
          />
          <TabKnapp
            label="Karta"
            aktiv={aktivFlik === 'karta'}
            onClick={() => setAktivFlik('karta')}
            ikon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            }
          />
        </div>
      </nav>
    </div>
  )
}

function TabKnapp({
  label,
  aktiv,
  onClick,
  ikon,
}: {
  label: string
  aktiv: boolean
  onClick: () => void
  ikon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
        aktiv ? 'text-[#0066CC]' : 'text-gray-400'
      }`}
    >
      {ikon}
      {label}
    </button>
  )
}

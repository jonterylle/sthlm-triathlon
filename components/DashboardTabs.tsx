'use client'

import { useState } from 'react'
import SektionKarta from '@/components/SektionKarta'
import BjudInFlik from '@/components/BjudInFlik'
import type {
  SektionBemanningsgrad,
  PassBemanningsgrad,
  OtilldeladFunktionar,
} from '@/lib/database.types'

interface SMSRad {
  id: string
  telefon: string
  skickad_at: string
  email_inkommen: string | null
  status: string
}

interface EmailRad {
  id: string
  email: string
  skickad_at: string
  status: string
}

interface Props {
  sektioner: SektionBemanningsgrad[]
  pass: PassBemanningsgrad[]
  otilldelade: OtilldeladFunktionar[]
  totalBehövs: number
  totalTilldelade: number
  totalSaknas: number
  bemanningsgrad: number
  smsInbjudningar: SMSRad[]
  emailInbjudningar: EmailRad[]
}

export default function DashboardTabs({
  sektioner,
  pass,
  otilldelade,
  totalBehövs,
  totalTilldelade,
  totalSaknas,
  bemanningsgrad,
  smsInbjudningar,
  emailInbjudningar,
}: Props) {
  const [aktiv, setAktiv] = useState<'oversikt' | 'karta' | 'bjudin'>('oversikt')

  return (
    <div>
      {/* Flikar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabKnapp aktiv={aktiv === 'oversikt'} onClick={() => setAktiv('oversikt')} label="Översikt" />
        <TabKnapp aktiv={aktiv === 'karta'} onClick={() => setAktiv('karta')} label="Karta" />
        <TabKnapp aktiv={aktiv === 'bjudin'} onClick={() => setAktiv('bjudin')} label="Bjud in" />
      </div>

      {/* Översikt — alltid i DOM, visas/döljs med CSS */}
      <div className={aktiv === 'oversikt' ? 'space-y-8' : 'hidden'}>

        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Summering</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatKort
              label="Bemanningsgrad"
              value={`${bemanningsgrad}%`}
              sub={`${totalTilldelade} av ${totalBehövs} pass`}
              farg={bemanningsgrad >= 80 ? 'green' : bemanningsgrad >= 50 ? 'amber' : 'red'}
            />
            <StatKort label="Tilldelade" value={String(totalTilldelade)} sub="bekräftade pass" farg="blue" />
            <StatKort
              label="Platser kvar"
              value={String(totalSaknas)}
              sub="att fylla"
              farg={totalSaknas === 0 ? 'green' : 'red'}
            />
            <StatKort
              label="Ej tilldelade"
              value={String(otilldelade.length)}
              sub="funktionärer"
              farg={otilldelade.length === 0 ? 'green' : 'amber'}
            />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Sektioner ({sektioner.length})
          </h2>
          {sektioner.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
              Inga sektioner ännu. Kör SQL-migrationen för att lägga in seed-data.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sektioner.map((s) => (
                <SektionKort key={s.id} sektion={s} pass={pass.filter((p) => p.sektion_id === s.id)} />
              ))}
            </div>
          )}
        </section>

        {otilldelade.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Funktionärer utan tilldelning ({otilldelade.length})
            </h2>
            <div className="bg-white rounded-xl border border-amber-200 divide-y divide-gray-100">
              {otilldelade.map((f) => (
                <div key={f.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{f.full_name ?? '(inget namn)'}</p>
                    <p className="text-xs text-gray-500">{f.email}</p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Ej tilldelad</span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* Karta — alltid i DOM, visas/döljs med CSS */}
      <div className={aktiv === 'karta' ? 'block' : 'hidden'}>
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Tävlingsområde – Stora Skuggan, Norra Djurgården
          </h2>
          <SektionKarta sektioner={sektioner} />
        </section>
      </div>

      {/* Bjud in — alltid i DOM, visas/döljs med CSS */}
      <div className={aktiv === 'bjudin' ? 'block' : 'hidden'}>
        <BjudInFlik
          smsInbjudningar={smsInbjudningar}
          emailInbjudningar={emailInbjudningar}
        />
      </div>

    </div>
  )
}

// ── Hjälpkomponenter ──────────────────────────────────────────

function TabKnapp({ aktiv, onClick, label }: { aktiv: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        aktiv
          ? 'border-[#0066CC] text-[#0066CC]'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

function StatKort({
  label, value, sub, farg,
}: {
  label: string; value: string; sub: string; farg: 'green' | 'blue' | 'red' | 'amber'
}) {
  const colors = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-[#0066CC]',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[farg]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-1">{sub}</p>
    </div>
  )
}

function SektionKort({ sektion, pass }: { sektion: SektionBemanningsgrad; pass: PassBemanningsgrad[] }) {
  const procent = sektion.behovs_totalt > 0
    ? Math.round((sektion.tilldelade_totalt / sektion.behovs_totalt) * 100)
    : 0

  const statusBadge =
    sektion.status === 'full' ? 'bg-green-100 text-green-700'
    : sektion.status === 'delvis' ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'

  const statusText =
    sektion.status === 'full' ? 'Fullbemannad'
    : sektion.status === 'delvis' ? 'Delvis'
    : 'Ej bemannad'

  const barColor =
    sektion.status === 'full' ? '#16A34A'
    : sektion.status === 'delvis' ? '#F59E0B'
    : '#DC2626'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: sektion.farg }} />
          <h3 className="text-sm font-semibold text-gray-900">{sektion.namn}</h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge}`}>{statusText}</span>
      </div>

      {sektion.beskrivning && (
        <p className="text-xs text-gray-500 leading-relaxed">{sektion.beskrivning}</p>
      )}

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{sektion.tilldelade_totalt} tilldelade</span>
          <span>{sektion.behovs_totalt} behövs</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(procent, 100)}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {pass.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-gray-100">
          {pass.map((p) => (
            <div key={p.pass_id} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                {p.pass_namn} <span className="text-gray-400">{p.starttid}–{p.sluttid}</span>
              </span>
              <span className={`font-semibold ${p.saknas === 0 ? 'text-green-600' : 'text-red-500'}`}>
                {p.tilldelade}/{p.behovs_antal}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

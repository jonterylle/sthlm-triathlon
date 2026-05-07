'use client'

import { useState } from 'react'
import SektionKarta from '@/components/SektionKarta'
import BjudInFlik from '@/components/BjudInFlik'
import TilldelningsModal from '@/components/TilldelningsModal'
import SektionsledareFlik from '@/components/SektionsledareFlik'
import type {
  SektionBemanningsgrad,
  PassBemanningsgrad,
  OtilldeladFunktionar,
  PassMedSektion,
  SektionsledareInfo,
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
  passMedSektioner: PassMedSektion[]
  otilldelade: OtilldeladFunktionar[]
  totalBehövs: number
  totalTilldelade: number
  totalSaknas: number
  bemanningsgrad: number
  smsInbjudningar: SMSRad[]
  emailInbjudningar: EmailRad[]
  sektionsledare: SektionsledareInfo[]
}

type ModalLäge =
  | { typ: 'fran-funktionar'; funktionar: OtilldeladFunktionar }
  | { typ: 'fran-pass'; passId: string }
  | null

export default function DashboardTabs({
  sektioner,
  pass,
  passMedSektioner,
  otilldelade,
  totalBehövs,
  totalTilldelade,
  totalSaknas,
  bemanningsgrad,
  smsInbjudningar,
  emailInbjudningar,
  sektionsledare,
}: Props) {
  const [aktiv, setAktiv] = useState<'oversikt' | 'karta' | 'bjudin' | 'sl'>('oversikt')
  const [modal, setModal] = useState<ModalLäge>(null)

  // Lokal state för otilldelade + pass så att UI:t uppdateras direkt efter tilldelning
  const [lokalaOtilldelade, setLokalaOtilldelade] = useState(otilldelade)
  const [lokalaPasser, setLokalaPasser] = useState(passMedSektioner)

  function hanteraFramgång(profilId: string, passId: string) {
    // Ta bort funktionären från lokala listan
    setLokalaOtilldelade((prev) => prev.filter((f) => f.id !== profilId))
    // Öka "tilldelade" på aktuellt pass
    setLokalaPasser((prev) =>
      prev.map((p) =>
        p.pass_id === passId
          ? { ...p, tilldelade: p.tilldelade + 1, saknas: Math.max(0, p.saknas - 1) }
          : p
      )
    )
    setModal(null)
  }

  return (
    <div>
      {/* Flikar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 flex-wrap">
        <TabKnapp aktiv={aktiv === 'oversikt'} onClick={() => setAktiv('oversikt')} label="Översikt" />
        <TabKnapp aktiv={aktiv === 'karta'} onClick={() => setAktiv('karta')} label="Karta" />
        <TabKnapp aktiv={aktiv === 'sl'} onClick={() => setAktiv('sl')} label="Sektionsledare" />
        <TabKnapp aktiv={aktiv === 'bjudin'} onClick={() => setAktiv('bjudin')} label="Bjud in" />
      </div>

      {/* Översikt */}
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
              value={String(lokalaOtilldelade.length)}
              sub="funktionärer"
              farg={lokalaOtilldelade.length === 0 ? 'green' : 'amber'}
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
                <SektionKort
                  key={s.id}
                  sektion={s}
                  pass={lokalaPasser.filter((p) => p.sektion_id === s.id)}
                  onTilldelaPass={(passId) => setModal({ typ: 'fran-pass', passId })}
                />
              ))}
            </div>
          )}
        </section>

        {lokalaOtilldelade.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Funktionärer utan tilldelning ({lokalaOtilldelade.length})
            </h2>
            <div className="bg-white rounded-xl border border-amber-200 divide-y divide-gray-100">
              {lokalaOtilldelade.map((f) => (
                <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {f.full_name ?? '(inget namn)'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{f.email}</p>
                  </div>
                  <button
                    onClick={() => setModal({ typ: 'fran-funktionar', funktionar: f })}
                    className="flex-shrink-0 text-xs bg-[#0066CC] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Tilldela
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* Karta */}
      <div className={aktiv === 'karta' ? 'block' : 'hidden'}>
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Tävlingsområde – Stora Skuggan, Norra Djurgården
          </h2>
          <SektionKarta sektioner={sektioner} />
        </section>
      </div>

      {/* Sektionsledare */}
      <div className={aktiv === 'sl' ? 'block' : 'hidden'}>
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Sektionsledare ({sektionsledare.length})
          </h2>
          <SektionsledareFlik sektionsledare={sektionsledare} sektioner={sektioner} />
        </section>
      </div>

      {/* Bjud in */}
      <div className={aktiv === 'bjudin' ? 'block' : 'hidden'}>
        <BjudInFlik
          smsInbjudningar={smsInbjudningar}
          emailInbjudningar={emailInbjudningar}
        />
      </div>

      {/* Tilldelningsmodal */}
      {modal && (
        <TilldelningsModal
          valtFunktionar={modal.typ === 'fran-funktionar' ? modal.funktionar : undefined}
          valtPassId={modal.typ === 'fran-pass' ? modal.passId : undefined}
          allPass={lokalaPasser}
          otilldelade={lokalaOtilldelade}
          onClose={() => setModal(null)}
          onSuccess={hanteraFramgång}
        />
      )}
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
    blue:  'bg-blue-50 text-[#0066CC]',
    red:   'bg-red-50 text-red-700',
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

function SektionKort({
  sektion,
  pass,
  onTilldelaPass,
}: {
  sektion: SektionBemanningsgrad
  pass: PassMedSektion[]
  onTilldelaPass: (passId: string) => void
}) {
  const procent = sektion.behovs_totalt > 0
    ? Math.round((sektion.tilldelade_totalt / sektion.behovs_totalt) * 100)
    : 0

  const statusBadge =
    sektion.status === 'full'   ? 'bg-green-100 text-green-700'
    : sektion.status === 'delvis' ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'

  const statusText =
    sektion.status === 'full'   ? 'Fullbemannad'
    : sektion.status === 'delvis' ? 'Delvis'
    : 'Ej bemannad'

  const barColor =
    sektion.status === 'full'   ? '#16A34A'
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
        <div className="space-y-1 pt-2 border-t border-gray-100">
          {pass.map((p) => (
            <div key={p.pass_id} className="flex items-center justify-between text-xs group">
              <span className="text-gray-600">
                {p.pass_namn} <span className="text-gray-400">{p.starttid}–{p.sluttid}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${p.saknas <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {p.tilldelade}/{p.behovs_antal}
                </span>
                {p.saknas > 0 && (
                  <button
                    onClick={() => onTilldelaPass(p.pass_id)}
                    className="text-[10px] bg-blue-50 text-[#0066CC] border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-100 transition"
                  >
                    + Tilldela
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

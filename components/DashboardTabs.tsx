'use client'

import { useState, useMemo } from 'react'
import SektionKarta from '@/components/SektionKarta'
import BjudInFlik from '@/components/BjudInFlik'
import ExcelImportFlik from '@/components/ExcelImportFlik'
import TilldelningsModal from '@/components/TilldelningsModal'
import SektionsledareFlik from '@/components/SektionsledareFlik'
import FunktionarRedigeraModal from '@/components/FunktionarRedigeraModal'
import PassModal from '@/components/PassModal'
import type {
  SektionBemanningsgrad,
  PassBemanningsgrad,
  OtilldeladFunktionar,
  PassMedSektion,
  SektionsledareInfo,
  SektionOmrade,
  Profile,
} from '@/lib/database.types'

const OMRADE_CONFIG: Record<SektionOmrade, { label: string; emoji: string }> = {
  simning:   { label: 'Simning',    emoji: '🏊' },
  t1:        { label: 'T1',         emoji: '🔄' },
  cykling:   { label: 'Cykling',    emoji: '🚴' },
  lopning:   { label: 'Löpning',    emoji: '🏃' },
  arena_t2:  { label: 'Arena / T2', emoji: '🏁' },
  ovrigt:    { label: 'Övrigt',     emoji: '📋' },
}

const OMRADE_ORDNING: SektionOmrade[] = ['simning', 't1', 'cykling', 'lopning', 'arena_t2', 'ovrigt']

const KOMPETENS_LABELS: Record<string, string> = {
  sjukvard:             'Sjukvård/HLR',
  korkort:              'Körkort',
  triathlon_erfarenhet: 'Triathlon',
  simning:              'Simkunnig',
  cykel_teknik:         'Cykelmekanik',
  engelska:             'Engelska',
}

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
  allaFunktionärer: Profile[]
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
  | { typ: 'redigera'; funktionar: Profile }
  | { typ: 'pass-redigera'; pass: PassMedSektion; sektionNamn: string }
  | { typ: 'pass-nytt'; sektionId: string; sektionNamn: string }
  | null

export default function DashboardTabs({
  sektioner,
  pass,
  passMedSektioner,
  otilldelade,
  allaFunktionärer,
  totalBehövs,
  totalTilldelade,
  totalSaknas,
  bemanningsgrad,
  smsInbjudningar,
  emailInbjudningar,
  sektionsledare,
}: Props) {
  const [aktiv, setAktiv] = useState<'oversikt' | 'funktionarer' | 'karta' | 'bjudin' | 'sl' | 'import'>('oversikt')
  const [modal, setModal] = useState<ModalLäge>(null)

  // Lokal state för otilldelade + pass + alla funktionärer
  const [lokalaOtilldelade, setLokalaOtilldelade] = useState(otilldelade)
  const [lokalaPasser, setLokalaPasser] = useState(passMedSektioner)
  const [lokalaAlla, setLokalaAlla] = useState(allaFunktionärer)

  // Sök och filter
  const [sök, setSök] = useState('')
  const [aktivaKompetenser, setAktivaKompetenser] = useState<string[]>([])

  function toggleKompetensFilter(k: string) {
    setAktivaKompetenser(prev =>
      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
    )
  }

  const filtrerade = useMemo(() => {
    const q = sök.toLowerCase()
    return lokalaAlla.filter(f => {
      const matchText =
        !q ||
        (f.full_name ?? '').toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.klubb ?? '').toLowerCase().includes(q)
      const matchKomp =
        aktivaKompetenser.length === 0 ||
        aktivaKompetenser.every(k => (f.kompetenser ?? []).includes(k))
      return matchText && matchKomp
    })
  }, [lokalaAlla, sök, aktivaKompetenser])

  function hanteraFramgång(profilId: string, passId: string) {
    setLokalaOtilldelade((prev) => prev.filter((f) => f.id !== profilId))
    setLokalaPasser((prev) =>
      prev.map((p) =>
        p.pass_id === passId
          ? { ...p, tilldelade: p.tilldelade + 1, saknas: Math.max(0, p.saknas - 1) }
          : p
      )
    )
    setModal(null)
  }

  function hanteraSparat(uppdaterad: Profile) {
    setLokalaAlla(prev => prev.map(f => f.id === uppdaterad.id ? uppdaterad : f))
    setModal(null)
  }

  function hanteraBorttagen(profilId: string) {
    setLokalaAlla(prev => prev.filter(f => f.id !== profilId))
    setLokalaOtilldelade(prev => prev.filter(f => f.id !== profilId))
    setModal(null)
  }

  function hanteraPassSparat(uppdaterat: PassMedSektion, nyskapad: boolean) {
    if (nyskapad) {
      setLokalaPasser(prev => [...prev, uppdaterat])
    } else {
      setLokalaPasser(prev => prev.map(p => p.pass_id === uppdaterat.pass_id ? uppdaterat : p))
    }
    setModal(null)
  }

  function hanteraPassBorttagen(passId: string) {
    setLokalaPasser(prev => prev.filter(p => p.pass_id !== passId))
    setModal(null)
  }

  return (
    <div>
      {/* Flikar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 flex-wrap">
        <TabKnapp aktiv={aktiv === 'oversikt'} onClick={() => setAktiv('oversikt')} label="Översikt" />
        <TabKnapp aktiv={aktiv === 'funktionarer'} onClick={() => setAktiv('funktionarer')} label={`Funktionärer (${lokalaAlla.length})`} />
        <TabKnapp aktiv={aktiv === 'karta'} onClick={() => setAktiv('karta')} label="Karta" />
        <TabKnapp aktiv={aktiv === 'sl'} onClick={() => setAktiv('sl')} label="Sektionsledare" />
        <TabKnapp aktiv={aktiv === 'bjudin'} onClick={() => setAktiv('bjudin')} label="Bjud in" />
        <TabKnapp aktiv={aktiv === 'import'} onClick={() => setAktiv('import')} label="Importera" />
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
            <div className="space-y-6">
              {OMRADE_ORDNING.map((omrade) => {
                const grupp = sektioner.filter((s) => s.omrade === omrade)
                if (grupp.length === 0) return null
                const cfg = OMRADE_CONFIG[omrade]
                const gruppTilldelade = grupp.reduce((s, x) => s + (x.tilldelade_totalt ?? 0), 0)
                const gruppBehövs    = grupp.reduce((s, x) => s + (x.behovs_totalt ?? 0), 0)
                const gruppProcent   = gruppBehövs > 0 ? Math.round((gruppTilldelade / gruppBehövs) * 100) : 0
                return (
                  <div key={omrade}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">{cfg.emoji}</span>
                      <h3 className="text-sm font-semibold text-gray-700">{cfg.label}</h3>
                      <span className="text-xs text-gray-400 ml-auto">
                        {gruppTilldelade}/{gruppBehövs} ({gruppProcent}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {grupp.map((s) => (
                        <SektionKort
                          key={s.id}
                          sektion={s}
                          pass={lokalaPasser.filter((p) => p.sektion_id === s.id)}
                          onTilldelaPass={(passId) => setModal({ typ: 'fran-pass', passId })}
                          onRedigeraPass={(p) => setModal({ typ: 'pass-redigera', pass: p, sektionNamn: s.namn })}
                          onNyttPass={() => setModal({ typ: 'pass-nytt', sektionId: s.id, sektionNamn: s.namn })}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
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

      {/* Funktionärer */}
      <div className={aktiv === 'funktionarer' ? 'block space-y-4' : 'hidden'}>
        {/* Sök */}
        <div className="flex gap-2">
          <input
            type="search"
            value={sök}
            onChange={e => setSök(e.target.value)}
            placeholder="Sök namn, e-post eller klubb…"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
          />
        </div>

        {/* Kompetensfilter */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(KOMPETENS_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => toggleKompetensFilter(k)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                aktivaKompetenser.includes(k)
                  ? 'bg-[#0066CC] text-white border-[#0066CC]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
          {aktivaKompetenser.length > 0 && (
            <button
              onClick={() => setAktivaKompetenser([])}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
            >
              Rensa filter ×
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtrerade.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Inga funktionärer matchar sökningen.
            </p>
          ) : (
            filtrerade.map(f => (
              <div key={f.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {f.full_name ?? '(inget namn)'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{f.email}</p>
                  {f.klubb && (
                    <p className="text-xs text-gray-400 truncate">{f.klubb}</p>
                  )}
                  {(f.kompetenser ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(f.kompetenser ?? []).map(k => (
                        <span key={k} className="text-[10px] bg-blue-50 text-[#0066CC] px-1.5 py-0.5 rounded-full">
                          {KOMPETENS_LABELS[k] ?? k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setModal({ typ: 'redigera', funktionar: f })}
                  className="flex-shrink-0 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  Redigera
                </button>
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-gray-400 text-right">{filtrerade.length} av {lokalaAlla.length} funktionärer</p>
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

      {/* Importera */}
      <div className={aktiv === 'import' ? 'block' : 'hidden'}>
        <ExcelImportFlik />
      </div>

      {/* Tilldelningsmodal */}
      {modal && (modal.typ === 'fran-funktionar' || modal.typ === 'fran-pass') && (
        <TilldelningsModal
          valtFunktionar={modal.typ === 'fran-funktionar' ? modal.funktionar : undefined}
          valtPassId={modal.typ === 'fran-pass' ? modal.passId : undefined}
          allPass={lokalaPasser}
          otilldelade={lokalaOtilldelade}
          onClose={() => setModal(null)}
          onSuccess={hanteraFramgång}
        />
      )}

      {/* Redigera funktionär-modal */}
      {modal?.typ === 'redigera' && (
        <FunktionarRedigeraModal
          funktionar={modal.funktionar}
          onClose={() => setModal(null)}
          onSparat={hanteraSparat}
          onBorttagen={hanteraBorttagen}
        />
      )}

      {/* Pass-modal (redigera) */}
      {modal?.typ === 'pass-redigera' && (
        <PassModal
          sektionId={modal.pass.sektion_id}
          sektionNamn={modal.sektionNamn}
          pass={modal.pass}
          onClose={() => setModal(null)}
          onSparat={hanteraPassSparat}
          onBorttagen={hanteraPassBorttagen}
        />
      )}

      {/* Pass-modal (nytt) */}
      {modal?.typ === 'pass-nytt' && (
        <PassModal
          sektionId={modal.sektionId}
          sektionNamn={modal.sektionNamn}
          onClose={() => setModal(null)}
          onSparat={hanteraPassSparat}
          onBorttagen={hanteraPassBorttagen}
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
  onRedigeraPass,
  onNyttPass,
}: {
  sektion: SektionBemanningsgrad
  pass: PassMedSektion[]
  onTilldelaPass: (passId: string) => void
  onRedigeraPass: (pass: PassMedSektion) => void
  onNyttPass: () => void
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

      <div className="pt-2 border-t border-gray-100 space-y-1">
        {pass.map((p) => (
          <div key={p.pass_id} className="flex items-center justify-between text-xs group">
            <button
              onClick={() => onRedigeraPass(p)}
              className="text-left text-gray-600 hover:text-[#0066CC] transition-colors truncate"
            >
              {p.pass_namn} <span className="text-gray-400">{p.starttid}–{p.sluttid}</span>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
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
        <button
          onClick={onNyttPass}
          className="w-full text-[10px] text-gray-400 hover:text-[#0066CC] hover:bg-blue-50 border border-dashed border-gray-200 hover:border-blue-200 rounded-lg py-1.5 transition-colors mt-1"
        >
          + Nytt pass
        </button>
      </div>
    </div>
  )
}

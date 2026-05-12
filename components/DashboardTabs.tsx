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
  TilldeladPerPass,
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
  sjukvard:             'Sjukvård',
  korkort:              'Körkort',
  triathlon_erfarenhet: 'Triathlon',
  simning:              'Simkunnig',
  cykel_teknik:         'Cykelmekanik',
  engelska:             'Engelska',
}

type AdminFlik = 'funktionarer' | 'karta' | 'bjudin' | 'sl' | 'import'

interface SMSRad {
  id: string; telefon: string; skickad_at: string
  email_inkommen: string | null; status: string
}
interface EmailRad {
  id: string; email: string; skickad_at: string; status: string
}

interface Props {
  sektioner: SektionBemanningsgrad[]
  pass: PassBemanningsgrad[]
  passMedSektioner: PassMedSektion[]
  tilldeladePerPass: TilldeladPerPass[]
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
  pass: _pass,
  passMedSektioner,
  tilldeladePerPass,
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
  // Aktiv flik: område eller admin-flik
  const förstaOmrade = OMRADE_ORDNING.find(o => sektioner.some(s => s.omrade === o)) ?? 'simning'
  const [aktivOmrade, setAktivOmrade] = useState<SektionOmrade>(förstaOmrade)
  const [aktivAdmin, setAktivAdmin] = useState<AdminFlik | null>(null)
  const [modal, setModal] = useState<ModalLäge>(null)

  const [lokalaOtilldelade, setLokalaOtilldelade] = useState(otilldelade)
  const [lokalaPasser, setLokalaPasser]           = useState(passMedSektioner)
  const [lokalaTilldelade, setLokalaTilldelade]   = useState(tilldeladePerPass)
  const [lokalaAlla, setLokalaAlla]               = useState(allaFunktionärer)

  // Sök och filter (funktionärsflik)
  const [sök, setSök]                             = useState('')
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
    setLokalaOtilldelade(prev => prev.filter(f => f.id !== profilId))
    setLokalaPasser(prev =>
      prev.map(p =>
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
    setLokalaTilldelade(prev => prev.filter(t => t.pass_id !== passId))
    setModal(null)
  }

  const sektionerIOmrade = sektioner.filter(s => s.omrade === aktivOmrade)

  return (
    <div className="space-y-0">

      {/* ── Summering ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatKort
          label="Bemanningsgrad"
          value={`${bemanningsgrad}%`}
          sub={`${totalTilldelade} av ${totalBehövs}`}
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

      {/* ── Områdesflikar ─────────────────────────────────────── */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto scrollbar-hide -mb-px">
          {OMRADE_ORDNING.map(omrade => {
            const grupp = sektioner.filter(s => s.omrade === omrade)
            if (grupp.length === 0) return null
            const cfg = OMRADE_CONFIG[omrade]
            const tilldelade = grupp.reduce((s, x) => s + x.tilldelade_totalt, 0)
            const behövs     = grupp.reduce((s, x) => s + x.behovs_totalt, 0)
            const procent    = behövs > 0 ? Math.round((tilldelade / behövs) * 100) : 0
            const allaFulla  = grupp.every(s => s.status === 'full')
            const någraFulla = grupp.some(s => s.status === 'full' || s.status === 'delvis')
            const isAktiv    = aktivOmrade === omrade && aktivAdmin === null
            return (
              <button
                key={omrade}
                onClick={() => { setAktivOmrade(omrade); setAktivAdmin(null) }}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isAktiv
                    ? 'border-[#0066CC] text-[#0066CC]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{cfg.emoji}</span>
                <span>{cfg.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  allaFulla   ? 'bg-green-100 text-green-700'
                  : någraFulla ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
                }`}>
                  {procent}%
                </span>
              </button>
            )
          })}

          {/* Separator */}
          <div className="flex-shrink-0 w-px bg-gray-200 my-2 mx-1" />

          {/* Admin-flikar */}
          {([
            ['funktionarer', `Funktionärer (${lokalaAlla.length})`],
            ['karta', 'Karta'],
            ['sl', 'Sektionsledare'],
            ['bjudin', 'Bjud in'],
            ['import', 'Importera'],
          ] as [AdminFlik, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setAktivAdmin(id)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                aktivAdmin === id
                  ? 'border-[#0066CC] text-[#0066CC]'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Områdesinnehåll ────────────────────────────────────── */}
      {aktivAdmin === null && (
        <div className="pt-5 space-y-8">
          {sektionerIOmrade.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Inga sektioner i det här området.</p>
          ) : (
            sektionerIOmrade.map(sektion => (
              <SektionsFlik
                key={sektion.id}
                sektion={sektion}
                passer={lokalaPasser.filter(p => p.sektion_id === sektion.id)}
                tilldelade={lokalaTilldelade.filter(t => t.sektion_id === sektion.id)}
                otilldelade={lokalaOtilldelade}
                onTilldelaPass={passId => setModal({ typ: 'fran-pass', passId })}
                onRedigeraPass={p => setModal({ typ: 'pass-redigera', pass: p, sektionNamn: sektion.namn })}
                onNyttPass={() => setModal({ typ: 'pass-nytt', sektionId: sektion.id, sektionNamn: sektion.namn })}
                onTilldelaFunktionar={f => setModal({ typ: 'fran-funktionar', funktionar: f })}
              />
            ))
          )}
        </div>
      )}

      {/* ── Admin-flikar ───────────────────────────────────────── */}
      {aktivAdmin === 'funktionarer' && (
        <div className="pt-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="search"
              value={sök}
              onChange={e => setSök(e.target.value)}
              placeholder="Sök namn, e-post eller klubb…"
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>
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
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-400 hover:text-gray-600"
              >
                Rensa ×
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {filtrerade.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Inga funktionärer matchar sökningen.</p>
            ) : (
              filtrerade.map(f => (
                <div key={f.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.full_name ?? '(inget namn)'}</p>
                    <p className="text-xs text-gray-500 truncate">{f.email}</p>
                    {f.klubb && <p className="text-xs text-gray-400 truncate">{f.klubb}</p>}
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
      )}

      {aktivAdmin === 'karta' && (
        <div className="pt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Tävlingsområde – Stora Skuggan, Norra Djurgården
          </h2>
          <SektionKarta sektioner={sektioner} />
        </div>
      )}

      {aktivAdmin === 'sl' && (
        <div className="pt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Sektionsledare ({sektionsledare.length})
          </h2>
          <SektionsledareFlik sektionsledare={sektionsledare} sektioner={sektioner} />
        </div>
      )}

      {aktivAdmin === 'bjudin' && (
        <div className="pt-6">
          <BjudInFlik smsInbjudningar={smsInbjudningar} emailInbjudningar={emailInbjudningar} />
        </div>
      )}

      {aktivAdmin === 'import' && (
        <div className="pt-6">
          <ExcelImportFlik />
        </div>
      )}

      {/* ── Otilldelade (visas alltid under sektionsvyn) ────────── */}
      {aktivAdmin === null && lokalaOtilldelade.length > 0 && (
        <div className="pt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Funktionärer utan tilldelning ({lokalaOtilldelade.length})
          </h2>
          <div className="bg-white rounded-xl border border-amber-200 divide-y divide-gray-100">
            {lokalaOtilldelade.map(f => (
              <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{f.full_name ?? '(inget namn)'}</p>
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
        </div>
      )}

      {/* ── Modaler ────────────────────────────────────────────── */}
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

      {modal?.typ === 'redigera' && (
        <FunktionarRedigeraModal
          funktionar={modal.funktionar}
          onClose={() => setModal(null)}
          onSparat={hanteraSparat}
          onBorttagen={hanteraBorttagen}
        />
      )}

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

// ── SektionsFlik ─────────────────────────────────────────────

function SektionsFlik({
  sektion,
  passer,
  tilldelade,
  otilldelade,
  onTilldelaPass,
  onRedigeraPass,
  onNyttPass,
  onTilldelaFunktionar,
}: {
  sektion: SektionBemanningsgrad
  passer: PassMedSektion[]
  tilldelade: TilldeladPerPass[]
  otilldelade: OtilldeladFunktionar[]
  onTilldelaPass: (passId: string) => void
  onRedigeraPass: (pass: PassMedSektion) => void
  onNyttPass: () => void
  onTilldelaFunktionar: (f: OtilldeladFunktionar) => void
}) {
  void otilldelade
  void onTilldelaFunktionar

  const procent = sektion.behovs_totalt > 0
    ? Math.round((sektion.tilldelade_totalt / sektion.behovs_totalt) * 100)
    : 0

  const barColor =
    sektion.status === 'full'   ? '#16A34A'
    : sektion.status === 'delvis' ? '#F59E0B'
    : '#DC2626'

  const omradeCfg = OMRADE_CONFIG[sektion.omrade]

  const sortedePasser = [...passer].sort((a, b) => a.starttid.localeCompare(b.starttid))

  return (
    <div className="pt-5 space-y-5">
      {/* Sektionshuvud */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: sektion.farg }} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">{sektion.namn}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {omradeCfg.emoji} {omradeCfg.label}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold" style={{ color: barColor }}>{procent}%</p>
            <p className="text-xs text-gray-400">{sektion.tilldelade_totalt} / {sektion.behovs_totalt} platser</p>
          </div>
        </div>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(procent, 100)}%`, backgroundColor: barColor }}
          />
        </div>

        {sektion.beskrivning && (
          <p className="text-sm text-gray-500 mt-3">{sektion.beskrivning}</p>
        )}
      </div>

      {/* Pass-lista */}
      <div className="space-y-3">
        {sortedePasser.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
            Inga pass ännu för den här sektionen.
          </div>
        ) : (
          sortedePasser.map(pass => {
            const passDeltagare = tilldelade.filter(t => t.pass_id === pass.pass_id)
            const saknas = Math.max(0, pass.behovs_antal - passDeltagare.length)
            return (
              <PassKort
                key={pass.pass_id}
                pass={pass}
                tilldelade={passDeltagare}
                saknas={saknas}
                onTilldela={() => onTilldelaPass(pass.pass_id)}
                onRedigera={() => onRedigeraPass(pass)}
              />
            )
          })
        )}

        <button
          onClick={onNyttPass}
          className="w-full text-sm text-gray-400 hover:text-[#0066CC] hover:bg-blue-50 border border-dashed border-gray-200 hover:border-blue-200 rounded-xl py-3 transition-colors flex items-center justify-center gap-1"
        >
          <span className="text-base leading-none">+</span> Nytt pass
        </button>
      </div>
    </div>
  )
}

// ── PassKort ─────────────────────────────────────────────────

function PassKort({
  pass,
  tilldelade,
  saknas,
  onTilldela,
  onRedigera,
}: {
  pass: PassMedSektion
  tilldelade: TilldeladPerPass[]
  saknas: number
  onTilldela: () => void
  onRedigera: () => void
}) {
  const [expanderad, setExpanderad] = useState(true)

  const statusColor =
    saknas === 0 ? 'text-green-600'
    : saknas <= 2 ? 'text-amber-600'
    : 'text-red-500'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Pass-rubrik */}
      <div className="px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setExpanderad(e => !e)}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          <span className={`text-xs transition-transform ${expanderad ? 'rotate-90' : ''}`}>▶</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{pass.pass_namn}</p>
            <p className="text-xs text-gray-400">{pass.starttid} – {pass.sluttid}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-sm font-bold ${statusColor}`}>
            {tilldelade.length}/{pass.behovs_antal}
          </span>
          {saknas > 0 && (
            <button
              onClick={onTilldela}
              className="text-xs bg-[#0066CC] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              + Tilldela
            </button>
          )}
          <button
            onClick={onRedigera}
            className="text-gray-400 hover:text-gray-600 transition p-1"
            title="Redigera pass"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Expanderat — lista med tilldelade */}
      {expanderad && (
        <div className="border-t border-gray-100">
          {tilldelade.length === 0 ? (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-gray-400">Inga funktionärer tilldelade ännu.</p>
              {saknas > 0 && (
                <button
                  onClick={onTilldela}
                  className="mt-2 text-xs text-[#0066CC] hover:underline"
                >
                  Tilldela {saknas} platse{saknas === 1 ? 'r' : 'r'} →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tilldelade.map(t => (
                <div key={t.tilldelning_id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-bold text-[#0066CC]">
                      {(t.full_name ?? t.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {t.full_name ?? t.email}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {t.telefon && (
                        <a href={`tel:${t.telefon}`} className="text-xs text-gray-400 hover:text-[#0066CC] transition-colors">
                          {t.telefon}
                        </a>
                      )}
                      {(t.kompetenser ?? []).length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {(t.kompetenser ?? []).map(k => (
                            <span key={k} className="text-[10px] bg-blue-50 text-[#0066CC] px-1.5 py-0.5 rounded-full">
                              {KOMPETENS_LABELS[k] ?? k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {t.notering && (
                      <p className="text-[11px] text-gray-400 mt-0.5 italic">{t.notering}</p>
                    )}
                  </div>
                </div>
              ))}
              {saknas > 0 && (
                <div className="px-4 py-2 bg-gray-50">
                  <button
                    onClick={onTilldela}
                    className="text-xs text-[#0066CC] hover:underline"
                  >
                    + Tilldela {saknas} till{saknas === 1 ? ' plats' : ' platser'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Hjälpkomponenter ─────────────────────────────────────────

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

'use client'

import { useState, useTransition } from 'react'
import { toggleMatUtdelad } from '@/app/dashboard/sektionsledare-actions'
import type { MinSektionRad } from '@/lib/database.types'

interface Props {
  rader: MinSektionRad[]
  slNamn: string
}

interface PassData {
  pass_id: string
  pass_namn: string
  datum: string
  starttid: string
  sluttid: string
  behovs_antal: number
  funktionarer: FunktionarRad[]
}

function formateraDatum(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
}

interface FunktionarRad {
  tilldelning_id: string
  profil_id: string
  full_name: string | null
  email: string
  telefon: string | null
  kompetenser: string[] | null
  notering: string | null
  mat_utdelad: boolean
}

const KOMPETENS_LABELS: Record<string, string> = {
  sjukvard:             'Sjukvård/HLR',
  korkort:              'Körkort',
  triathlon_erfarenhet: 'Triathlonerfarenhet',
  simning:              'Simkunnig',
  cykel_teknik:         'Cykelmekanik',
  engelska:             'Engelska',
}

function byggPassData(rader: MinSektionRad[]): PassData[] {
  const passMap = new Map<string, PassData>()
  for (const rad of rader) {
    if (!passMap.has(rad.pass_id)) {
      passMap.set(rad.pass_id, {
        pass_id:      rad.pass_id,
        pass_namn:    rad.pass_namn,
        datum:        rad.datum,
        starttid:     rad.starttid,
        sluttid:      rad.sluttid,
        behovs_antal: rad.behovs_antal,
        funktionarer: [],
      })
    }
    if (rad.tilldelning_id && rad.profil_id && rad.email) {
      passMap.get(rad.pass_id)!.funktionarer.push({
        tilldelning_id: rad.tilldelning_id,
        profil_id:      rad.profil_id,
        full_name:      rad.full_name,
        email:          rad.email,
        telefon:        rad.telefon,
        kompetenser:    rad.kompetenser,
        notering:       rad.notering,
        mat_utdelad:    rad.mat_utdelad ?? false,
      })
    }
  }
  return Array.from(passMap.values())
}

export default function SektionsledareApp({ rader, slNamn }: Props) {
  const sektionNamn = rader[0]?.sektion_namn ?? 'Min sektion'
  const sektionFarg = rader[0]?.sektion_farg ?? '#0066CC'

  const [pass, setPass] = useState<PassData[]>(() => byggPassData(rader))
  const [aktivPass, setAktivPass] = useState<string>(pass[0]?.pass_id ?? '')
  const [aktiv, setAktiv] = useState<'funktionarer' | 'mat'>('funktionarer')
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const aktivtPass = pass.find((p) => p.pass_id === aktivPass) ?? pass[0]

  // Alla unika e-poster för "Maila alla"
  const allaEmails = pass
    .flatMap((p) => p.funktionarer.map((f) => f.email))
    .filter((e, i, arr) => arr.indexOf(e) === i)

  const mailtoHref = allaEmails.length > 0
    ? `mailto:${allaEmails.join(',')}?subject=STHLM Triathlon 2026 – ${sektionNamn}`
    : undefined

  function hanteraMatToggle(tilldelningId: string, nuläge: boolean) {
    setPendingId(tilldelningId)
    startTransition(async () => {
      const res = await toggleMatUtdelad(tilldelningId, !nuläge)
      if (res.ok) {
        setPass((prev) =>
          prev.map((p) => ({
            ...p,
            funktionarer: p.funktionarer.map((f) =>
              f.tilldelning_id === tilldelningId
                ? { ...f, mat_utdelad: !nuläge }
                : f
            ),
          }))
        )
      }
      setPendingId(null)
    })
  }

  if (rader.length === 0 || !rader[0]?.sektion_id) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center px-4">
        <div className="text-5xl mb-4">🔧</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Ingen sektion konfigurerad</h2>
        <p className="text-sm text-gray-500">
          Din profil är inte kopplad till en sektion ännu.
          Kontakta tävlingsledningen så att de kopplar dig till rätt sektion.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Sektionsrubrik */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: sektionFarg }} />
          <div>
            <h2 className="text-xl font-bold text-gray-900">{sektionNamn}</h2>
            <p className="text-sm text-gray-500">Hej {slNamn}!</p>
          </div>
        </div>
        {mailtoHref && (
          <a
            href={mailtoHref}
            className="inline-flex items-center gap-2 text-sm bg-[#0066CC] text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            ✉ Maila alla ({allaEmails.length})
          </a>
        )}
      </div>

      {/* Pass-väljare */}
      {pass.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {pass.map((p) => (
            <button
              key={p.pass_id}
              onClick={() => setAktivPass(p.pass_id)}
              className={`px-4 py-2 text-sm rounded-full border transition ${
                aktivPass === p.pass_id
                  ? 'bg-[#0066CC] text-white border-[#0066CC]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {p.pass_namn}
              <span className="ml-1.5 text-xs opacity-70">{formateraDatum(p.datum)} · {p.starttid}–{p.sluttid}</span>
            </button>
          ))}
        </div>
      )}

      {aktivtPass && (
        <>
          {/* Pass-summering */}
          <div className="grid grid-cols-3 gap-3">
            <StatMini
              label="Tilldelade"
              value={`${aktivtPass.funktionarer.length}/${aktivtPass.behovs_antal}`}
              farg={aktivtPass.funktionarer.length >= aktivtPass.behovs_antal ? 'green' : 'amber'}
            />
            <StatMini
              label="Mat utdelad"
              value={`${aktivtPass.funktionarer.filter((f) => f.mat_utdelad).length}/${aktivtPass.funktionarer.length}`}
              farg={
                aktivtPass.funktionarer.length > 0 &&
                aktivtPass.funktionarer.every((f) => f.mat_utdelad)
                  ? 'green' : 'amber'
              }
            />
            <StatMini
              label="Tid"
              value={aktivtPass.starttid}
              sub={`–${aktivtPass.sluttid}`}
              farg="blue"
            />
          </div>

          {/* Flikar */}
          <div className="flex gap-1 border-b border-gray-200">
            <TabKnapp aktiv={aktiv === 'funktionarer'} onClick={() => setAktiv('funktionarer')} label="Funktionärer" />
            <TabKnapp aktiv={aktiv === 'mat'} onClick={() => setAktiv('mat')} label="Mat & dryck" />
          </div>

          {/* Funktionärslista */}
          {aktiv === 'funktionarer' && (
            <div className="space-y-3">
              {aktivtPass.funktionarer.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
                  Inga funktionärer tilldelade ännu.
                </div>
              ) : (
                aktivtPass.funktionarer.map((f) => (
                  <FunktionarKort key={f.tilldelning_id} funktionar={f} />
                ))
              )}
            </div>
          )}

          {/* Mat & dryck */}
          {aktiv === 'mat' && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {aktivtPass.funktionarer.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">Inga funktionärer att bocka av.</p>
              ) : (
                aktivtPass.funktionarer.map((f) => (
                  <div key={f.tilldelning_id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {f.full_name ?? f.email}
                      </p>
                      {f.telefon && (
                        <p className="text-xs text-gray-400">{f.telefon}</p>
                      )}
                    </div>
                    <button
                      onClick={() => hanteraMatToggle(f.tilldelning_id, f.mat_utdelad)}
                      disabled={pending && pendingId === f.tilldelning_id}
                      className={`flex-shrink-0 w-11 h-11 rounded-full border-2 flex items-center justify-center transition text-base ${
                        f.mat_utdelad
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-white border-gray-300 text-gray-300 hover:border-green-400'
                      } disabled:opacity-50`}
                      aria-label={f.mat_utdelad ? 'Markera som ej utdelad' : 'Markera som utdelad'}
                    >
                      {f.mat_utdelad ? '✓' : ''}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Hjälpkomponenter ─────────────────────────────────────────

function FunktionarKort({ funktionar: f }: { funktionar: FunktionarRad }) {
  const [expanderad, setExpanderad] = useState(false)
  const kompetenser = f.kompetenser ?? []

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition"
        onClick={() => setExpanderad((v) => !v)}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {f.full_name ?? f.email}
          </p>
          <p className="text-xs text-gray-400 truncate">{f.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {f.mat_utdelad && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Mat ✓</span>
          )}
          <span className="text-gray-400 text-xs">{expanderad ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanderad && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          {f.telefon && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20">Telefon</span>
              <a href={`tel:${f.telefon}`} className="text-sm text-[#0066CC] hover:underline">
                {f.telefon}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">E-post</span>
            <a href={`mailto:${f.email}`} className="text-sm text-[#0066CC] hover:underline truncate">
              {f.email}
            </a>
          </div>
          {kompetenser.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 w-20 pt-0.5">Kompetenser</span>
              <div className="flex flex-wrap gap-1">
                {kompetenser.map((k) => (
                  <span key={k} className="text-xs bg-blue-50 text-[#0066CC] border border-blue-100 px-2 py-0.5 rounded-full">
                    {KOMPETENS_LABELS[k] ?? k}
                  </span>
                ))}
              </div>
            </div>
          )}
          {f.notering && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 w-20 pt-0.5">Notering</span>
              <p className="text-xs text-gray-700 leading-relaxed">{f.notering}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatMini({
  label, value, sub, farg,
}: {
  label: string; value: string; sub?: string; farg: 'green' | 'blue' | 'amber'
}) {
  const colors = {
    green: 'bg-green-50 text-green-700',
    blue:  'bg-blue-50 text-[#0066CC]',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className={`rounded-xl p-3 text-center ${colors[farg]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  )
}

function TabKnapp({ aktiv, onClick, label }: { aktiv: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 min-h-[44px] text-sm font-medium border-b-2 transition-colors ${
        aktiv
          ? 'border-[#0066CC] text-[#0066CC]'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

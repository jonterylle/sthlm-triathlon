'use client'

import { useState, useMemo } from 'react'
import BjudInFlik from '@/components/BjudInFlik'
import ExcelImportFlik from '@/components/ExcelImportFlik'
import FunktionarRedigeraModal from '@/components/FunktionarRedigeraModal'
import type { Profile, SektionBemanningsgrad, SektionsledareInfo } from '@/lib/database.types'

const ROLL_LABELS: Record<string, string> = {
  tl:             'Tävlingsledare',
  sektionsledare: 'Sektionsledare',
  funktionar:     'Funktionär',
}

const KOMPETENS_LABELS: Record<string, string> = {
  sjukvard:             'Sjukvård',
  korkort:              'Körkort',
  triathlon_erfarenhet: 'Triathlon',
  simning:              'Simkunnig',
  cykel_teknik:         'Cykelmekanik',
  engelska:             'Engelska',
}

interface SMSRad { id: string; telefon: string; skickad_at: string; email_inkommen: string | null; status: string }
interface EmailRad { id: string; email: string; skickad_at: string; status: string }

interface Props {
  funktionärer: Profile[]
  sektioner: SektionBemanningsgrad[]
  sektionsledare: SektionsledareInfo[]
  emailInbjudningar: EmailRad[]
  smsInbjudningar: SMSRad[]
  isTL: boolean
}

type Vy = 'lista' | 'organisation'
type Flik = 'vy' | 'bjudin' | 'import'

export default function FunktionarerSida({
  funktionärer,
  sektioner,
  sektionsledare,
  emailInbjudningar,
  smsInbjudningar,
  isTL,
}: Props) {
  const [aktivFlik, setAktivFlik] = useState<Flik>('vy')
  const [vy, setVy]               = useState<Vy>('lista')
  const [modal, setModal]         = useState<Profile | null>(null)
  const [lokala, setLokala]       = useState(funktionärer)

  // Filter
  const [sök, setSök]           = useState('')
  const [filterRoll, setFilterRoll]     = useState('')
  const [filterSektion, setFilterSektion] = useState('')

  const sektionMap = useMemo(() =>
    new Map(sektioner.map(s => [s.id, s])),
  [sektioner])

  // Bygg sektion per profil via sektionsledare-data
  const slSektionMap = useMemo(() => {
    const m = new Map<string, string>() // profil_id → sektion_namn
    sektionsledare.forEach(sl => {
      if (sl.sektion_namn) m.set(sl.id, sl.sektion_namn)
    })
    return m
  }, [sektionsledare])

  const filtrerade = useMemo(() => {
    const q = sök.toLowerCase()
    return lokala.filter(f => {
      if (filterRoll && f.role !== filterRoll) return false
      if (filterSektion) {
        const sektNamn = slSektionMap.get(f.id) ?? f.sektion_preferens ?? ''
        if (!sektNamn.toLowerCase().includes(filterSektion.toLowerCase())) return false
      }
      if (q) {
        return (
          (f.full_name ?? '').toLowerCase().includes(q) ||
          f.email.toLowerCase().includes(q) ||
          (f.klubb ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [lokala, sök, filterRoll, filterSektion, slSektionMap])

  function hanteraSparat(uppdaterad: Profile) {
    setLokala(prev => prev.map(f => f.id === uppdaterad.id ? uppdaterad : f))
    setModal(null)
  }

  function hanteraBorttagen(id: string) {
    setLokala(prev => prev.filter(f => f.id !== id))
    setModal(null)
  }

  // Gruppering för organisationsvy
  const tl   = lokala.filter(f => f.role === 'tl')
  const sl   = lokala.filter(f => f.role === 'sektionsledare')
  const funk = lokala.filter(f => f.role === 'funktionar')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Funktionärer</h1>
        <span className="text-sm text-gray-400">{lokala.length} totalt</span>
      </div>

      {/* Flikar */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 -mb-px">
          {([
            ['vy',     'Lista & Organisation'],
            ['bjudin', 'Bjud in'],
            ['import', 'Importera Excel'],
          ] as [Flik, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setAktivFlik(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                aktivFlik === id
                  ? 'border-[#0066CC] text-[#0066CC]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bjud in */}
      {aktivFlik === 'bjudin' && (
        <BjudInFlik emailInbjudningar={emailInbjudningar} smsInbjudningar={smsInbjudningar} />
      )}

      {/* Importera */}
      {aktivFlik === 'import' && <ExcelImportFlik />}

      {/* Lista/Organisation */}
      {aktivFlik === 'vy' && (
        <div className="space-y-4">
          {/* Vy-växlare */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setVy('lista')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  vy === 'lista' ? 'bg-[#0066CC] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                ☰ Lista
              </button>
              <button
                onClick={() => setVy('organisation')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                  vy === 'organisation' ? 'bg-[#0066CC] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                🏗 Organisation
              </button>
            </div>
          </div>

          {/* ── Listvy ── */}
          {vy === 'lista' && (
            <div className="space-y-3">
              {/* Filter */}
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={sök}
                  onChange={e => setSök(e.target.value)}
                  placeholder="Sök namn, e-post, klubb…"
                  className="flex-1 min-w-[200px] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
                {isTL && (
                  <select
                    value={filterRoll}
                    onChange={e => setFilterRoll(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  >
                    <option value="">Alla roller</option>
                    <option value="tl">Tävlingsledare</option>
                    <option value="sektionsledare">Sektionsledare</option>
                    <option value="funktionar">Funktionär</option>
                  </select>
                )}
                <select
                  value={filterSektion}
                  onChange={e => setFilterSektion(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                >
                  <option value="">Alla sektioner</option>
                  {sektioner.map(s => (
                    <option key={s.id} value={s.namn}>{s.namn}</option>
                  ))}
                </select>
              </div>

              {/* Tabell */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-left">
                        <th className="px-4 py-3 font-medium text-gray-500">Namn</th>
                        <th className="px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">E-post</th>
                        {isTL && <th className="px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Roll</th>}
                        <th className="px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Sektion</th>
                        <th className="px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Kompetenser</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtrerade.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                            Inga funktionärer matchar sökningen.
                          </td>
                        </tr>
                      ) : filtrerade.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setModal(f)}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{f.full_name ?? '(inget namn)'}</p>
                            {f.klubb && <p className="text-xs text-gray-400">{f.klubb}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{f.email}</td>
                          {isTL && (
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                f.role === 'tl'             ? 'bg-purple-100 text-purple-700'
                                : f.role === 'sektionsledare' ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                              }`}>
                                {ROLL_LABELS[f.role]}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                            {slSektionMap.get(f.id) ?? f.sektion_preferens ?? '—'}
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {(f.kompetenser ?? []).map(k => (
                                <span key={k} className="text-[10px] bg-blue-50 text-[#0066CC] px-1.5 py-0.5 rounded-full">
                                  {KOMPETENS_LABELS[k] ?? k}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs text-gray-400 hover:text-[#0066CC]">Redigera →</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-right">{filtrerade.length} av {lokala.length}</p>
            </div>
          )}

          {/* ── Organisationsvy ── */}
          {vy === 'organisation' && (
            <div className="space-y-6">
              {/* TL */}
              {tl.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Tävlingsledare ({tl.length})
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {tl.map(f => <PersonKort key={f.id} person={f} badge="bg-purple-100 text-purple-700" badgeLabel="TL" onClick={() => setModal(f)} />)}
                  </div>
                </div>
              )}

              {/* SL grupperade per sektion */}
              {sl.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Sektionsledare ({sl.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sektioner.map(s => {
                      const slFörSektion = sl.filter(f => slSektionMap.get(f.id) === s.namn)
                      const funktFörSektion = funk.filter(f => (f.sektion_preferens ?? '') === s.namn)
                      if (slFörSektion.length === 0 && funktFörSektion.length === 0) return null
                      return (
                        <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.farg }} />
                            <h3 className="text-sm font-semibold text-gray-700">{s.namn}</h3>
                          </div>
                          {slFörSektion.map(f => (
                            <PersonKort key={f.id} person={f} badge="bg-blue-100 text-blue-700" badgeLabel="SL" onClick={() => setModal(f)} compact />
                          ))}
                          {slFörSektion.length === 0 && (
                            <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">Ingen SL tilldelad</p>
                          )}
                          {funktFörSektion.length > 0 && (
                            <div className="pt-2 border-t border-gray-100 space-y-1">
                              {funktFörSektion.map(f => (
                                <PersonKort key={f.id} person={f} badge="bg-gray-100 text-gray-600" badgeLabel="F" onClick={() => setModal(f)} compact />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Funktionärer utan sektion */}
              {(() => {
                const utanSektion = funk.filter(f => !f.sektion_preferens)
                if (utanSektion.length === 0) return null
                return (
                  <div>
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Utan sektion ({utanSektion.length})
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {utanSektion.map(f => <PersonKort key={f.id} person={f} badge="bg-gray-100 text-gray-600" badgeLabel="F" onClick={() => setModal(f)} />)}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <FunktionarRedigeraModal
          funktionar={modal}
          onClose={() => setModal(null)}
          onSparat={hanteraSparat}
          onBorttagen={hanteraBorttagen}
        />
      )}
    </div>
  )
}

// ── PersonKort ────────────────────────────────────────────────

function PersonKort({
  person, badge, badgeLabel, onClick, compact = false,
}: {
  person: Profile
  badge: string
  badgeLabel: string
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 bg-white border border-gray-200 rounded-xl hover:border-[#0066CC] hover:shadow-sm transition-all text-left ${
        compact ? 'w-full px-3 py-2' : 'px-4 py-3'
      }`}
    >
      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-[#0066CC]">
          {(person.full_name ?? person.email).charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{person.full_name ?? '(inget namn)'}</p>
        {!compact && <p className="text-xs text-gray-400 truncate">{person.email}</p>}
      </div>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge}`}>{badgeLabel}</span>
    </button>
  )
}

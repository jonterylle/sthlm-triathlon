'use client'

import { useState, useMemo } from 'react'
import TilldelningsModal from '@/components/TilldelningsModal'
import type { PassMedSektion, TilldeladPerPass, OtilldeladFunktionar } from '@/lib/database.types'

const OMRADE_LABELS: Record<string, string> = {
  simning:  '🏊 Simning',
  t1:       '🔄 T1',
  cykling:  '🚴 Cykling',
  lopning:  '🏃 Löpning',
  arena_t2: '🏁 Arena / T2',
  ovrigt:   '📋 Övrigt',
}

const KOMPETENS_LABELS: Record<string, string> = {
  sjukvard: 'Sjukvård', korkort: 'Körkort',
  triathlon_erfarenhet: 'Triathlon', simning: 'Simkunnig',
  cykel_teknik: 'Cykelmekanik', engelska: 'Engelska',
}

interface Props {
  passer: PassMedSektion[]
  tilldelade: TilldeladPerPass[]
  otilldelade: OtilldeladFunktionar[]
  isTL: boolean
}

export default function FunktionarsuppdragSida({ passer, tilldelade, otilldelade, isTL }: Props) {
  const [lokalaPasser, setLokalaPasser]     = useState(passer)
  const [lokalaOtilldelade, setLokalaOtilldelade] = useState(otilldelade)
  const [valtPassId, setValtPassId]         = useState<string | null>(null)

  // Filter
  const [filterOmrade, setFilterOmrade]     = useState('')
  const [filterSektion, setFilterSektion]   = useState('')
  const [filterLuckor, setFilterLuckor]     = useState(false)
  const [sök, setSök]                       = useState('')

  const unikaOmraden  = [...new Set(lokalaPasser.map(p => p.sektion_farg && '').filter(Boolean))]
  void unikaOmraden
  const unikaSektioner = useMemo(() =>
    [...new Map(lokalaPasser.map(p => [p.sektion_id, p.sektion_namn])).entries()],
  [lokalaPasser])

  const filtrerade = useMemo(() => {
    return lokalaPasser.filter(p => {
      if (filterSektion && p.sektion_id !== filterSektion) return false
      if (filterLuckor && p.saknas <= 0) return false
      if (sök) {
        const q = sök.toLowerCase()
        if (!p.pass_namn.toLowerCase().includes(q) && !p.sektion_namn.toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => a.starttid.localeCompare(b.starttid))
  }, [lokalaPasser, filterSektion, filterLuckor, sök])

  // Gruppera per sektion
  const grupperadePerSektion = useMemo(() => {
    const map = new Map<string, { sektionNamn: string; sektionFarg: string; passer: PassMedSektion[] }>()
    filtrerade.forEach(p => {
      if (!map.has(p.sektion_id)) {
        map.set(p.sektion_id, { sektionNamn: p.sektion_namn, sektionFarg: p.sektion_farg, passer: [] })
      }
      map.get(p.sektion_id)!.passer.push(p)
    })
    return [...map.values()]
  }, [filtrerade])

  function hanteraFramgång(profilId: string, passId: string) {
    setLokalaOtilldelade(prev => prev.filter(f => f.id !== profilId))
    setLokalaPasser(prev => prev.map(p =>
      p.pass_id === passId
        ? { ...p, tilldelade: p.tilldelade + 1, saknas: Math.max(0, p.saknas - 1) }
        : p
    ))
    setValtPassId(null)
  }

  const totaltSaknas = lokalaPasser.reduce((s, p) => s + Math.max(0, p.saknas), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Funktionärsuppdrag</h1>
        <div className="flex items-center gap-3">
          {totaltSaknas > 0 && (
            <span className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded-full font-medium">
              {totaltSaknas} platser saknas
            </span>
          )}
          <span className="text-sm text-gray-400">{lokalaPasser.length} pass totalt</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={sök}
          onChange={e => setSök(e.target.value)}
          placeholder="Sök pass eller sektion…"
          className="flex-1 min-w-[180px] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
        />
        <select
          value={filterSektion}
          onChange={e => setFilterSektion(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
        >
          <option value="">Alla sektioner</option>
          {unikaSektioner.map(([id, namn]) => (
            <option key={id} value={id}>{namn}</option>
          ))}
        </select>
        <button
          onClick={() => setFilterLuckor(v => !v)}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
            filterLuckor
              ? 'bg-red-50 text-red-600 border-red-200'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          Visa bara luckor
        </button>
      </div>

      {/* Pass-lista grupperad per sektion */}
      {grupperadePerSektion.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          Inga pass matchar filtret.
        </div>
      ) : (
        <div className="space-y-6">
          {grupperadePerSektion.map(({ sektionNamn, sektionFarg, passer: gruppPasser }) => (
            <div key={sektionNamn}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sektionFarg }} />
                <h2 className="text-sm font-semibold text-gray-700">{sektionNamn}</h2>
                <span className="text-xs text-gray-400">
                  {gruppPasser.reduce((s, p) => s + p.tilldelade, 0)}/
                  {gruppPasser.reduce((s, p) => s + p.behovs_antal, 0)} bemannade
                </span>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      <th className="px-4 py-2.5 font-medium text-gray-500">Pass</th>
                      <th className="px-4 py-2.5 font-medium text-gray-500">Tid</th>
                      <th className="px-4 py-2.5 font-medium text-gray-500 text-center">Bemannat</th>
                      <th className="px-4 py-2.5 font-medium text-gray-500 hidden md:table-cell">Tilldelade</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {gruppPasser.map(p => {
                      const passDeltagare = tilldelade.filter(t => t.pass_id === p.pass_id)
                      const saknas = Math.max(0, p.saknas)
                      return (
                        <tr key={p.pass_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{p.pass_namn}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.starttid}–{p.sluttid}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${
                              saknas === 0 ? 'text-green-600' : saknas <= 2 ? 'text-amber-600' : 'text-red-500'
                            }`}>
                              {p.tilldelade}/{p.behovs_antal}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {passDeltagare.slice(0, 3).map(t => (
                                <span key={t.tilldelning_id} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                                  {t.full_name?.split(' ')[0] ?? t.email.split('@')[0]}
                                </span>
                              ))}
                              {passDeltagare.length > 3 && (
                                <span className="text-xs text-gray-400">+{passDeltagare.length - 3}</span>
                              )}
                              {passDeltagare.length === 0 && (
                                <span className="text-xs text-gray-300 italic">Ingen tilldelad</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(saknas > 0 || isTL) && (
                              <button
                                onClick={() => setValtPassId(p.pass_id)}
                                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                                  saknas > 0
                                    ? 'bg-[#0066CC] text-white hover:bg-blue-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {saknas > 0 ? `+ ${saknas} platser` : 'Hantera'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tilldelningsmodal */}
      {valtPassId && (
        <TilldelningsModal
          valtPassId={valtPassId}
          allPass={lokalaPasser}
          otilldelade={lokalaOtilldelade}
          onClose={() => setValtPassId(null)}
          onSuccess={hanteraFramgång}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import TilldelningsModal from '@/components/TilldelningsModal'
import PassModal from '@/components/PassModal'
import SektionModal from '@/components/SektionModal'
import type { PassMedSektion, TilldeladPerPass, OtilldeladFunktionar, SektionBemanningsgrad } from '@/lib/database.types'

const KOMPETENS_LABELS: Record<string, string> = {
  sjukvard: 'Sjukvård', korkort: 'Körkort',
  triathlon_erfarenhet: 'Triathlon', simning: 'Simkunnig',
  cykel_teknik: 'Cykelmekanik', engelska: 'Engelska',
}

type PassModalState    = { typ: 'nytt' } | { typ: 'redigera'; pass: PassMedSektion }
type SektionModalState = { typ: 'ny' }   | { typ: 'redigera'; sektion: SektionBemanningsgrad }

interface Props {
  passer: PassMedSektion[]
  tilldelade: TilldeladPerPass[]
  otilldelade: OtilldeladFunktionar[]
  sektioner: SektionBemanningsgrad[]
  isTL: boolean
}

export default function FunktionarsuppdragSida({ passer, tilldelade, otilldelade, sektioner, isTL }: Props) {
  const [lokalaPasser,      setLokalaPasser]      = useState(passer)
  const [lokalaSektioner,   setLokalaSektioner]   = useState(sektioner)
  const [lokalaOtilldelade, setLokalaOtilldelade] = useState(otilldelade)

  const [valtPassId,   setValtPassId]   = useState<string | null>(null)
  const [passModal,    setPassModal]    = useState<PassModalState | null>(null)
  const [sektionModal, setSektionModal] = useState<SektionModalState | null>(null)

  // Filter
  const [filterSektion, setFilterSektion] = useState('')
  const [filterLuckor,  setFilterLuckor]  = useState(false)
  const [sök,           setSök]           = useState('')

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
    const map = new Map<string, {
      sektionNamn: string
      sektionFarg: string
      passer: PassMedSektion[]
      sektionObj?: SektionBemanningsgrad
    }>()
    filtrerade.forEach(p => {
      if (!map.has(p.sektion_id)) {
        const sektionObj = lokalaSektioner.find(s => s.id === p.sektion_id)
        map.set(p.sektion_id, { sektionNamn: p.sektion_namn, sektionFarg: p.sektion_farg, passer: [], sektionObj })
      }
      map.get(p.sektion_id)!.passer.push(p)
    })
    return [...map.values()]
  }, [filtrerade, lokalaSektioner])

  // ── Callbacks: tilldelning ───────────────────────────────────
  function hanteraFramgång(profilId: string, passId: string) {
    setLokalaOtilldelade(prev => prev.filter(f => f.id !== profilId))
    setLokalaPasser(prev => prev.map(p =>
      p.pass_id === passId
        ? { ...p, tilldelade: p.tilldelade + 1, saknas: Math.max(0, p.saknas - 1) }
        : p
    ))
    setValtPassId(null)
  }

  // ── Callbacks: pass ──────────────────────────────────────────
  function hanteraPassSparat(uppdaterat: PassMedSektion, nyskapad: boolean) {
    if (nyskapad) {
      setLokalaPasser(prev => [...prev, uppdaterat])
    } else {
      setLokalaPasser(prev => prev.map(p => p.pass_id === uppdaterat.pass_id ? uppdaterat : p))
    }
    setPassModal(null)
  }

  function hanteraPassBorttagen(passId: string) {
    setLokalaPasser(prev => prev.filter(p => p.pass_id !== passId))
    setPassModal(null)
  }

  // ── Callbacks: sektion ───────────────────────────────────────
  function hanteraSektionSparad(uppdaterad: SektionBemanningsgrad, nyskapad: boolean) {
    if (nyskapad) {
      setLokalaSektioner(prev => [...prev, uppdaterad].sort((a, b) => a.sortorder - b.sortorder))
    } else {
      setLokalaSektioner(prev => prev.map(s => s.id === uppdaterad.id ? uppdaterad : s))
      // Synka namn och färg på pass som tillhör sektionen
      setLokalaPasser(prev => prev.map(p =>
        p.sektion_id === uppdaterad.id
          ? { ...p, sektion_namn: uppdaterad.namn, sektion_farg: uppdaterad.farg }
          : p
      ))
    }
    setSektionModal(null)
  }

  function hanteraSektionBorttagen(sektionId: string) {
    setLokalaSektioner(prev => prev.filter(s => s.id !== sektionId))
    setLokalaPasser(prev => prev.filter(p => p.sektion_id !== sektionId))
    setSektionModal(null)
  }

  const totaltSaknas   = lokalaPasser.reduce((s, p) => s + Math.max(0, p.saknas), 0)
  const nästaSortorder = Math.max(0, ...lokalaSektioner.map(s => s.sortorder)) + 1

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
          <span className="text-sm text-gray-400">{lokalaPasser.length} uppdrag totalt</span>
          {isTL && (
            <>
              <button
                onClick={() => setSektionModal({ typ: 'ny' })}
                className="bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:border-gray-400 transition-colors flex items-center gap-1.5"
              >
                <span className="text-base leading-none">+</span> Ny sektion
              </button>
              <button
                onClick={() => setPassModal({ typ: 'nytt' })}
                className="bg-[#0066CC] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                <span className="text-base leading-none">+</span> Nytt uppdrag
              </button>
            </>
          )}
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
          {grupperadePerSektion.map(({ sektionNamn, sektionFarg, passer: gruppPasser, sektionObj }) => (
            <div key={sektionNamn}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sektionFarg }} />
                <h2 className="text-sm font-semibold text-gray-700">{sektionNamn}</h2>
                <span className="text-xs text-gray-400">
                  {gruppPasser.reduce((s, p) => s + p.tilldelade, 0)}/
                  {gruppPasser.reduce((s, p) => s + p.behovs_antal, 0)} bemannade
                </span>
                {isTL && sektionObj && (
                  <button
                    onClick={() => setSektionModal({ typ: 'redigera', sektion: sektionObj })}
                    className="ml-auto text-gray-300 hover:text-[#0066CC] transition-colors p-1 rounded-lg hover:bg-blue-50"
                    title="Redigera sektion"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                    </svg>
                  </button>
                )}
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
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div>{p.pass_namn}</div>
                            {p.kompetenser.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {p.kompetenser.map(k => (
                                  <span key={k} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                                    {KOMPETENS_LABELS[k] ?? k}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
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
                            <div className="flex items-center justify-end gap-2">
                              {saknas > 0 && (
                                <button
                                  onClick={() => setValtPassId(p.pass_id)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0066CC] text-white hover:bg-blue-700 transition-colors"
                                >
                                  + {saknas} platser
                                </button>
                              )}
                              {isTL && (
                                <button
                                  onClick={() => setPassModal({ typ: 'redigera', pass: p })}
                                  className="text-gray-400 hover:text-[#0066CC] transition-colors p-1.5 rounded-lg hover:bg-blue-50"
                                  title="Redigera uppdrag"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                                  </svg>
                                </button>
                              )}
                            </div>
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

      {/* Pass-modal (nytt) */}
      {passModal?.typ === 'nytt' && (
        <PassModal
          sektioner={lokalaSektioner}
          onClose={() => setPassModal(null)}
          onSparat={hanteraPassSparat}
          onBorttagen={hanteraPassBorttagen}
        />
      )}

      {/* Pass-modal (redigera) */}
      {passModal?.typ === 'redigera' && (
        <PassModal
          sektionId={passModal.pass.sektion_id}
          sektionNamn={passModal.pass.sektion_namn}
          pass={passModal.pass}
          sektioner={lokalaSektioner}
          onClose={() => setPassModal(null)}
          onSparat={hanteraPassSparat}
          onBorttagen={hanteraPassBorttagen}
        />
      )}

      {/* Sektionsmodal (ny) */}
      {sektionModal?.typ === 'ny' && (
        <SektionModal
          nästaSortorder={nästaSortorder}
          onClose={() => setSektionModal(null)}
          onSparat={hanteraSektionSparad}
          onBorttagen={hanteraSektionBorttagen}
        />
      )}

      {/* Sektionsmodal (redigera) */}
      {sektionModal?.typ === 'redigera' && (
        <SektionModal
          sektion={sektionModal.sektion}
          onClose={() => setSektionModal(null)}
          onSparat={hanteraSektionSparad}
          onBorttagen={hanteraSektionBorttagen}
        />
      )}
    </div>
  )
}

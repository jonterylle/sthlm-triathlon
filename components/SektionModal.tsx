'use client'

import { useState, useTransition } from 'react'
import { skapaSektion, uppdateraSektion, taBortSektion, tilldelaSektionsledare, taBortSektionsledare } from '@/app/dashboard/sektions-actions'
import type { SektionBemanningsgrad, SektionOmrade, SektionSL, SektionsledareInfo } from '@/lib/database.types'

const OMRADEN: { value: SektionOmrade; label: string }[] = [
  { value: 'simning',   label: '🏊 Simning' },
  { value: 't1',        label: '🔄 T1' },
  { value: 'cykling',   label: '🚴 Cykling' },
  { value: 'lopning',   label: '🏃 Löpning' },
  { value: 'arena_t2',  label: '🏁 Arena / T2' },
  { value: 'ovrigt',    label: '📋 Övrigt' },
]

const FARG_FORSLAG = [
  '#0066CC', '#9333EA', '#FF6B35', '#16A34A',
  '#DC2626', '#EF4444', '#0891B2', '#6B7280',
  '#CA8A04', '#DB2777',
]

interface Props {
  sektion?: SektionBemanningsgrad
  nästaSortorder?: number
  allaSL: SektionsledareInfo[]
  koppladeSL: SektionSL[]
  onClose: () => void
  onSparat: (sektion: SektionBemanningsgrad, nyskapad: boolean) => void
  onBorttagen: (sektionId: string) => void
  onSLTillagd: (sl: SektionSL) => void
  onSLBorttagen: (sektionId: string, profilId: string) => void
}

export default function SektionModal({
  sektion,
  nästaSortorder = 10,
  allaSL,
  koppladeSL,
  onClose,
  onSparat,
  onBorttagen,
  onSLTillagd,
  onSLBorttagen,
}: Props) {
  const arNy = !sektion

  const [namn,        setNamn]        = useState(sektion?.namn        ?? '')
  const [beskrivning, setBeskrivning] = useState(sektion?.beskrivning ?? '')
  const [farg,        setFarg]        = useState(sektion?.farg        ?? '#0066CC')
  const [omrade,      setOmrade]      = useState<SektionOmrade>(sektion?.omrade ?? 'ovrigt')
  const [behovsAntal, setBehovsAntal] = useState(sektion?.behovs_totalt ?? 4)
  const [sortorder,   setSortorder]   = useState(sektion?.sortorder   ?? nästaSortorder)

  const [isPending, startTransition] = useTransition()
  const [fel, setFel]         = useState<string | null>(null)
  const [raderar, setRaderar] = useState(false)

  // SL-hantering
  const [valdNySL,           setValdNySL]           = useState('')
  const [slPending,          startSLTransition]     = useTransition()
  const [slFel,              setSlFel]              = useState<string | null>(null)
  const [bekräftaTaBortSL,   setBekräftaTaBortSL]   = useState<string | null>(null) // profil_id

  // Lokalt state för kopplade SL (speglar parent men hanteras här för snabb UI-respons)
  const [lokalaKoppladeSL, setLokalaKoppladeSL] = useState(koppladeSL)

  // Filtrera bort redan kopplade SL från dropdown
  const tillgängligaSL = allaSL.filter(sl => !lokalaKoppladeSL.some(k => k.profil_id === sl.id))

  function handleSpara(e: React.FormEvent) {
    e.preventDefault()
    setFel(null)
    if (!namn.trim()) { setFel('Ange ett namn för sektionen.'); return }

    startTransition(async () => {
      const payload = { namn, beskrivning, farg, omrade, behovs_antal: behovsAntal, sortorder }

      if (arNy) {
        const res = await skapaSektion(payload)
        if (!res.ok) { setFel(res.meddelande ?? 'Fel'); return }
        onSparat({
          id:                res.sektionId!,
          namn,
          beskrivning:       beskrivning || null,
          farg,
          omrade,
          lat:               null,
          lng:               null,
          sortorder,
          behovs_totalt:     behovsAntal,
          tilldelade_totalt: 0,
          saknas_totalt:     behovsAntal,
          status:            'tom',
        }, true)
      } else {
        const res = await uppdateraSektion(sektion.id, payload)
        if (!res.ok) { setFel(res.meddelande ?? 'Fel'); return }
        onSparat({
          ...sektion,
          namn,
          beskrivning: beskrivning || null,
          farg,
          omrade,
          sortorder,
          behovs_totalt: behovsAntal,
          saknas_totalt: Math.max(0, behovsAntal - sektion.tilldelade_totalt),
        }, false)
      }
    })
  }

  function handleTaBort() {
    if (!sektion) return
    if (!confirm(`Ta bort sektionen "${sektion.namn}"?\n\nAlla pass utan aktiva tilldelningar tas bort. Detta går inte att ångra.`)) return
    setRaderar(true)
    startTransition(async () => {
      const res = await taBortSektion(sektion.id)
      if (!res.ok) { setFel(res.meddelande ?? 'Kunde inte ta bort.'); setRaderar(false); return }
      onBorttagen(sektion.id)
    })
  }

  function handleLäggTillSL() {
    if (!valdNySL || !sektion) return
    setSlFel(null)
    const slInfo = allaSL.find(s => s.id === valdNySL)
    if (!slInfo) return

    startSLTransition(async () => {
      const res = await tilldelaSektionsledare(sektion.id, valdNySL)
      if (!res.ok) { setSlFel(res.meddelande ?? 'Fel'); return }
      const nySL: SektionSL = {
        sektion_id: sektion.id,
        profil_id:  slInfo.id,
        full_name:  slInfo.full_name,
        email:      slInfo.email,
      }
      setLokalaKoppladeSL(prev => [...prev, nySL])
      onSLTillagd(nySL)
      setValdNySL('')
    })
  }

  function handleTaBortSL(profilId: string) {
    if (!sektion) return
    startSLTransition(async () => {
      const res = await taBortSektionsledare(sektion.id, profilId)
      if (!res.ok) { setSlFel(res.meddelande ?? 'Fel'); return }
      setLokalaKoppladeSL(prev => prev.filter(s => s.profil_id !== profilId))
      onSLBorttagen(sektion.id, profilId)
      setBekräftaTaBortSL(null)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {arNy ? 'Ny sektion' : 'Redigera sektion'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-3" aria-label="Stäng">×</button>
        </div>

        {/* Formulär */}
        <form onSubmit={handleSpara} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {fel && <p className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{fel}</p>}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Namn</label>
            <input
              type="text"
              value={namn}
              onChange={e => setNamn(e.target.value)}
              placeholder="T.ex. Simning – Start"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Beskrivning (valfri)</label>
            <textarea
              value={beskrivning}
              onChange={e => setBeskrivning(e.target.value)}
              rows={2}
              placeholder="Kort beskrivning av sektionens uppgift"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Område</label>
            <select
              value={omrade}
              onChange={e => setOmrade(e.target.value as SektionOmrade)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            >
              {OMRADEN.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Färg</label>
            <div className="flex flex-wrap gap-2 items-center">
              {FARG_FORSLAG.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFarg(f)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    farg === f ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: f }}
                  title={f}
                />
              ))}
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="color"
                  value={farg}
                  onChange={e => setFarg(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                  title="Välj annan färg"
                />
                <span className="text-xs text-gray-400 font-mono">{farg}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Totalt antal funktionärer</label>
              <input
                type="number" min={1} max={200} value={behovsAntal}
                onChange={e => setBehovsAntal(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sorteringsordning</label>
              <input
                type="number" min={0} max={999} value={sortorder}
                onChange={e => setSortorder(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
            </div>
          </div>

          {/* ── Sektionsledare (bara vid redigering av befintlig sektion) ── */}
          {!arNy && (
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-xs text-gray-500 mb-2">Sektionsledare</label>

              {/* Kopplade SL */}
              <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
                {lokalaKoppladeSL.length === 0 && (
                  <span className="text-xs text-gray-300 italic">Ingen sektionsledare kopplad</span>
                )}
                {lokalaKoppladeSL.map(sl => (
                  bekräftaTaBortSL === sl.profil_id ? (
                    <span key={sl.profil_id} className="inline-flex items-center gap-1 text-xs bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded-full">
                      <span>Ta bort {sl.full_name?.split(' ')[0] ?? sl.email}?</span>
                      <button
                        type="button"
                        onClick={() => handleTaBortSL(sl.profil_id)}
                        disabled={slPending}
                        className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {slPending ? '…' : 'Ja'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBekräftaTaBortSL(null)}
                        disabled={slPending}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        Nej
                      </button>
                    </span>
                  ) : (
                    <span key={sl.profil_id} className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded-full group">
                      {sl.full_name ?? sl.email}
                      <button
                        type="button"
                        onClick={() => setBekräftaTaBortSL(sl.profil_id)}
                        className="text-purple-300 hover:text-red-500 transition-colors leading-none opacity-0 group-hover:opacity-100"
                        title={`Ta bort ${sl.full_name ?? sl.email} som sektionsledare`}
                      >
                        ✕
                      </button>
                    </span>
                  )
                ))}
              </div>

              {/* Lägg till SL */}
              {tillgängligaSL.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={valdNySL}
                    onChange={e => { setValdNySL(e.target.value); setSlFel(null) }}
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  >
                    <option value="">Lägg till sektionsledare…</option>
                    {tillgängligaSL.map(sl => (
                      <option key={sl.id} value={sl.id}>
                        {sl.full_name ?? sl.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleLäggTillSL}
                    disabled={!valdNySL || slPending}
                    className="px-3 py-2 rounded-xl bg-[#0066CC] text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  >
                    {slPending ? '…' : '+ Lägg till'}
                  </button>
                </div>
              )}
              {slFel && <p className="text-xs text-red-600 mt-1">{slFel}</p>}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          <button
            onClick={() => { const f = document.querySelector('form'); f?.requestSubmit() }}
            disabled={isPending}
            className="w-full bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {isPending && !raderar ? 'Sparar…' : arNy ? 'Skapa sektion' : 'Spara ändringar'}
          </button>
          {!arNy && (
            <button type="button" onClick={handleTaBort} disabled={isPending}
              className="w-full bg-white hover:bg-red-50 disabled:opacity-60 text-red-600 border border-red-200 font-medium py-3 rounded-xl text-sm transition-colors"
            >
              {raderar ? 'Tar bort…' : 'Ta bort sektion'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

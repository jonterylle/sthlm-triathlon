'use client'

import { useState, useTransition } from 'react'
import { skapaSektion, uppdateraSektion, taBortSektion } from '@/app/dashboard/sektions-actions'
import type { SektionBemanningsgrad, SektionOmrade } from '@/lib/database.types'

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
  sektion?: SektionBemanningsgrad   // undefined = ny sektion
  nästaSortorder?: number
  onClose: () => void
  onSparat: (sektion: SektionBemanningsgrad, nyskapad: boolean) => void
  onBorttagen: (sektionId: string) => void
}

export default function SektionModal({
  sektion,
  nästaSortorder = 10,
  onClose,
  onSparat,
  onBorttagen,
}: Props) {
  const arNy = !sektion

  const [namn,        setNamn]        = useState(sektion?.namn        ?? '')
  const [beskrivning, setBeskrivning] = useState(sektion?.beskrivning ?? '')
  const [farg,        setFarg]        = useState(sektion?.farg        ?? '#0066CC')
  const [omrade,      setOmrade]      = useState<SektionOmrade>(sektion?.omrade ?? 'ovrigt')
  const [behovsAntal, setBehovsAntal] = useState(sektion?.behovs_totalt ?? 4)
  const [sortorder,   setSortorder]   = useState(sektion?.sortorder   ?? nästaSortorder)

  const [isPending, startTransition] = useTransition()
  const [fel, setFel]     = useState<string | null>(null)
  const [raderar, setRaderar] = useState(false)

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
              {/* Eget hex-värde */}
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

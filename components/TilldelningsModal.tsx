'use client'

import { useState, useTransition } from 'react'
import { tilldelaFunktionar } from '@/app/dashboard/tilldela'
import type { FunktionarForTilldelning, PassMedSektion } from '@/lib/database.types'

interface Props {
  valtFunktionar?: FunktionarForTilldelning
  valtPassId?: string
  allPass: PassMedSektion[]
  funktionärer: FunktionarForTilldelning[]
  onClose: () => void
  onSuccess: (profilId: string, passId: string) => void
}

const KOMPETENS_LABELS: Record<string, string> = {
  sjukvard:              'Sjukvård/HLR',
  korkort:               'Körkort',
  triathlon_erfarenhet:  'Triathlonerfarenhet',
  simning:               'Simkunnig',
  cykel_teknik:          'Cykelmekanik',
  engelska:              'Engelska',
}

export default function TilldelningsModal({
  valtFunktionar,
  valtPassId,
  allPass,
  funktionärer,
  onClose,
  onSuccess,
}: Props) {
  const [valdFunktionar, setValdFunktionar] = useState<string>(valtFunktionar?.id ?? '')
  const [valdPass, setValdPass]             = useState<string>(valtPassId ?? '')
  const [notering, setNotering]             = useState('')
  const [fel, setFel]                       = useState('')
  const [pending, startTransition]          = useTransition()

  // Gruppera pass per sektion för dropdown
  const passerPerSektion = allPass.reduce<Record<string, PassMedSektion[]>>((acc, p) => {
    const key = p.sektion_namn
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  const valdFunktionarInfo = funktionärer.find(f => f.id === valdFunktionar)
    ?? valtFunktionar

  const valdPassInfo = allPass.find(p => p.pass_id === valdPass)

  function hanteraSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valdFunktionar || !valdPass) return
    setFel('')

    startTransition(async () => {
      const res = await tilldelaFunktionar(valdFunktionar, valdPass, notering)
      if (res.ok) {
        onSuccess(valdFunktionar, valdPass)
      } else {
        setFel(res.meddelande ?? 'Något gick fel')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Tilldela funktionär</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Stäng">✕</button>
        </div>

        <form onSubmit={hanteraSubmit} className="px-6 py-5 space-y-5">

          {/* Välj funktionär */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Funktionär</label>
            {valtFunktionar ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{valtFunktionar.full_name ?? '(inget namn)'}</p>
                <p className="text-xs text-gray-500">{valtFunktionar.email}</p>
                {valtFunktionar.antal_pass > 0 && (
                  <p className="text-xs text-amber-600 mt-1">{valtFunktionar.antal_pass} aktiva uppdrag</p>
                )}
                {(valtFunktionar.kompetenser ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(valtFunktionar.kompetenser ?? []).map(k => (
                      <span key={k} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
                        {KOMPETENS_LABELS[k] ?? k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <select
                required
                value={valdFunktionar}
                onChange={e => setValdFunktionar(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              >
                <option value="">Välj funktionär…</option>
                {funktionärer.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.full_name ?? f.email}
                    {f.role === 'tl' ? ' · TL' : f.role === 'sektionsledare' ? ' · SL' : ''}
                    {f.antal_pass > 0 ? ` · ${f.antal_pass} uppdrag` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Välj pass */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pass</label>
            {valtPassId ? (
              valdPassInfo && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{valdPassInfo.sektion_namn}</p>
                  <p className="text-xs text-gray-600">{valdPassInfo.pass_namn} · {valdPassInfo.starttid}–{valdPassInfo.sluttid}</p>
                  <p className="text-xs text-gray-400 mt-1">{valdPassInfo.tilldelade}/{valdPassInfo.behovs_antal} tilldelade</p>
                </div>
              )
            ) : (
              <select
                required
                value={valdPass}
                onChange={e => setValdPass(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              >
                <option value="">Välj pass…</option>
                {Object.entries(passerPerSektion).map(([sektionNamn, passer]) => (
                  <optgroup key={sektionNamn} label={sektionNamn}>
                    {passer.map(p => (
                      <option key={p.pass_id} value={p.pass_id}>
                        {p.pass_namn} {p.starttid}–{p.sluttid}
                        {p.saknas <= 0 ? ' ✓ Full' : ` (${p.tilldelade}/${p.behovs_antal})`}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Preferenser-info om funktionär är vald via dropdown */}
          {valdFunktionarInfo && !valtFunktionar && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-500 space-y-1">
              {valdFunktionarInfo.antal_pass > 0 && (
                <p>Aktiva uppdrag: <span className="text-amber-600 font-medium">{valdFunktionarInfo.antal_pass} st</span></p>
              )}
              {valdFunktionarInfo.sektion_preferens && (
                <p>Önskar sektion: <span className="text-gray-700 font-medium">{valdFunktionarInfo.sektion_preferens}</span></p>
              )}
              {valdFunktionarInfo.pass_preferens && valdFunktionarInfo.pass_preferens !== 'ingen_preferens' && (
                <p>Önskar pass: <span className="text-gray-700 font-medium">{valdFunktionarInfo.pass_preferens}</span></p>
              )}
              {(valdFunktionarInfo.kompetenser ?? []).length > 0 && (
                <p>Kompetenser: <span className="text-gray-700 font-medium">
                  {(valdFunktionarInfo.kompetenser ?? []).map(k => KOMPETENS_LABELS[k] ?? k).join(', ')}
                </span></p>
              )}
            </div>
          )}

          {/* Notering */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notering <span className="text-gray-400 font-normal">(valfri)</span>
            </label>
            <textarea
              value={notering}
              onChange={e => setNotering(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="T.ex. ansvarig för upprop, ta med väst…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

          {/* Felmeddelande */}
          {fel && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{fel}</p>}

          {/* Knappar */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Avbryt
            </button>
            <button type="submit" disabled={pending || !valdFunktionar || !valdPass}
              className="flex-1 rounded-lg bg-[#0066CC] py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
              {pending ? 'Sparar…' : 'Tilldela'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

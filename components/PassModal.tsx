'use client'

import { useState, useTransition } from 'react'
import { skapaPass, uppdateraPass, taBortPass } from '@/app/dashboard/pass-actions'
import type { PassMedSektion, SektionBemanningsgrad } from '@/lib/database.types'

const KOMPETENSER = [
  { key: 'sjukvard',             label: 'Sjukvård / HLR' },
  { key: 'korkort',              label: 'Körkort' },
  { key: 'triathlon_erfarenhet', label: 'Triathlonvana' },
  { key: 'simning',              label: 'Simkunnig' },
  { key: 'cykel_teknik',         label: 'Cykelmekanik' },
  { key: 'engelska',             label: 'Engelska' },
]

interface Props {
  // Om sektionId/sektionNamn ej anges visas en sektionsväljare
  sektionId?: string
  sektionNamn?: string
  sektioner?: SektionBemanningsgrad[]   // krävs när sektionId saknas
  pass?: PassMedSektion                  // undefined = nytt pass
  onClose: () => void
  onSparat: (uppdaterat: PassMedSektion, nyskapad: boolean) => void
  onBorttagen: (passId: string) => void
}

export default function PassModal({
  sektionId: initSektionId,
  sektionNamn: initSektionNamn,
  sektioner = [],
  pass,
  onClose,
  onSparat,
  onBorttagen,
}: Props) {
  const arNytt = !pass

  const [sektionId,   setSektionId]   = useState(initSektionId   ?? pass?.sektion_id   ?? sektioner[0]?.id   ?? '')
  const [sektionNamn, setSektionNamn] = useState(initSektionNamn ?? pass?.sektion_namn ?? sektioner[0]?.namn ?? '')
  const [namn,        setNamn]        = useState(pass?.pass_namn    ?? '')
  const [datum,       setDatum]       = useState(pass?.datum        ?? '2026-08-09')
  const [starttid,    setStarttid]    = useState(pass?.starttid     ?? '08:00')
  const [sluttid,     setSluttid]     = useState(pass?.sluttid      ?? '14:00')
  const [behovsAntal, setBehovsAntal] = useState(pass?.behovs_antal ?? 2)
  const [kompetenser,       setKompetenser]       = useState<string[]>(pass?.kompetenser ?? [])
  const [mapsUrl,           setMapsUrl]           = useState(pass?.maps_url ?? '')
  const [kladerUtrustning,  setKladerUtrustning]  = useState(pass?.klader_utrustning ?? '')
  const [instruktion,       setInstruktion]       = useState(pass?.instruktion ?? '')

  const [isPending, startTransition] = useTransition()
  const [fel, setFel]     = useState<string | null>(null)
  const [raderar, setRaderar] = useState(false)

  const visaSektionsväljare = !initSektionId && !pass

  function toggleKompetens(k: string) {
    setKompetenser(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }

  function handleSektionChange(id: string) {
    setSektionId(id)
    const s = sektioner.find(s => s.id === id)
    setSektionNamn(s?.namn ?? '')
  }

  function handleSpara(e: React.FormEvent) {
    e.preventDefault()
    setFel(null)
    if (!sektionId)      { setFel('Välj en sektion.'); return }
    if (!namn.trim())    { setFel('Ange ett namn för passet.'); return }
    if (starttid >= sluttid) { setFel('Sluttid måste vara efter starttid.'); return }

    startTransition(async () => {
      const maps_url         = mapsUrl.trim() || null
      const klader_utrustning = kladerUtrustning.trim() || null
      const inst              = instruktion.trim() || null
      if (arNytt) {
        const res = await skapaPass({ sektion_id: sektionId, namn, datum, starttid, sluttid, behovs_antal: behovsAntal, kompetenser, maps_url, klader_utrustning, instruktion: inst })
        if (!res.ok) { setFel(res.meddelande ?? 'Fel'); return }
        onSparat({
          pass_id:           res.passId!,
          pass_namn:         namn,
          datum,
          starttid,
          sluttid,
          behovs_antal:      behovsAntal,
          tilldelade:        0,
          saknas:            behovsAntal,
          sektion_id:        sektionId,
          sektion_namn:      sektionNamn,
          sektion_farg:      sektioner.find(s => s.id === sektionId)?.farg ?? '#0066CC',
          kompetenser,
          maps_url,
          klader_utrustning,
          instruktion:       inst,
        }, true)
      } else {
        const res = await uppdateraPass(pass.pass_id, { namn, datum, starttid, sluttid, behovs_antal: behovsAntal, kompetenser, maps_url, klader_utrustning, instruktion: inst })
        if (!res.ok) { setFel(res.meddelande ?? 'Fel'); return }
        onSparat({ ...pass, pass_namn: namn, datum, starttid, sluttid, behovs_antal: behovsAntal, saknas: Math.max(0, behovsAntal - pass.tilldelade), kompetenser, maps_url, klader_utrustning, instruktion: inst }, false)
      }
    })
  }

  function handleTaBort() {
    if (!pass) return
    if (!confirm(`Ta bort passet "${pass.pass_namn}"?\n\nDetta går inte att ångra.`)) return
    setRaderar(true)
    startTransition(async () => {
      const res = await taBortPass(pass.pass_id)
      if (!res.ok) { setFel(res.meddelande ?? 'Kunde inte ta bort.'); setRaderar(false); return }
      onBorttagen(pass.pass_id)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {arNytt ? 'Nytt funktionärsuppdrag' : 'Redigera uppdrag'}
            </h2>
            {!visaSektionsväljare && <p className="text-xs text-gray-400">{sektionNamn}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-3" aria-label="Stäng">×</button>
        </div>

        {/* Formulär */}
        <form onSubmit={handleSpara} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {fel && <p className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{fel}</p>}

          {/* Sektionsväljare (bara vid nytt uppdrag utan förvald sektion) */}
          {visaSektionsväljare && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sektion</label>
              <select
                value={sektionId}
                onChange={e => handleSektionChange(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              >
                <option value="">Välj sektion…</option>
                {sektioner.map(s => (
                  <option key={s.id} value={s.id}>{s.namn}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Uppdragsnamn</label>
            <input
              type="text"
              value={namn}
              onChange={e => setNamn(e.target.value)}
              placeholder="T.ex. Tävling, Förberedelse, Målgång"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={e => setDatum(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Starttid</label>
              <input type="time" value={starttid} onChange={e => setStarttid(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sluttid</label>
              <input type="time" value={sluttid} onChange={e => setSluttid(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Antal funktionärer som behövs</label>
            <input
              type="number" min={1} max={50} value={behovsAntal}
              onChange={e => setBehovsAntal(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Önskvärda kompetenser</label>
            <div className="flex flex-wrap gap-2">
              {KOMPETENSER.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleKompetens(key)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    kompetenser.includes(key)
                      ? 'bg-[#0066CC] text-white border-[#0066CC]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {kompetenser.length > 0 && (
              <button
                type="button"
                onClick={() => setKompetenser([])}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600"
              >
                Rensa val ×
              </button>
            )}
          </div>

          {/* ── Plats / Google Maps-länk ── */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">📍 Plats (Google Maps-länk)</label>
            <input
              type="url"
              value={mapsUrl}
              onChange={e => setMapsUrl(e.target.value)}
              placeholder="Klistra in Google Maps-länk…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#0066CC] hover:underline"
              >
                Öppna länk ↗
              </a>
            )}
          </div>

          {/* ── Kläder / Utrustning ── */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">👕 Kläder / Utrustning</label>
            <textarea
              value={kladerUtrustning}
              onChange={e => setKladerUtrustning(e.target.value)}
              placeholder="T.ex. gul väst, regnkläder, eget vatten och mat…"
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
            />
          </div>

          {/* ── Instruktion ── */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">📋 Instruktion</label>
            <textarea
              value={instruktion}
              onChange={e => setInstruktion(e.target.value)}
              placeholder="T.ex. möt upp vid startporten kl. 07:30, ta emot cyklar…"
              rows={4}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          <button
            onClick={() => { const f = document.querySelector('form'); f?.requestSubmit() }}
            disabled={isPending}
            className="w-full bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {isPending && !raderar ? 'Sparar…' : arNytt ? 'Skapa uppdrag' : 'Spara ändringar'}
          </button>
          {!arNytt && (
            <button type="button" onClick={handleTaBort} disabled={isPending}
              className="w-full bg-white hover:bg-red-50 disabled:opacity-60 text-red-600 border border-red-200 font-medium py-3 rounded-xl text-sm transition-colors"
            >
              {raderar ? 'Tar bort…' : 'Ta bort uppdrag'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

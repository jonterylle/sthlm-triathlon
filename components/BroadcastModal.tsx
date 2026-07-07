'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
}

type Läge = 'form' | 'skickar' | 'klart' | 'fel'

interface Resultat {
  skickade: number
  felade: number
  inga_prenumerationer: boolean
}

export default function BroadcastModal({ onClose }: Props) {
  const [titel,      setTitel]      = useState('')
  const [meddelande, setMeddelande] = useState('')
  const [läge,       setLäge]       = useState<Läge>('form')
  const [resultat,   setResultat]   = useState<Resultat | null>(null)
  const [feltext,    setFeltext]    = useState('')

  async function handleSkicka(e: React.FormEvent) {
    e.preventDefault()
    if (!titel.trim() || !meddelande.trim()) return

    setLäge('skickar')

    try {
      const res = await fetch('/api/push/broadcast', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ titel: titel.trim(), meddelande: meddelande.trim() }),
      })

      const json = await res.json()

      if (!res.ok) {
        setFeltext(json.error ?? 'Något gick fel.')
        setLäge('fel')
        return
      }

      setResultat(json)
      setLäge('klart')
    } catch {
      setFeltext('Nätverksfel — försök igen.')
      setLäge('fel')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">📢 Skicka meddelande</h2>
            <p className="text-xs text-gray-400 mt-0.5">Push-notis till alla funktionärer i appen</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-3"
            aria-label="Stäng"
          >×</button>
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Formulär */}
          {(läge === 'form' || läge === 'skickar') && (
            <form id="broadcast-form" onSubmit={handleSkicka} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rubrik</label>
                <input
                  type="text"
                  value={titel}
                  onChange={e => setTitel(e.target.value)}
                  placeholder="T.ex. Viktig info inför tävlingsdagen"
                  maxLength={100}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Meddelande</label>
                <textarea
                  value={meddelande}
                  onChange={e => setMeddelande(e.target.value)}
                  placeholder="Skriv ditt meddelande här…"
                  maxLength={500}
                  required
                  rows={5}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{meddelande.length}/500</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                Notisen skickas till alla funktionärer som aktiverat push-notiser i appen. Funktionärer utan push-notiser ser inget.
              </div>
            </form>
          )}

          {/* Skickar */}
          {läge === 'skickar' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-10 h-10 border-4 border-[#0066CC] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Skickar till alla funktionärer…</p>
            </div>
          )}

          {/* Klart */}
          {läge === 'klart' && resultat && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <div className="text-5xl">
                {resultat.inga_prenumerationer ? '😴' : '✅'}
              </div>
              {resultat.inga_prenumerationer ? (
                <>
                  <p className="text-base font-semibold text-gray-800">Inga prenumerationer</p>
                  <p className="text-sm text-gray-500">
                    Ingen funktionär har aktiverat push-notiser ännu. Be dem öppna appen och aktivera notiser.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-gray-800">Meddelande skickat!</p>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <div className="bg-green-50 rounded-xl p-3">
                      <p className="text-2xl font-bold text-green-600">{resultat.skickade}</p>
                      <p className="text-xs text-green-700 mt-0.5">skickade</p>
                    </div>
                    <div className={`rounded-xl p-3 ${resultat.felade > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <p className={`text-2xl font-bold ${resultat.felade > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {resultat.felade}
                      </p>
                      <p className={`text-xs mt-0.5 ${resultat.felade > 0 ? 'text-red-700' : 'text-gray-400'}`}>felade</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Fel */}
          {läge === 'fel' && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <div className="text-5xl">❌</div>
              <p className="text-base font-semibold text-gray-800">Kunde inte skicka</p>
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 w-full">{feltext}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          {(läge === 'form') && (
            <button
              form="broadcast-form"
              type="submit"
              disabled={!titel.trim() || !meddelande.trim()}
              className="w-full bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              Skicka till alla funktionärer
            </button>
          )}
          {läge === 'fel' && (
            <button
              onClick={() => setLäge('form')}
              className="w-full bg-[#0066CC] hover:bg-[#0052a3] text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              Försök igen
            </button>
          )}
          {(läge === 'klart' || läge === 'skickar') && (
            <button
              onClick={onClose}
              disabled={läge === 'skickar'}
              className="w-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              Stäng
            </button>
          )}
          {läge === 'klart' && (
            <button
              onClick={() => { setTitel(''); setMeddelande(''); setResultat(null); setLäge('form') }}
              className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium py-3 rounded-xl text-sm transition-colors"
            >
              Skicka ett nytt meddelande
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

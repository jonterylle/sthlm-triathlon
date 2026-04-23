'use client'

import { useState, useTransition } from 'react'
import { bjudIn, skickaSMSInbjudan, bjudInFranSMS } from '@/app/dashboard/actions'
import type { InbjudanResultat, SMSResultat } from '@/app/dashboard/actions'

interface SMSRad {
  id: string
  telefon: string
  skickad_at: string
  email_inkommen: string | null
  status: string
}

interface EmailRad {
  id: string
  email: string
  skickad_at: string
  status: string
}

interface Props {
  smsInbjudningar: SMSRad[]
  emailInbjudningar: EmailRad[]
}

export default function BjudInFlik({ smsInbjudningar, emailInbjudningar }: Props) {
  const [aktivSektion, setAktivSektion] = useState<'email' | 'sms'>('email')

  return (
    <div className="space-y-6">
      {/* Sektion-väljare */}
      <div className="flex gap-2">
        <SektionKnapp aktiv={aktivSektion === 'email'} onClick={() => setAktivSektion('email')} label="📧 E-post" />
        <SektionKnapp aktiv={aktivSektion === 'sms'} onClick={() => setAktivSektion('sms')} label="📱 SMS" />
      </div>

      {aktivSektion === 'email' && (
        <EmailSektion emailInbjudningar={emailInbjudningar} />
      )}
      {aktivSektion === 'sms' && (
        <SMSSektion smsInbjudningar={smsInbjudningar} />
      )}
    </div>
  )
}

// ── E-postsektion ─────────────────────────────────────────────

function EmailSektion({ emailInbjudningar }: { emailInbjudningar: EmailRad[] }) {
  const [resultat, setResultat] = useState<InbjudanResultat[]>([])
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await bjudIn(fd)
      setResultat(res.resultat)
      if (res.resultat.some(r => r.status === 'skickad')) {
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Skicka e-postinbjudan</h3>
        <p className="text-xs text-gray-500 mb-4">
          Ange en eller flera e-postadresser (komma- eller radbrytningsseparerade). Varje person får ett magic link-mail.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            name="emails"
            rows={4}
            placeholder={'anna@exempel.se\nbj@exempel.se'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent resize-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? 'Skickar…' : 'Skicka inbjudningar'}
          </button>
        </form>

        {resultat.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {resultat.map((r) => (
              <div key={r.email} className="flex items-center gap-2 text-xs">
                <span>{statusIkon(r.status)}</span>
                <span className="font-mono text-gray-700">{r.email}</span>
                <span className="text-gray-400">{statusText(r.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {emailInbjudningar.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Skickade inbjudningar ({emailInbjudningar.length})
          </h3>
          <div className="divide-y divide-gray-100">
            {emailInbjudningar.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                <span className="font-mono text-gray-700">{r.email}</span>
                <span className={`px-2 py-0.5 rounded-full ${statusBadgeFarg(r.status)}`}>
                  {r.status === 'skickad' ? 'Inväntar svar' : r.status === 'accepterad' ? 'Accepterad' : 'Fel'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── SMS-sektion ───────────────────────────────────────────────

function SMSSektion({ smsInbjudningar }: { smsInbjudningar: SMSRad[] }) {
  const [resultat, setResultat] = useState<SMSResultat[]>([])
  const [isPending, startTransition] = useTransition()
  const [skickarId, setSkickarId] = useState<string | null>(null)
  const [lokalStatus, setLokalStatus] = useState<Record<string, string>>({})

  function handleSMSSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await skickaSMSInbjudan(fd)
      setResultat(res.resultat)
      if (res.resultat.some(r => r.status === 'skickad')) {
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  function handleBjudIn(id: string) {
    setSkickarId(id)
    startTransition(async () => {
      const res = await bjudInFranSMS(id)
      setLokalStatus(prev => ({
        ...prev,
        [id]: res.ok ? 'inbjudan_skickad' : 'fel',
      }))
      setSkickarId(null)
    })
  }

  const vantar = smsInbjudningar.filter(r => r.email_inkommen && r.status === 'email_inkommen')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Skicka SMS-inbjudan</h3>
        <p className="text-xs text-gray-500 mb-4">
          Ange ett eller flera mobilnummer (ett per rad). Personen får ett SMS med en länk där de anger sin e-post.
        </p>
        <form onSubmit={handleSMSSubmit} className="space-y-3">
          <textarea
            name="telefonnummer"
            rows={4}
            placeholder={'0701234567\n0739876543'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent resize-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? 'Skickar…' : 'Skicka SMS'}
          </button>
        </form>

        {resultat.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {resultat.map((r) => (
              <div key={r.telefon} className="flex items-center gap-2 text-xs">
                <span>{r.status === 'skickad' ? '✅' : r.status === 'redan_inbjuden' ? '⚠️' : '❌'}</span>
                <span className="font-mono text-gray-700">{r.telefon}</span>
                <span className="text-gray-400">
                  {r.status === 'skickad' ? 'SMS skickat' : r.status === 'redan_inbjuden' ? 'Redan inbjuden' : 'Fel'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inkomna e-postadresser som väntar på e-postinbjudan */}
      {vantar.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">
            ⏳ Väntar på e-postinbjudan ({vantar.length})
          </h3>
          <div className="space-y-2">
            {vantar.map((r) => {
              const status = lokalStatus[r.id] ?? r.status
              return (
                <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-amber-100">
                  <div>
                    <span className="font-mono text-gray-700">{r.email_inkommen}</span>
                    <span className="text-gray-400 ml-2">({r.telefon})</span>
                  </div>
                  {status === 'inbjudan_skickad' ? (
                    <span className="text-green-600 font-medium">✅ Skickad</span>
                  ) : (
                    <button
                      onClick={() => handleBjudIn(r.id)}
                      disabled={skickarId === r.id}
                      className="bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white px-3 py-1 rounded-lg transition-colors font-medium"
                    >
                      {skickarId === r.id ? 'Skickar…' : 'Skicka inbjudan'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {smsInbjudningar.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Skickade SMS ({smsInbjudningar.length})
          </h3>
          <div className="divide-y divide-gray-100">
            {smsInbjudningar.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono text-gray-700">{r.telefon}</span>
                  {r.email_inkommen && (
                    <span className="text-gray-400 ml-2">→ {r.email_inkommen}</span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full ${smsStatusFarg(lokalStatus[r.id] ?? r.status)}`}>
                  {smsStatusLabel(lokalStatus[r.id] ?? r.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hjälpfunktioner ───────────────────────────────────────────

function SektionKnapp({ aktiv, onClick, label }: { aktiv: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        aktiv ? 'bg-[#0066CC] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

function statusIkon(s: string) {
  if (s === 'skickad') return '✅'
  if (s === 'redan_inbjuden') return '⚠️'
  if (s === 'redan_registrerad') return 'ℹ️'
  return '❌'
}

function statusText(s: string) {
  if (s === 'skickad') return 'Inbjudan skickad'
  if (s === 'redan_inbjuden') return 'Redan inbjuden'
  if (s === 'redan_registrerad') return 'Redan registrerad'
  return 'Misslyckades'
}

function statusBadgeFarg(s: string) {
  if (s === 'accepterad') return 'bg-green-100 text-green-700'
  if (s === 'skickad') return 'bg-blue-100 text-blue-700'
  return 'bg-red-100 text-red-700'
}

function smsStatusLabel(s: string) {
  if (s === 'skickad') return 'Inväntar e-post'
  if (s === 'email_inkommen') return 'E-post inkommen'
  if (s === 'inbjudan_skickad') return 'Inbjudan skickad'
  return s
}

function smsStatusFarg(s: string) {
  if (s === 'inbjudan_skickad') return 'bg-green-100 text-green-700'
  if (s === 'email_inkommen') return 'bg-amber-100 text-amber-700'
  return 'bg-blue-100 text-blue-700'
}

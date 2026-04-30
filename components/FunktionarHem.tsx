'use client'

import type { TilldelningInfo, ProfilData } from '@/components/FunktionarApp'

interface Props {
  profil: ProfilData
  tilldelning: TilldelningInfo
  onGåTillProfil: () => void
}

function formatTid(iso: string) {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

export default function FunktionarHem({ profil, tilldelning, onGåTillProfil }: Props) {
  const namn = profil.full_name ?? profil.email ?? 'Funktionär'
  const arRegistrerad = !!profil.registrerad_at

  return (
    <div className="p-4 space-y-3">

      {/* Hälsning */}
      <p className="text-sm text-gray-500">
        Välkommen, <span className="font-medium text-gray-800">{namn}</span>
      </p>

      {/* Tilldelning — hjältekort */}
      {tilldelning ? (
        <div
          className="rounded-2xl p-4 text-white"
          style={{ background: tilldelning.sektion_farg || '#0066CC' }}
        >
          <p className="text-xs opacity-75 mb-0.5">Din sektion</p>
          <h2 className="text-xl font-bold">{tilldelning.sektion_namn}</h2>
          <p className="text-sm opacity-85 mt-1">
            {formatTid(tilldelning.starttid)} – {formatTid(tilldelning.sluttid)} · {tilldelning.pass_namn}
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-0.5">Pass ej tilldelat ännu</p>
          <p className="text-xs text-amber-700">
            Tävlingsledningen meddelar dig när du är tilldelad en sektion och ett pass.
          </p>
        </div>
      )}

      {/* Sektionsledare */}
      {tilldelning && (tilldelning.sektionsledare_namn || tilldelning.sektionsledare_email) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Sektionsledare</p>
          <p className="text-sm font-medium text-gray-800">{tilldelning.sektionsledare_namn}</p>
          {tilldelning.sektionsledare_email && (
            <a
              href={`mailto:${tilldelning.sektionsledare_email}`}
              className="text-xs text-[#0066CC] mt-0.5 block"
            >
              {tilldelning.sektionsledare_email}
            </a>
          )}
        </div>
      )}

      {/* Tävlingsinfo */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-700 mb-3">Tävlingsinfo</p>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-400">Datum</dt>
            <dd className="font-medium text-gray-800">9 aug 2026</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">Plats</dt>
            <dd className="font-medium text-gray-800">Stora Skuggan</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">Adress</dt>
            <dd className="font-medium text-gray-800">Fiskartorpsvägen, Djurgården</dd>
          </div>
        </dl>
        <a
          href="https://maps.google.com/?q=Stora+Skuggan+Stockholm"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 text-xs text-[#0066CC]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          Öppna i Google Maps
        </a>
      </div>

      {/* Registrering-uppmaning */}
      {!arRegistrerad && (
        <button
          onClick={onGåTillProfil}
          className="w-full bg-white border border-amber-300 rounded-2xl p-4 text-left"
        >
          <div className="flex items-start gap-3">
            <span className="text-lg">📋</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Fyll i din profil</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Hjälper tävlingsledningen att planera bemanningen.
              </p>
            </div>
          </div>
        </button>
      )}

      <p className="text-center text-xs text-gray-300 pt-2">
        Frågor? Kontakta din sektionsledare.
      </p>
    </div>
  )
}

import { headers } from 'next/headers'

/**
 * Härleder produktions-URL från request-headers.
 * Fungerar i alla miljöer (lokal, Vercel preview, produktion)
 * utan att lita på NEXT_PUBLIC_SITE_URL.
 *
 * Vercel sätter x-forwarded-host i produktion; lokalt används host-headern.
 */
export async function getSiteUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  return `${proto}://${host}`
}

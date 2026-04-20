import type { NextConfig } from "next";

// ── HTTP Security Headers ──────────────────────────────────────
// Skyddar mot clickjacking, MIME-sniffing och XSS.
const securityHeaders = [
  // Förbjud inbäddning i iframe (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Hindra MIME-type-sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Begränsa referrer-info vid cross-origin-navigering
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Grundläggande CSP: tillåt Supabase och samma origin
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js kräver 'unsafe-inline' för styles/scripts under dev;
      // i prod ersätts detta med nonce-baserad CSP när projektet mognar.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co"} https://api.46elks.com`,
      "img-src 'self' data:",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  // Tvinga HTTPS i 1 år (aktiveras automatiskt av Vercel, men explicit är bättre)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // TODO: Ta bort när npm install @supabase/supabase-js@2.48.1 körts lokalt
  // och ny package-lock.json committats. Se CONTEXT.md.


  async headers() {
    return [
      {
        // Applicera på alla routes utom Next.js interna resurser
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

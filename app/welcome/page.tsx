import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

/**
 * Sprint 0 — Funktionär-välkomstsida.
 * Walking skeleton: visar bekräftelse att inloggning fungerar.
 * Sprint 4+ lägger till schema och uppdrags-vy.
 */
export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const name = profile?.full_name ?? profile?.email ?? "Funktionär";

  return (
    <div className="min-h-screen bg-brand-light flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-brand-dark">
          STHLM <span className="text-brand-orange">Triathlon</span>
        </span>
        <SignOutButton />
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">🏅</div>
          <h1 className="text-2xl font-bold text-brand-dark mb-2">
            Välkommen, {name}!
          </h1>
          <p className="text-gray-500 mb-6">
            Du är registrerad som funktionär för STHLM Triathlon 2026.
            <br />
            Ditt schema och dina uppdrag visas här när tävlingsledaren
            har satt upp dem.
          </p>

          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-left">
            <h2 className="font-semibold text-brand-dark mb-3 text-sm uppercase tracking-wide">
              Tävlingsinformation
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Datum</dt>
                <dd className="font-medium">9 augusti 2026</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Plats</dt>
                <dd className="font-medium">Stora Skuggan, Djurgården</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Ditt schema</dt>
                <dd className="text-gray-400 italic">Kommer snart</dd>
              </div>
            </dl>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            Frågor? Kontakta din sektionsledare eller tävlingsledningen.
          </p>
        </div>
      </main>
    </div>
  );
}

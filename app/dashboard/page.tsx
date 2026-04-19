import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

/**
 * Sprint 0 — Tävlingsledare dashboard.
 * Walking skeleton: autentiserat skal, inga funktioner ännu.
 * Sprint 1+ fyller i innehåll.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "tl" && profile.role !== "sektionsledare")) {
    redirect("/welcome");
  }

  const greeting = profile.full_name
    ? `Hej, ${profile.full_name}!`
    : `Hej!`;

  const roleLabel =
    profile.role === "tl" ? "Tävlingsledare" : "Sektionsledare";

  return (
    <div className="min-h-screen bg-brand-light">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-brand-dark">
            STHLM <span className="text-brand-orange">Triathlon</span>
          </span>
          <span className="text-xs bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full font-medium">
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block">{profile.email}</span>
          <SignOutButton />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-brand-dark mb-1">{greeting}</h1>
        <p className="text-gray-500 mb-10">
          9 augusti 2026 · Stora Skuggan, Djurgården
        </p>

        {/* Placeholder cards — Sprint 1+ replaces with real content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Funktionärer", value: "—", icon: "👥", sprint: "Sprint 1" },
            { label: "Sektioner", value: "—", icon: "🏊", sprint: "Sprint 1" },
            { label: "Schemalagda", value: "—", icon: "📅", sprint: "Sprint 2" },
            { label: "Konflikter", value: "—", icon: "⚠️", sprint: "Sprint 2" },
            { label: "Inbjudningar skickade", value: "—", icon: "📧", sprint: "Sprint 3" },
            { label: "Bekräftade", value: "—", icon: "✅", sprint: "Sprint 3" },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-brand-dark mt-1">{card.value}</p>
                </div>
                <span className="text-2xl">{card.icon}</span>
              </div>
              <p className="mt-3 text-xs text-gray-400">Implementeras i {card.sprint}</p>
            </div>
          ))}
        </div>

        {/* Sprint progress banner */}
        <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-5">
          <h2 className="font-semibold text-brand-dark mb-1">🚀 Sprint 0 klar — Walking Skeleton</h2>
          <p className="text-sm text-gray-600">
            Hela kedjan Next.js → Supabase → Vercel är uppkopplad och fungerar. 
            Inloggning med magic link, rollbaserad routing och databas är på plats.
            Sprint 1 börjar nu med funktionärsregistrering och sektionskonfiguration.
          </p>
        </div>
      </main>
    </div>
  );
}

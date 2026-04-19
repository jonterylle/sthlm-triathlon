"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Map Supabase error messages → user-friendly Swedish text
const ERROR_MESSAGES: Record<string, string> = {
  "Email rate limit exceeded":
    "För många försök. Vänta en stund och försök igen.",
  "Signups not allowed":
    "Din e-postadress är inte registrerad. Kontakta tävlingsledningen.",
  "Invalid email":
    "Ange en giltig e-postadress.",
};

function getFriendlyError(msg: string): string {
  return (
    ERROR_MESSAGES[msg] ??
    "Något gick fel. Försök igen eller kontakta tävlingsledningen."
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(getFriendlyError(error.message));
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light px-4">
      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">
            STHLM <span className="text-brand-orange">Triathlon</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">9 augusti 2026 · Stora Skuggan</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {status === "sent" ? (
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="text-lg font-semibold text-brand-dark mb-2">
                Kolla din e-post!
              </h2>
              <p className="text-sm text-gray-500">
                Vi har skickat en inloggningslänk till{" "}
                <span className="font-medium text-brand-dark">{email}</span>.
                Klicka på länken för att logga in.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-4 text-sm text-brand-blue underline"
              >
                Använd en annan adress
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-brand-dark mb-1">
                Logga in
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Du får en inloggningslänk direkt till din e-post — inget lösenord behövs.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    E-postadress
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="din@epost.se"
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue
                               transition"
                  />
                </div>

                {status === "error" && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-brand-blue text-white rounded-lg py-2.5 text-sm font-medium
                             hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed
                             transition"
                >
                  {status === "loading" ? "Skickar…" : "Skicka inloggningslänk"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Problem med inloggningen? Kontakta tävlingsledningen.
        </p>
      </div>
    </div>
  );
}

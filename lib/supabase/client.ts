import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client for use in browser (Client Components).
 * Call this inside a component — do NOT instantiate at module level.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Implicit flow: magic-link-token levereras som hash (#access_token=…)
        // i stället för PKCE-kod. Löser cross-device-problemet där
        // code_verifier saknas om länken öppnas i annan webbläsare/enhet.
        flowType: 'implicit',
      },
    }
  );
}

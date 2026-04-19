/**
 * Minimal type stubs for Sprint 0.
 * Run `supabase gen types typescript` in later sprints to auto-generate.
 */

export type UserRole = "tl" | "sektionsledare" | "funktionar";

export interface Profile {
  id: string;               // UUID — matches auth.users.id
  email: string;
  full_name: string | null;
  role: UserRole;
  section_id: string | null;
  created_at: string;
  updated_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
  };
};

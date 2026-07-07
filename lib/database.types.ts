export type UserRole = 'tl' | 'sektionsledare' | 'funktionar'
export type TilldelningStatus = 'bekraftad' | 'avbokad' | 'standby'
export type SektionStatus = 'full' | 'delvis' | 'tom'
export type SektionOmrade = 'simning' | 't1' | 'cykling' | 'lopning' | 'arena_t2' | 'ovrigt'

export type PushSubscription = {
  id: string
  profil_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

// ── Tabelltyper (type alias, inte interface — krävs för Supabase SDK:s conditional types) ──

export type Profile = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  telefon: string | null
  klubb: string | null
  sektion_preferens: string | null
  pass_preferens: string | null
  kompetenser: string[] | null
  erfarenhet: string | null
  specialkost: string | null
  registrerad_at: string | null
  created_at: string
  updated_at: string
}

export type Sektion = {
  id: string
  namn: string
  beskrivning: string | null
  farg: string
  omrade: SektionOmrade
  lat: number | null
  lng: number | null
  behovs_antal: number
  sortorder: number
  skapad_av: string | null
  created_at: string
  updated_at: string
}

export type Pass = {
  id: string
  sektion_id: string
  namn: string
  datum: string
  starttid: string
  sluttid: string
  behovs_antal: number
  kompetenser: string[]
  maps_url: string | null
  klader_utrustning: string | null
  instruktion: string | null
  created_at: string
}

export type Tilldelning = {
  id: string
  profil_id: string
  pass_id: string
  status: TilldelningStatus
  notering: string | null
  tilldelad_av: string | null
  mat_utdelad: boolean
  created_at: string
  updated_at: string
}

export type MinSektionRad = {
  sektion_id: string
  sektion_namn: string
  sektion_farg: string
  pass_id: string
  pass_namn: string
  datum: string
  starttid: string
  sluttid: string
  behovs_antal: number
  maps_url: string | null
  klader_utrustning: string | null
  instruktion: string | null
  tilldelning_id: string | null
  profil_id: string | null
  full_name: string | null
  email: string | null
  telefon: string | null
  kompetenser: string[] | null
  notering: string | null
  mat_utdelad: boolean | null
}

export type SektionsledareInfo = {
  id: string
  full_name: string | null
  email: string
  sektion_preferens: string | null
  sektion_namn: string | null
}

export type Inbjudan = {
  id: string
  email: string
  skickad_av: string | null
  skickad_at: string
  status: 'skickad' | 'accepterad' | 'fel'
  felmeddelande: string | null
  roll: UserRole
}

export type SMSInbjudan = {
  id: string
  telefon: string
  token: string
  skickad_av: string | null
  skickad_at: string
  email_inkommen: string | null
  email_inkommen_at: string | null
  status: 'skickad' | 'email_inkommen' | 'inbjudan_skickad'
}

// ── RPC-returtyper ───────────────────────────────────────────────

export type SMSInbjudanPublik = {
  id: string
  email_inkommen: string | null
  status: string
  expires_at: string
}

// ── Vytyper ──────────────────────────────────────────────────────

export type SektionBemanningsgrad = {
  id: string
  namn: string
  beskrivning: string | null
  farg: string
  lat: number | null
  lng: number | null
  sortorder: number
  omrade: SektionOmrade
  behovs_totalt: number
  tilldelade_totalt: number
  saknas_totalt: number
  status: SektionStatus
}

export type PassBemanningsgrad = {
  pass_id: string
  sektion_id: string
  pass_namn: string
  starttid: string
  sluttid: string
  behovs_antal: number
  tilldelade: number
  saknas: number
}

export type OtilldeladFunktionar = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  telefon: string | null
  kompetenser: string[] | null
  sektion_preferens: string | null
  pass_preferens: string | null
  registrerad_at: string | null
  created_at: string
  updated_at: string
}

// Alla funktionärer med räknare på aktiva pass — används i tilldelningsflödet
export type FunktionarForTilldelning = OtilldeladFunktionar & {
  antal_pass: number
}

export type PassMedSektion = {
  pass_id: string
  pass_namn: string
  datum: string
  starttid: string
  sluttid: string
  behovs_antal: number
  tilldelade: number
  saknas: number
  sektion_id: string
  sektion_namn: string
  sektion_farg: string
  kompetenser: string[]
  maps_url: string | null
  klader_utrustning: string | null
  instruktion: string | null
}

export type TilldeladPerPass = {
  tilldelning_id: string
  profil_id: string
  full_name: string | null
  email: string
  telefon: string | null
  kompetenser: string[] | null
  pass_id: string
  pass_namn: string
  starttid: string
  sluttid: string
  sektion_id: string
  notering: string | null
}

// Koppling SL → sektion (från sektion_sektionsledare via RPC)
export type SektionSL = {
  sektion_id: string
  profil_id: string
  full_name: string | null
  email: string
}

// ── Database-typ för Supabase-klienten ───────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
        Relationships: []
      }
      sektioner: {
        Row: Sektion
        Insert: Omit<Sektion, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Sektion, 'id' | 'created_at'>>
        Relationships: []
      }
      pass: {
        Row: Pass
        Insert: Omit<Pass, 'id' | 'created_at'>
        Update: Partial<Omit<Pass, 'id' | 'created_at'>>
        Relationships: []
      }
      tilldelningar: {
        Row: Tilldelning
        Insert: Omit<Tilldelning, 'id' | 'created_at' | 'updated_at' | 'mat_utdelad'> & { mat_utdelad?: boolean }
        Update: Partial<Omit<Tilldelning, 'id' | 'created_at'>>
        Relationships: []
      }
      inbjudningar: {
        Row: Inbjudan
        Insert: Omit<Inbjudan, 'id' | 'skickad_at' | 'felmeddelande'> & { felmeddelande?: string | null; roll?: UserRole }
        Update: Partial<Omit<Inbjudan, 'id'>>
        Relationships: []
      }
      sms_inbjudningar: {
        Row: SMSInbjudan
        Insert: Omit<SMSInbjudan, 'id' | 'skickad_at' | 'token' | 'status' | 'email_inkommen' | 'email_inkommen_at'> & {
          status?: SMSInbjudan['status']
          email_inkommen?: string | null
          email_inkommen_at?: string | null
        }
        Update: Partial<Omit<SMSInbjudan, 'id'>>
        Relationships: []
      }
      push_subscriptions: {
        Row: PushSubscription
        Insert: Omit<PushSubscription, 'id' | 'created_at'>
        Update: Partial<Omit<PushSubscription, 'id'>>
        Relationships: []
      }
      sektion_sektionsledare: {
        Row: { sektion_id: string; profil_id: string; skapad_at: string }
        Insert: { sektion_id: string; profil_id: string; skapad_at?: string }
        Update: Partial<{ sektion_id: string; profil_id: string }>
        Relationships: []
      }
    }
    Views: {
      sektion_bemanningsgrad: { Row: SektionBemanningsgrad; Relationships: [] }
      pass_bemanningsgrad: { Row: PassBemanningsgrad; Relationships: [] }
      otilldelade_funktionarer: { Row: OtilldeladFunktionar; Relationships: [] }
    }
    Functions: {
      get_otilldelade_funktionarer: {
        Args: Record<string, never>
        Returns: OtilldeladFunktionar[]
      }
      get_funktionarer_for_tilldelning: {
        Args: Record<string, never>
        Returns: FunktionarForTilldelning[]
      }
      get_pass_med_sektioner: {
        Args: Record<string, never>
        Returns: PassMedSektion[]
      }
      get_tilldelade_per_pass: {
        Args: Record<string, never>
        Returns: TilldeladPerPass[]
      }
      get_min_sektion_data: {
        Args: Record<string, never>
        Returns: MinSektionRad[]
      }
      get_sektionsledare: {
        Args: Record<string, never>
        Returns: SektionsledareInfo[]
      }
      get_sektionsledare_per_sektion: {
        Args: Record<string, never>
        Returns: SektionSL[]
      }
      hamta_sms_inbjudan: {
        Args: { p_token: string }
        Returns: SMSInbjudanPublik[]
      }
      registrera_email_for_sms_inbjudan: {
        Args: { p_token: string; p_email: string }
        Returns: string  // 'ok' | 'ogiltig_token' | 'redan_registrerad' | 'utgangen'
      }
    }
    Enums: {
      user_role: UserRole
      sektion_omrade: SektionOmrade
    }
  }
}

export type UserRole = 'tl' | 'sektionsledare' | 'funktionar'
export type TilldelningStatus = 'bekraftad' | 'avbokad' | 'standby'
export type SektionStatus = 'full' | 'delvis' | 'tom'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Sektion {
  id: string
  namn: string
  beskrivning: string | null
  farg: string
  lat: number | null
  lng: number | null
  behovs_antal: number
  sortorder: number
  skapad_av: string | null
  created_at: string
  updated_at: string
}

export interface Pass {
  id: string
  sektion_id: string
  namn: string
  starttid: string
  sluttid: string
  behovs_antal: number
  created_at: string
}

export interface Tilldelning {
  id: string
  profil_id: string
  pass_id: string
  status: TilldelningStatus
  notering: string | null
  tilldelad_av: string | null
  created_at: string
  updated_at: string
}

// Views
export interface SektionBemanningsgrad {
  id: string
  namn: string
  beskrivning: string | null
  farg: string
  lat: number | null
  lng: number | null
  sortorder: number
  behovs_totalt: number
  tilldelade_totalt: number
  saknas_totalt: number
  status: SektionStatus
}

export interface PassBemanningsgrad {
  pass_id: string
  sektion_id: string
  pass_namn: string
  starttid: string
  sluttid: string
  behovs_antal: number
  tilldelade: number
  saknas: number
}

export interface OtilldeladFunktionar {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Inbjudan {
  id: string
  email: string
  skickad_av: string | null
  skickad_at: string
  status: 'skickad' | 'accepterad' | 'fel'
  felmeddelande: string | null
}

export interface SMSInbjudan {
  id: string
  telefon: string
  token: string
  skickad_av: string | null
  skickad_at: string
  email_inkommen: string | null
  email_inkommen_at: string | null
  status: 'skickad' | 'email_inkommen' | 'inbjudan_skickad'
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      sektioner: {
        Row: Sektion
        Insert: Omit<Sektion, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Sektion, 'id' | 'created_at'>>
      }
      pass: {
        Row: Pass
        Insert: Omit<Pass, 'id' | 'created_at'>
        Update: Partial<Omit<Pass, 'id' | 'created_at'>>
      }
      tilldelningar: {
        Row: Tilldelning
        Insert: Omit<Tilldelning, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Tilldelning, 'id' | 'created_at'>>
      }
      inbjudningar: {
        Row: Inbjudan
        Insert: Omit<Inbjudan, 'id' | 'skickad_at'>
        Update: Partial<Omit<Inbjudan, 'id'>>
      }
      sms_inbjudningar: {
        Row: SMSInbjudan
        Insert: Omit<SMSInbjudan, 'id' | 'skickad_at' | 'token'>
        Update: Partial<Omit<SMSInbjudan, 'id'>>
      }
    }
    Views: {
      sektion_bemanningsgrad: { Row: SektionBemanningsgrad }
      pass_bemanningsgrad: { Row: PassBemanningsgrad }
      otilldelade_funktionarer: { Row: OtilldeladFunktionar }
    }
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
    }
  }
}

export interface Swimmer {
  id: string
  name: string
  birthYear: number
  club: string
  avatarColor: string
  myresultsName?: string       // e.g. "URBAN Herman" (LASTNAME Firstname)
  myresultsMeetIds?: string[]  // meet IDs linked to this swimmer
}

export interface SwimTime {
  id: string
  swimmerId: string
  event: string
  course: 'LB' | 'KB'
  timeMs: number
  date: string
  competition?: string
  isPersonalBest?: boolean
}

export interface Competition {
  id: string
  name: string
  location: string
  startDate: string
  endDate: string
  course: 'LB' | 'KB'
  organizer?: string
  url?: string
  pdfUrl?: string
  swimmerId?: string
  status: 'upcoming' | 'ongoing' | 'past'
  registered?: boolean
}

export interface PDFDocument {
  id: string
  name: string
  competitionId?: string
  uploadedAt: string
  size: number
  dataUrl: string
}

export type NavItem = 'dashboard' | 'calendar' | 'zeiten' | 'ergebnisse' | 'dokumente'

// --- Phase 2: myresults.eu types ---

export interface MeetSummary {
  id: string           // "2365"
  name: string         // "Finalwettkämpfe der Österr. ..."
  startDate: string    // "2026-06-27"
  endDate: string      // "2026-06-28"
  location: string     // "BSFZ Südstadt"
  organizer: string    // "Österreichischer Schwimmverband"
  course: 'LB' | 'KB'
  status: 'upcoming' | 'today' | 'recent'
  hasLive: boolean
}

export interface MeetEvent {
  id: string       // "84203"
  number: number   // 1
  name: string     // "100m Schmetterling Damen"
  session: string  // "Samstag 27.06.2026 - 1. Abschnitt"
}

export interface SwimResult {
  rank: number
  name: string          // "DOLGOPOLOVA Kristina"
  birthYear: number     // 2021
  club: string          // "VIENNA AQUATIC SC"
  timeMs: number        // milliseconds; 0 = DNS/DSQ/DNF
  participantId: string // myresults.eu participant ID
}

export interface LiveResult {
  status: number        // -1 = no live session, 0 = active
  event?: string        // "100m Freistil Damen"
  results?: SwimResult[]
}

export interface SwimmerResult {
  meetId: string
  meetName: string
  meetDate: string      // startDate of the meet
  eventId: string
  eventName: string     // raw name, e.g. "100m Freistil Herren"
  course: 'LB' | 'KB'
  result: SwimResult
}

// --- Mermaids App types ---

export type Role = 'admin' | 'trainer' | 'eltern' | 'mitglied'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatar_color: string
  created_at: string
}

export interface Invitation {
  id: string
  email: string
  role: Role
  expires_at: string
}

export interface Document {
  id: string
  name: string
  category: 'anmeldeformular' | 'vereinsdokument' | 'sonstiges'
  filename: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}

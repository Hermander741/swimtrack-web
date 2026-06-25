export interface Swimmer {
  id: string
  name: string
  birthYear: number
  club: string
  avatarColor: string
}

export interface SwimTime {
  id: string
  swimmerId: string
  event: string // e.g. "100m Freistil"
  course: 'LB' | 'KB' // Langbahn / Kurzbahn
  timeMs: number // milliseconds
  date: string // ISO date string
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
  swimmerId?: string // if assigned to a swimmer
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

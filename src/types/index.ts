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
  avatar_url?: string
  created_at: string
  myresults_name?: string
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

// --- Mermaids Chat types ---

export type MinRole = 'admin' | 'trainer' | 'eltern' | 'mitglied'

export interface Channel {
  id: string
  name: string
  description: string | null
  min_role: MinRole
  created_by: string | null
  is_archived: boolean
  created_at: string
  avatar_url: string | null
  last_message_id?: string | null
}

export interface MessageAttachment {
  id: string
  message_id: string | null
  filename: string
  original_name: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface MessageReaction {
  emoji: string
  user_id: string
  user_name: string
  message_id?: string
}

export interface Message {
  id: string
  channel_id: string
  sender_id: string | null
  sender_name: string | null
  sender_avatar_color: string | null
  sender_avatar_url: string | null
  content: string | null
  reply_to: string | null
  reply_preview: string | null
  edited_at: string | null
  deleted_for_all: boolean
  attachments: MessageAttachment[]
  reactions: MessageReaction[]
  created_at: string
}

export interface PinnedMessage {
  id: string
  channel_id: string
  message_id: string
  content: string | null
  sender_name: string | null
  message_created_at: string
  pinned_by: string | null
  pinned_at: string
}

// --- Mermaids Training types ---

export type BlockCategory = 'aufwaermen' | 'hauptset' | 'abkuehlen' | 'kraft' | 'technik' | 'sonstiges'

export interface TrainingGroup {
  id: string
  name: string
  description: string | null
  color: string
  channel_id: string | null
  created_by: string | null
  created_at: string
}

export interface TrainingGroupMember {
  user_id: string
  name: string
  email: string
  role: Role
  avatar_color: string
  added_at: string
}

export interface TrainingBlock {
  id: string
  name: string
  category: BlockCategory
  distance_m: number | null
  stroke: string | null
  reps: number | null
  rest_s: number | null
  description: string | null
  created_by: string | null
  created_at: string
}

export interface TrainingTemplateBlock {
  template_id: string
  block_id: string
  position: number
  override_note: string | null
  name: string
  category: BlockCategory
  distance_m: number | null
  stroke: string | null
  reps: number | null
  rest_s: number | null
  description: string | null
}

export interface TrainingTemplate {
  id: string
  group_id: string
  day_of_week: number
  start_time: string
  duration_min: number
  location: string | null
  title: string
  is_active: boolean
  created_by: string | null
  created_at: string
  blocks: TrainingTemplateBlock[]
}

export interface TrainingSessionBlock {
  session_id: string
  block_id: string | null
  position: number
  name: string
  category: BlockCategory
  distance_m: number | null
  stroke: string | null
  reps: number | null
  rest_s: number | null
  description: string | null
  override_note: string | null
}

export interface TrainingSession {
  id: string
  group_id: string | null
  template_id: string | null
  title: string
  date: string
  start_time: string
  duration_min: number
  location: string | null
  notes: string | null
  is_cancelled: boolean
  is_external: boolean
  created_by: string | null
  created_at: string
  group_name?: string | null
  group_color?: string | null
  blocks?: TrainingSessionBlock[]
}

export interface ICalToken {
  id: string
  token: string
  created_at: string
}

export interface SessionAttendanceTrainer {
  attendance: string[]
}

export interface SessionAttendanceMember {
  present: boolean
}

export type SessionAttendance = SessionAttendanceTrainer | SessionAttendanceMember

export interface SessionEntry {
  id: string
  session_id: string
  user_id: string
  note: string | null
  distance_m: number | null
  rating: 1 | 2 | 3 | null
  created_at: string
  updated_at: string
}

// --- Zeiten types ---

export interface SwimTimeEntry {
  id: string
  user_id: string
  user_name: string
  avatar_color: string
  avatar_url?: string
  event: string
  course: 'LB' | 'KB' | 'OW'
  time_ms: number
  date: string              // ISO date "YYYY-MM-DD"
  competition: string | null
  created_by: string | null
  created_at: string
  is_pb: boolean
}

export interface ZeitenListResponse {
  items: SwimTimeEntry[]
  total: number
}

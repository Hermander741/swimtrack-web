export interface MeetSummary {
  id: string
  name: string
  startDate: string
  endDate: string
  location: string
  organizer: string
  course: 'LB' | 'KB'
  status: 'upcoming' | 'today' | 'recent'
  hasLive: boolean
}

export interface MeetEvent {
  id: string
  number: number
  name: string
  session: string
}

export interface SwimResult {
  rank: number
  name: string
  birthYear: number
  club: string
  timeMs: number
  participantId: string
}

export interface LiveResult {
  status: number
  event?: string
  results?: SwimResult[]
}

export interface SwimmerResult {
  meetId: string
  meetName: string
  meetDate: string
  eventId: string
  eventName: string
  course: 'LB' | 'KB'
  result: SwimResult
}

export type ApiOk<T> = { ok: true; data: T }
export type ApiError = { ok: false; error: string }
export type ApiResponse<T> = ApiOk<T> | ApiError

export function ok<T>(data: T): ApiOk<T> { return { ok: true, data } }
export function err(error: string): ApiError { return { ok: false, error } }

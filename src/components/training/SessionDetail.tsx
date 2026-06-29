import { useState, useEffect } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { X, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import type { TrainingSession, TrainingGroupMember, SessionEntry } from '../../types'
import { BlockItem } from './BlockItem'
import {
  getAttendance, markAttendance, removeAttendance,
  getEntry, upsertEntry, deleteEntry, deleteSession,
  listGroupMembers,
} from '../../api/training'

interface SessionDetailProps {
  session: TrainingSession
  onClose: () => void
  onDeleted?: () => void
}

const RATING_ICONS: Record<number, string> = { 1: '👎', 2: '😐', 3: '👍' }

export function SessionDetail({ session, onClose, onDeleted }: SessionDetailProps) {
  const { user } = useAuth()
  const dateStr = format(parseISO(session.date), 'EEEE, d. MMMM yyyy', { locale: de })
  const time = session.start_time.slice(0, 5)
  const color = session.is_external ? '#F97316' : (session.group_color ?? '#0EA5E9')
  const isTrainer = user?.role === 'trainer' || user?.role === 'admin'

  // Attendance state (trainer/admin only)
  const [attendedIds, setAttendedIds] = useState<string[]>([])
  const [members, setMembers] = useState<TrainingGroupMember[]>([])

  // Entry state (all users)
  const [entry, setEntry] = useState<SessionEntry | null>(null)
  const [note, setNote] = useState('')
  const [distanceM, setDistanceM] = useState('')
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null)
  const [savingEntry, setSavingEntry] = useState(false)

  // 90-day window check: today - 90 days
  const cutoff = subDays(new Date(), 90)
  const sessionDate = parseISO(session.date)
  const inEntryWindow = sessionDate >= cutoff

  useEffect(() => {
    if (isTrainer && session.group_id) {
      getAttendance(session.id).then(res => {
        if (res.ok && 'attendance' in res.data) setAttendedIds(res.data.attendance)
      })
      listGroupMembers(session.group_id).then(res => {
        if (res.ok) setMembers(res.data)
      })
    }
    if (inEntryWindow) {
      getEntry(session.id).then(res => {
        if (res.ok && res.data) {
          setEntry(res.data)
          setNote(res.data.note ?? '')
          setDistanceM(res.data.distance_m != null ? String(res.data.distance_m) : '')
          setRating(res.data.rating)
        }
      })
    }
  }, [session.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleAttendance(userId: string) {
    const present = attendedIds.includes(userId)
    // Optimistic update
    setAttendedIds(prev => present ? prev.filter(id => id !== userId) : [...prev, userId])
    const res = present
      ? await removeAttendance(session.id, userId)
      : await markAttendance(session.id, userId)
    if (!res.ok) {
      // Revert on error
      setAttendedIds(prev => present ? [...prev, userId] : prev.filter(id => id !== userId))
    }
  }

  async function handleSaveEntry() {
    setSavingEntry(true)
    try {
      const res = await upsertEntry(session.id, {
        note: note.trim() || undefined,
        distance_m: distanceM ? parseInt(distanceM, 10) : undefined,
        rating: rating ?? undefined,
      })
      if (res.ok) setEntry(res.data)
    } finally {
      setSavingEntry(false)
    }
  }

  async function handleDeleteEntry() {
    const res = await deleteEntry(session.id)
    if (res.ok) { setEntry(null); setNote(''); setDistanceM(''); setRating(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full glass rounded-t-3xl pb-8 safe-bottom animate-in slide-in-from-bottom max-h-[90dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-4 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
          {isTrainer && (
            <button
              onClick={async () => {
                if (!confirm('Session löschen?')) return
                const res = await deleteSession(session.id)
                if (res.ok) { onDeleted?.(); onClose() }
              }}
              className="absolute left-4 top-4 p-2 text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button onClick={onClose} className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto scrollbar-none px-6 pb-4">
          {session.is_cancelled && (
            <div className="mb-4 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-2 text-red-400 text-sm text-center">
              Diese Einheit wurde abgesagt
            </div>
          )}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
            <div>
              <h2 className={`text-xl font-bold text-white ${session.is_cancelled ? 'line-through opacity-60' : ''}`}>
                {session.title}
              </h2>
              {session.group_name && <p className="text-sm text-slate-400 mt-0.5">{session.group_name}</p>}
            </div>
          </div>
          <div className="space-y-2 mb-4 text-sm text-slate-300">
            <div className="flex gap-3"><span className="text-slate-500 w-14 flex-shrink-0">Datum</span><span>{dateStr}</span></div>
            <div className="flex gap-3"><span className="text-slate-500 w-14 flex-shrink-0">Zeit</span><span>{time} Uhr · {session.duration_min} min</span></div>
            {session.location && <div className="flex gap-3"><span className="text-slate-500 w-14 flex-shrink-0">Ort</span><span>{session.location}</span></div>}
          </div>

          {session.blocks && session.blocks.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Trainingsinhalt</h3>
              <div className="glass rounded-xl px-4">
                {session.blocks.map(b => <BlockItem key={b.position} block={b} />)}
              </div>
            </div>
          )}
          {session.notes && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notizen</h3>
              <p className="text-sm text-slate-300">{session.notes}</p>
            </div>
          )}

          {/* Attendance section — trainer/admin only */}
          {isTrainer && session.group_id && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Anwesenheit</h3>
              <div className="glass rounded-xl divide-y divide-white/10">
                {members.map(m => {
                  const present = attendedIds.includes(m.user_id)
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => toggleAttendance(m.user_id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${present ? 'bg-teal-500 border-teal-500' : 'border-slate-600'}`}>
                        {present && <span className="text-white text-xs leading-none">✓</span>}
                      </div>
                      <span className={`text-sm ${present ? 'text-white' : 'text-slate-400'}`}>
                        {m.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Entry section — all users, only within 90-day window */}
          {inEntryWindow && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mein Eintrag</h3>
                {entry && (
                  <button onClick={handleDeleteEntry} className="text-slate-500 hover:text-red-400 p-1 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="glass rounded-xl px-4 py-3 space-y-3">
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setRating(rating === r ? null : r)}
                      className={`flex-1 py-2 rounded-lg text-xl transition-colors ${rating === r ? 'bg-teal-500/30 ring-1 ring-teal-500' : 'bg-white/5 hover:bg-white/10'}`}
                    >
                      {RATING_ICONS[r]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Distanz"
                    value={distanceM}
                    onChange={e => setDistanceM(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    min={0}
                  />
                  <span className="text-slate-400 text-sm">m</span>
                </div>
                <textarea
                  placeholder="Notiz zur Einheit…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                />
                <button
                  onClick={handleSaveEntry}
                  disabled={savingEntry}
                  className="w-full py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingEntry ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

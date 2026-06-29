import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listUsers } from '../api/users'
import { listDocuments } from '../api/documents'
import { listSessions } from '../api/training'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import type { Document, TrainingSession } from '../types'

const DAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function formatSessionDate(date: string, start_time: string): string {
  const d = new Date(`${date}T${start_time}`)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const day = new Date(date); day.setHours(0, 0, 0, 0)
  const prefix = day.getTime() === today.getTime() ? 'Heute'
    : day.getTime() === tomorrow.getTime() ? 'Morgen'
    : `${DAYS_DE[d.getDay()]}, ${d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })}`
  return `${prefix} · ${start_time.slice(0, 5)} Uhr`
}

export function Dashboard() {
  const { user, isTrainer } = useAuth()
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [recentDocs, setRecentDocs] = useState<Document[]>([])
  const [docsError, setDocsError] = useState(false)
  const [nextSession, setNextSession] = useState<TrainingSession | null | undefined>(undefined)

  useEffect(() => {
    if (isTrainer) {
      listUsers().then(res => { if (res.ok) setMemberCount(res.data.length) })
    }
    listDocuments().then(res => {
      if (res.ok) setRecentDocs(res.data.slice(0, 3))
      else setDocsError(true)
    })
    const today = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)
    listSessions(today, in30).then(res => {
      if (res.ok) {
        const upcoming = res.data.filter(s => !s.is_cancelled)
        setNextSession(upcoming[0] ?? null)
      } else {
        setNextSession(null)
      }
    })
  }, [isTrainer])

  return (
    <PageShell
      title="Mermaids"
      topBarRight={
        <Link to="/profil">
          <Avatar name={user?.name ?? ''} color={user?.avatar_color} size="sm" />
        </Link>
      }
    >
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-slate-400 text-sm">Willkommen zurück</p>
        <h2 className="text-2xl font-bold text-white mt-0.5">{user?.name?.split(' ')[0]} 👋</h2>
      </div>

      {/* Next session card */}
      <Link to="/training">
        <Card className="mb-6 bg-gradient-to-br from-teal-500/20 to-sky-500/20 border-teal-500/20 glow-teal">
          <p className="text-xs text-teal-400 font-medium mb-1">Nächstes Training</p>
          {nextSession === undefined ? (
            <p className="text-slate-400 text-sm">Lade…</p>
          ) : nextSession === null ? (
            <p className="text-white font-semibold">Kein Termin geplant</p>
          ) : (
            <>
              <p className="text-white font-semibold">{nextSession.title}</p>
              <p className="text-slate-400 text-sm mt-1">{formatSessionDate(nextSession.date, nextSession.start_time)}{nextSession.location ? ` · ${nextSession.location}` : ''}</p>
              {nextSession.group_name && (
                <p className="text-xs mt-1.5" style={{ color: nextSession.group_color ?? '#14B8A6' }}>{nextSession.group_name}</p>
              )}
            </>
          )}
        </Card>
      </Link>

      {/* Quick stats */}
      {isTrainer && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <p className="text-3xl font-bold text-teal-400">{memberCount ?? '—'}</p>
            <p className="text-slate-400 text-sm mt-1">Mitglieder</p>
          </Card>
          <Card>
            <Link to="/dokumente">
              <p className="text-3xl font-bold text-sky-400">{recentDocs.length}</p>
              <p className="text-slate-400 text-sm mt-1">Dokumente</p>
            </Link>
          </Card>
        </div>
      )}

      {/* Recent documents */}
      {docsError ? (
        <p className="text-slate-400 text-sm py-4">Dokumente konnten nicht geladen werden.</p>
      ) : recentDocs.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Letzte Dokumente</p>
            <Link to="/dokumente" className="text-xs text-teal-400">Alle anzeigen</Link>
          </div>
          <div className="space-y-2">
            {recentDocs.map(doc => (
              <Card key={doc.id}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400 text-sm shrink-0">
                    📄
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-slate-400 text-xs">{new Date(doc.created_at).toLocaleDateString('de-AT')}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listUsers } from '../api/users'
import { listSessions } from '../api/training'
import { apiRequest } from '../api/client'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { Pin, ChevronRight } from 'lucide-react'
import type { TrainingSession } from '../types'

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

interface NewsPost {
  id: string
  title: string
  content: string
  pinned: boolean
  created_at: string
  author_name: string | null
}

interface Quote {
  id: string
  text: string
  attribution: string | null
}

export function Dashboard() {
  const { user, isTrainer } = useAuth()
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [nextSession, setNextSession] = useState<TrainingSession | null | undefined>(undefined)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [newsPosts, setNewsPosts] = useState<NewsPost[] | null>(null)

  useEffect(() => {
    if (isTrainer) {
      listUsers().then(res => { if (res.ok) setMemberCount(res.data.length) })
    }
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
    apiRequest<Quote>('/api/news/quote/today').then(res => {
      if (res.ok) setQuote(res.data)
    })
    apiRequest<NewsPost[]>('/api/news/posts').then(res => {
      if (res.ok) setNewsPosts(res.data.slice(0, 3))
      else setNewsPosts([])
    })
  }, [isTrainer])

  return (
    <PageShell
      title={
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="Mermaids" className="w-7 h-7 rounded-lg" />
          <h1 className="text-base font-semibold text-white">Mermaids</h1>
        </div>
      }
      topBarRight={
        <Link to="/profil">
          <Avatar name={user?.name ?? ''} color={user?.avatar_color} imageUrl={user?.avatar_url} size="sm" />
        </Link>
      }
    >
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-slate-400 text-sm">Willkommen zurück</p>
        <h2 className="text-2xl font-bold text-white mt-0.5">{user?.name?.split(' ')[0]} 👋</h2>
      </div>

      {/* Motivational quote */}
      {quote && (
        <div className="mb-6 px-4 py-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/15">
          <p className="text-slate-300 text-sm leading-relaxed italic">„{quote.text}"</p>
          {quote.attribution && (
            <p className="text-slate-500 text-xs mt-2">— {quote.attribution}</p>
          )}
        </div>
      )}

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

      {/* Trainer stats */}
      {isTrainer && memberCount !== null && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link to="/mitglieder">
            <Card>
              <p className="text-3xl font-bold text-teal-400">{memberCount}</p>
              <p className="text-slate-400 text-sm mt-1">Mitglieder</p>
            </Card>
          </Link>
          <Link to="/dokumente">
            <Card>
              <p className="text-3xl font-bold text-sky-400">📁</p>
              <p className="text-slate-400 text-sm mt-1">Dokumente</p>
            </Card>
          </Link>
        </div>
      )}

      {/* News preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">News</p>
          <Link to="/news" className="flex items-center gap-0.5 text-xs text-teal-400 hover:text-teal-300 transition-colors">
            Alle anzeigen <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {newsPosts === null ? (
          <p className="text-slate-400 text-sm py-4">Lade…</p>
        ) : newsPosts.length === 0 ? (
          <Card>
            <p className="text-slate-400 text-sm text-center py-2">Noch keine News vorhanden</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {newsPosts.map(post => (
              <Link to="/news" key={post.id}>
                <Card className="hover:border-white/20 transition-colors">
                  <div className="flex items-start gap-2">
                    {post.pinned && <Pin className="w-3 h-3 text-teal-400 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium leading-snug">{post.title}</p>
                      <p className="text-slate-400 text-xs line-clamp-2 mt-0.5">{post.content}</p>
                      <p className="text-slate-500 text-xs mt-1.5">
                        {post.author_name && `${post.author_name} · `}
                        {new Date(post.created_at).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}

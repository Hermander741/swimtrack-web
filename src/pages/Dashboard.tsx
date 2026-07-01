import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listSessions } from '../api/training'
import { apiRequest } from '../api/client'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { Pin, ChevronRight, Newspaper } from 'lucide-react'
import type { TrainingSession } from '../types'

const DAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000)
  if (days === 0) return 'Heute'
  if (days === 1) return 'Gestern'
  if (days < 7) return `vor ${days} Tagen`
  return new Date(iso).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })
}

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
  const { user } = useAuth()
  const [nextSession, setNextSession] = useState<TrainingSession | null | undefined>(undefined)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [newsPosts, setNewsPosts] = useState<NewsPost[] | null>(null)

  useEffect(() => {
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
      if (res.ok) setNewsPosts(res.data.slice(0, 5))
      else setNewsPosts([])
    })
  }, [])

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


      {/* News */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">News</p>
          <Link to="/news" className="flex items-center gap-0.5 text-xs text-teal-400 hover:text-teal-300 transition-colors">
            Alle anzeigen <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {newsPosts === null ? (
          <p className="text-slate-400 text-sm py-4 animate-pulse">Lade…</p>
        ) : newsPosts.length === 0 ? (
          <div className="text-center py-10">
            <Newspaper size={32} className="mx-auto mb-2 text-slate-700" />
            <p className="text-slate-500 text-sm">Noch keine News</p>
          </div>
        ) : (() => {
          const sorted = [...newsPosts].sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
          const featured = sorted[0]
          const compact = sorted.slice(1)
          return (
            <>
              {/* Featured post */}
              <Link to="/news">
                <div className={`rounded-2xl border overflow-hidden mb-3 transition-colors active:opacity-80 ${
                  featured.pinned
                    ? 'bg-gradient-to-br from-teal-500/10 to-sky-500/5 border-teal-500/25'
                    : 'glass border-white/10 hover:border-white/20'
                }`}>
                  {featured.pinned && (
                    <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
                      <Pin size={10} className="text-teal-400" />
                      <span className="text-teal-400 text-[10px] font-semibold uppercase tracking-wider">Angeheftet</span>
                    </div>
                  )}
                  <div className="px-4 py-3">
                    <p className="text-white font-semibold text-sm leading-snug mb-1.5 line-clamp-2">{featured.title}</p>
                    <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
                      {stripMarkdown(featured.content)}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-slate-500 text-xs">
                        {featured.author_name && `${featured.author_name} · `}{relativeDate(featured.created_at)}
                      </p>
                      <span className="text-teal-400 text-xs font-medium">Lesen →</span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Compact list */}
              {compact.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
                  {compact.map(post => (
                    <Link
                      key={post.id}
                      to="/news"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/10 transition-colors"
                    >
                      {post.pinned && <Pin size={10} className="text-teal-400 shrink-0" />}
                      <p className="flex-1 text-white text-sm truncate">{post.title}</p>
                      <p className="text-slate-500 text-xs shrink-0">{relativeDate(post.created_at)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )
        })()}
      </div>
    </PageShell>
  )
}

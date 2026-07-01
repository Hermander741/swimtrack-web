import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { apiRequest } from '../api/client'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Plus, Pencil, Trash2, Pin, X, ChevronDown, ChevronUp, Quote } from 'lucide-react'

interface NewsPost {
  id: string
  title: string
  content: string
  pinned: boolean
  created_at: string
  updated_at: string
  author_name: string | null
  author_color: string | null
}

interface MQuote {
  id: string
  text: string
  attribution: string | null
  active: boolean
  created_at: string
  created_by_name?: string | null
}

function PostForm({ initial, onSave, onCancel }: {
  initial?: Partial<NewsPost>
  onSave: (data: { title: string; content: string; pinned: boolean }) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [pinned, setPinned] = useState(initial?.pinned ?? false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await onSave({ title, content, pinned })
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4">
      <div className="w-full max-w-lg bg-ocean-900 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold">{initial?.id ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Titel" value={title} onChange={e => setTitle(e.target.value)} required />
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Inhalt</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              required
              rows={5}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50 resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)}
              className="w-4 h-4 rounded accent-teal-500" />
            <span className="text-sm text-slate-300">Beitrag anheften</span>
          </label>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Abbrechen</Button>
            <Button type="submit" loading={loading} className="flex-1">Speichern</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function QuoteForm({ initial, onSave, onCancel }: {
  initial?: Partial<MQuote>
  onSave: (data: { text: string; attribution: string; active: boolean }) => Promise<void>
  onCancel: () => void
}) {
  const [text, setText] = useState(initial?.text ?? '')
  const [attribution, setAttribution] = useState(initial?.attribution ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await onSave({ text, attribution, active })
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4">
      <div className="w-full max-w-lg bg-ocean-900 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold">{initial?.id ? 'Spruch bearbeiten' : 'Neuer Spruch'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Spruch</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              required
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50 resize-none"
            />
          </div>
          <Input label="Quelle (optional)" value={attribution} onChange={e => setAttribution(e.target.value)} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
              className="w-4 h-4 rounded accent-teal-500" />
            <span className="text-sm text-slate-300">Aktiv (wird in der Rotation verwendet)</span>
          </label>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Abbrechen</Button>
            <Button type="submit" loading={loading} className="flex-1">Speichern</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function News() {
  const { isTrainer } = useAuth()
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [showQuotes, setShowQuotes] = useState(false)
  const [quotes, setQuotes] = useState<MQuote[]>([])
  const [postForm, setPostForm] = useState<Partial<NewsPost> | null>(null)
  const [quoteForm, setQuoteForm] = useState<Partial<MQuote> | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    const res = await apiRequest<NewsPost[]>('/api/news/posts')
    if (res.ok) setPosts(res.data)
  }, [])

  const loadQuotes = useCallback(async () => {
    const res = await apiRequest<MQuote[]>('/api/news/quotes')
    if (res.ok) setQuotes(res.data)
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])
  useEffect(() => { if (showQuotes && isTrainer) loadQuotes() }, [showQuotes, isTrainer, loadQuotes])

  async function savePost(data: { title: string; content: string; pinned: boolean }) {
    if (postForm?.id) {
      await apiRequest(`/api/news/posts/${postForm.id}`, { method: 'PATCH', body: JSON.stringify(data) })
    } else {
      await apiRequest('/api/news/posts', { method: 'POST', body: JSON.stringify(data) })
    }
    setPostForm(null)
    loadPosts()
  }

  async function deletePost(id: string) {
    if (!confirm('Beitrag löschen?')) return
    await apiRequest(`/api/news/posts/${id}`, { method: 'DELETE' })
    loadPosts()
  }

  async function saveQuote(data: { text: string; attribution: string; active: boolean }) {
    if (quoteForm?.id) {
      await apiRequest(`/api/news/quotes/${quoteForm.id}`, { method: 'PATCH', body: JSON.stringify(data) })
    } else {
      await apiRequest('/api/news/quotes', { method: 'POST', body: JSON.stringify(data) })
    }
    setQuoteForm(null)
    loadQuotes()
  }

  async function deleteQuote(id: string) {
    if (!confirm('Spruch löschen?')) return
    await apiRequest(`/api/news/quotes/${id}`, { method: 'DELETE' })
    loadQuotes()
  }

  return (
    <PageShell
      title="News"
      fab={isTrainer ? (
        <button
          onClick={() => setPostForm({})}
          className="w-14 h-14 bg-gradient-to-r from-teal-500 to-sky-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      ) : undefined}
    >
      {/* Quotes management for trainers */}
      {isTrainer && (
        <div className="mb-4">
          <button
            onClick={() => setShowQuotes(v => !v)}
            className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors"
          >
            <Quote className="w-4 h-4" />
            Motivationssprüche verwalten
            {showQuotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showQuotes && (
            <div className="mt-3 space-y-2">
              <Button variant="ghost" onClick={() => setQuoteForm({})} className="w-full text-sm">
                <Plus className="w-4 h-4 mr-1" /> Neuer Spruch
              </Button>
              {quotes.map(q => (
                <Card key={q.id} className={!q.active ? 'opacity-50' : ''}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">"{q.text}"</p>
                      {q.attribution && <p className="text-slate-400 text-xs mt-0.5">— {q.attribution}</p>}
                      {!q.active && <p className="text-slate-500 text-xs mt-0.5">Inaktiv</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setQuoteForm(q)} className="text-slate-400 hover:text-white transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteQuote(q.id)} className="text-slate-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* News posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper size={40} className="mx-auto mb-3 text-slate-700" />
          <p className="text-slate-400 text-sm">Noch keine News vorhanden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => {
            const expanded = expandedId === post.id
            return (
              <Card key={post.id}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {post.pinned && <Pin className="w-3 h-3 text-teal-400 shrink-0" />}
                      <p className="text-white font-semibold text-sm leading-snug">{post.title}</p>
                    </div>
                    <p className={`text-slate-300 text-sm leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
                      {post.content}
                    </p>
                    {post.content.length > 150 && (
                      <button
                        onClick={() => setExpandedId(expanded ? null : post.id)}
                        className="text-teal-400 text-xs mt-1 hover:text-teal-300 transition-colors"
                      >
                        {expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
                      </button>
                    )}
                    <p className="text-slate-500 text-xs mt-2">
                      {post.author_name && `${post.author_name} · `}
                      {new Date(post.created_at).toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {isTrainer && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => setPostForm(post)} className="text-slate-400 hover:text-white transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deletePost(post.id)} className="text-slate-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {postForm !== null && (
        <PostForm initial={postForm} onSave={savePost} onCancel={() => setPostForm(null)} />
      )}
      {quoteForm !== null && (
        <QuoteForm initial={quoteForm} onSave={saveQuote} onCancel={() => setQuoteForm(null)} />
      )}
    </PageShell>
  )
}

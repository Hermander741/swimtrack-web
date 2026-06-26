import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listUsers } from '../api/users'
import { listDocuments } from '../api/documents'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import type { Document } from '../types'

export function Dashboard() {
  const { user, isTrainer } = useAuth()
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [recentDocs, setRecentDocs] = useState<Document[]>([])

  useEffect(() => {
    if (isTrainer) {
      listUsers().then(res => { if (res.ok) setMemberCount(res.data.length) })
    }
    listDocuments().then(res => { if (res.ok) setRecentDocs(res.data.slice(0, 3)) })
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

      {/* Hero placeholder card */}
      <Card className="mb-6 bg-gradient-to-br from-teal-500/20 to-sky-500/20 border-teal-500/20 glow-teal">
        <p className="text-xs text-teal-400 font-medium mb-1">Nächster Termin</p>
        <p className="text-white font-semibold">Kommt in Sub-Projekt 3</p>
        <p className="text-slate-400 text-sm mt-1">Trainingsplan wird hinzugefügt</p>
      </Card>

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
      {recentDocs.length > 0 && (
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
      )}
    </PageShell>
  )
}

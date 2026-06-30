import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { PageShell } from '../components/layout/PageShell'
import { Avatar } from '../components/ui/Avatar'
import { Card } from '../components/ui/Card'
import { getUserProfile } from '../api/users'
import { listUserBestzeiten } from '../api/zeiten'
import { formatTime } from '../utils/format'
import type { SwimTimeEntry } from '../types'

const COURSE_LABELS: Record<string, string> = { LB: 'Langbahn (50m)', KB: 'Kurzbahn (25m)', OW: 'Freiwasser' }

export function SwimmerProfile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<{ name: string; role: string; avatar_color: string | null; avatar_url: string | null } | null>(null)
  const [pbs, setPbs] = useState<SwimTimeEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    Promise.all([getUserProfile(userId), listUserBestzeiten(userId)]).then(([pRes, zRes]) => {
      if (pRes.ok) setProfile(pRes.data)
      if (zRes.ok) setPbs(zRes.data)
      setLoading(false)
    })
  }, [userId])

  const bycourse = pbs.reduce<Record<string, SwimTimeEntry[]>>((acc, pb) => {
    ;(acc[pb.course] ??= []).push(pb)
    return acc
  }, {})

  const courses = ['LB', 'KB', 'OW'].filter(c => bycourse[c]?.length)

  return (
    <PageShell
      title={profile?.name ?? 'Schwimmer'}
      topBarRight={
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !profile ? (
        <p className="text-slate-400 text-center py-16">Schwimmer nicht gefunden</p>
      ) : (
        <>
          <div className="flex flex-col items-center py-8 mb-2">
            <Avatar name={profile.name} color={profile.avatar_color ?? undefined} imageUrl={profile.avatar_url ?? undefined} size="xl" />
            <h2 className="text-2xl font-bold text-white mt-4">{profile.name}</h2>
          </div>

          {pbs.length === 0 ? (
            <Card>
              <p className="text-slate-400 text-sm text-center py-4">Noch keine Bestzeiten eingetragen</p>
            </Card>
          ) : (
            <div className="space-y-4 pb-6">
              {courses.map(course => (
                <div key={course}>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2 px-1">
                    {COURSE_LABELS[course]}
                  </p>
                  <Card>
                    <div className="divide-y divide-white/5">
                      {bycourse[course]
                        .slice()
                        .sort((a, b) => a.event.localeCompare(b.event))
                        .map(pb => (
                          <div key={pb.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                            <span className="text-slate-300 text-sm">{pb.event}</span>
                            <span className="font-mono font-bold text-teal-400 text-sm">{formatTime(pb.time_ms)}</span>
                          </div>
                        ))}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PageShell>
  )
}

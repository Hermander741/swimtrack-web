import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest, setAccessToken } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import type { Invitation, User, Role } from '../types'

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw)]
  const score = checks.filter(Boolean).length
  if (score <= 1) return { score, label: 'Zu schwach', color: 'bg-red-500' }
  if (score === 2) return { score, label: 'Schwach', color: 'bg-orange-500' }
  if (score === 3) return { score, label: 'Mittel', color: 'bg-yellow-500' }
  return { score, label: 'Stark', color: 'bg-green-500' }
}

export function Register() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [tokenError, setTokenError] = useState('')
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [geburtsdatum, setGeburtsdatum] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) { setTokenError('Kein Einladungslink'); return }
    apiRequest<Invitation>(`/api/invitations/${token}`).then(res => {
      if (res.ok) setInvitation(res.data)
      else setTokenError('Dieser Einladungslink ist ungültig oder abgelaufen.')
    })
  }, [token])

  const strength = passwordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (strength.score < 4) { setError('Passwort erfüllt nicht die Mindestanforderungen'); return }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein'); return }
    setError('')
    setLoading(true)
    const res = await apiRequest<{ accessToken: string; user: User }>(`/api/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ vorname, nachname, geburtsdatum, password }),
    })
    setLoading(false)
    if (res.ok) {
      setAccessToken(res.data.accessToken)
      setUser(res.data.user)
      navigate('/')
    } else {
      setError(res.error)
    }
  }

  if (tokenError) {
    return (
      <div className="min-h-dvh bg-ocean-950 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-2xl mb-2">😔</p>
          <p className="text-white font-semibold mb-1">Link ungültig</p>
          <p className="text-slate-400 text-sm">{tokenError}</p>
        </div>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-dvh bg-ocean-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-ocean-950 flex flex-col items-center justify-center px-6 py-10 safe-top">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Konto erstellen</h1>
          <p className="text-slate-400 text-sm">Du wurdest eingeladen als</p>
          <div className="mt-2 flex justify-center">
            <Badge role={invitation.role as Role} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email readonly from invitation */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">E-Mail</label>
            <div className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-sm">
              {invitation.email}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Vorname" value={vorname} onChange={e => setVorname(e.target.value)} required autoComplete="given-name" />
            <Input label="Nachname" value={nachname} onChange={e => setNachname(e.target.value)} required autoComplete="family-name" />
          </div>

          <Input
            label="Geburtsdatum"
            type="date"
            value={geburtsdatum}
            onChange={e => setGeburtsdatum(e.target.value)}
            required
            max={new Date().toISOString().split('T')[0]}
          />

          <div className="space-y-1.5">
            <Input
              label="Passwort"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-white/10'}`} />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{strength.label}</span>
                  <span>Groß- und Kleinbuchstaben + Zahl erforderlich</span>
                </div>
              </div>
            )}
          </div>

          <Input
            label="Passwort bestätigen"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />

          {error && (
            <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-4 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full" disabled={strength.score < 4 || !vorname || !nachname || !geburtsdatum}>
            Konto erstellen
          </Button>
        </form>
      </div>
    </div>
  )
}

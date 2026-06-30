import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw)]
  const score = checks.filter(Boolean).length
  if (score <= 1) return { score, label: 'Zu schwach', color: 'bg-red-500' }
  if (score === 2) return { score, label: 'Schwach', color: 'bg-orange-500' }
  if (score === 3) return { score, label: 'Mittel', color: 'bg-yellow-500' }
  return { score, label: 'Stark', color: 'bg-green-500' }
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setTokenValid(false); return }
    apiRequest<{ email: string }>(`/api/auth/reset-password/${token}`).then(res => {
      if (res.ok) { setEmail(res.data.email); setTokenValid(true) }
      else setTokenValid(false)
    })
  }, [token])

  const strength = passwordStrength(password)

  if (!token || tokenValid === false) {
    return (
      <div className="min-h-dvh bg-ocean-950 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-2xl mb-2">😔</p>
          <p className="text-white font-semibold mb-1">Ungültiger Link</p>
          <Link to="/login" className="text-teal-400 text-sm hover:underline">Zur Anmeldung</Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (strength.score < 4) { setError('Passwort erfüllt nicht die Mindestanforderungen'); return }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein'); return }
    setError('')
    setLoading(true)
    const res = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    })
    setLoading(false)
    if (res.ok) {
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } else {
      setError(res.error)
    }
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-dvh bg-ocean-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-dvh bg-ocean-950 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-white font-semibold mb-1">Passwort geändert</p>
          <p className="text-slate-400 text-sm">Du wirst zur Anmeldung weitergeleitet…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-ocean-950 flex flex-col items-center justify-center px-6 py-12 safe-top">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2">Neues Passwort</h1>
        <p className="text-slate-400 text-sm mb-8">Wähle ein neues Passwort für dein Konto.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden username field so iOS Password Manager knows which account this belongs to */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly className="hidden" />
          <div className="space-y-1.5">
            <Input
              label="Neues Passwort"
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

          <Button type="submit" loading={loading} className="w-full" disabled={strength.score < 4 || !confirm}>
            Passwort ändern
          </Button>
        </form>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest, setAccessToken } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import type { Invitation, User, Role } from '../types'

export function Register() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [tokenError, setTokenError] = useState('')
  const [name, setName] = useState('')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwörter stimmen nicht überein'); return }
    setError('')
    setLoading(true)
    const res = await apiRequest<{ accessToken: string; user: User }>(`/api/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ name, password }),
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
    <div className="min-h-dvh bg-ocean-950 flex flex-col items-center justify-center px-6 safe-top">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Registrierung</h1>
          <p className="text-slate-400 text-sm">Du wurdest eingeladen als</p>
          <div className="mt-2 flex justify-center">
            <Badge role={invitation.role as Role} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Dein Name" value={name} onChange={e => setName(e.target.value)} required />
          <Input label="Passwort (min. 8 Zeichen)" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Input label="Passwort bestätigen" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />

          {error && (
            <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-4 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Konto erstellen
          </Button>
        </form>
      </div>
    </div>
  )
}

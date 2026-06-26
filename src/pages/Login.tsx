import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import mermaidsLogo from '../assets/mermaids-logo.svg'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.ok) navigate('/')
    else setError(result.error ?? 'Anmeldung fehlgeschlagen')
  }

  return (
    <div className="min-h-dvh bg-ocean-950 flex flex-col items-center justify-center px-6 py-12 safe-top">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <img src={mermaidsLogo} alt="Mermaids" className="w-24 h-24 mb-4" />
          <h1 className="text-2xl font-bold text-white">Mermaids</h1>
          <p className="text-slate-400 text-sm mt-1">Schwimmverein Wien</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-Mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Passwort"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-4 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Anmelden
          </Button>
        </form>
      </div>
    </div>
  )
}

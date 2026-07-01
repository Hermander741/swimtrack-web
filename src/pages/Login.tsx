import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Fingerprint } from 'lucide-react'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { useAuth } from '../hooks/useAuth'
import { setAccessToken } from '../api/client'
import { loginWithPasskey } from '../api/passkey'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import mermaidsLogo from '../assets/mermaids-logo.svg'

export function Login() {
  const { login, setUser } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const webAuthnSupported = browserSupportsWebAuthn()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.ok) navigate('/')
    else setError(result.error ?? 'Anmeldung fehlgeschlagen')
  }

  async function handlePasskeyLogin() {
    setError('')
    setPasskeyLoading(true)
    const result = await loginWithPasskey()
    setPasskeyLoading(false)
    if (result.ok && result.user && result.accessToken) {
      setAccessToken(result.accessToken)
      setUser(result.user)
      navigate('/')
    } else {
      setError(result.error ?? 'Passkey-Anmeldung fehlgeschlagen')
    }
  }

  return (
    <div className="min-h-dvh bg-ocean-950 flex flex-col items-center justify-center px-6 py-12 safe-top relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
          width: '120vw', height: '60vh',
          background: 'radial-gradient(ellipse at center, rgba(20,184,166,0.12) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '28vh',
          background: 'radial-gradient(ellipse at center bottom, rgba(14,165,233,0.08) 0%, transparent 70%)',
        }} />
        {/* Wave decoration */}
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: '80px', opacity: 0.06 }}
        >
          <path
            d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,120 L0,120 Z"
            fill="#14B8A6"
          />
          <path
            d="M0,80 C360,40 720,100 1080,60 C1260,40 1380,70 1440,80 L1440,120 L0,120 Z"
            fill="#0EA5E9"
            style={{ opacity: 0.6 }}
          />
        </svg>
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            <div style={{
              position: 'absolute', inset: '-16px',
              background: 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)',
              borderRadius: '50%',
            }} />
            <img src={mermaidsLogo} alt="Mermaids" className="w-24 h-24 relative z-10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Mermaids</h1>
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

          {webAuthnSupported && (
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl border border-white/10 bg-white/5 text-white text-sm font-medium hover:bg-white/10 active:opacity-70 disabled:opacity-50 transition-all"
            >
              <Fingerprint size={18} className="text-teal-400" />
              {passkeyLoading ? 'Warte auf Face ID…' : 'Mit Face ID anmelden'}
            </button>
          )}

          <div className="text-center pt-2">
            <Link to="/forgot-password" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
              Passwort vergessen?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { ChevronLeft } from 'lucide-react'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (res.ok) setSent(true)
    else setError(res.error)
  }

  return (
    <div className="min-h-dvh bg-ocean-950 flex flex-col items-center justify-center px-6 py-12 safe-top">
      <div className="w-full max-w-sm">
        <Link to="/login" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-8 transition-colors w-fit">
          <ChevronLeft className="w-4 h-4" />
          Zurück zur Anmeldung
        </Link>

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">📬</div>
            <h1 className="text-xl font-bold text-white mb-2">E-Mail gesendet</h1>
            <p className="text-slate-400 text-sm">
              Falls ein Konto mit dieser E-Mail-Adresse existiert, hast du in wenigen Minuten eine E-Mail mit einem Link zum Zurücksetzen deines Passworts erhalten.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Passwort vergessen?</h1>
            <p className="text-slate-400 text-sm mb-8">Gib deine E-Mail-Adresse ein und wir schicken dir einen Link zum Zurücksetzen.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="E-Mail"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              {error && (
                <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-4 py-2">{error}</p>
              )}
              <Button type="submit" loading={loading} className="w-full">
                Link senden
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

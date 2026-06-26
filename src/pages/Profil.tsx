import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { updateMe } from '../api/users'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

const AVATAR_COLORS = ['#0EA5E9', '#14B8A6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#F97316']

export function Profil() {
  const { user, logout, setUser } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  async function handleColorChange(color: string) {
    const res = await updateMe({ avatar_color: color })
    if (res.ok) setUser(res.data)
  }

  function handleClosePasswordModal() {
    setShowPassword(false)
    setNewPassword('')
    setConfirmPassword('')
    setPwError('')
    setPwSuccess(false)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setPwError('Passwörter stimmen nicht überein'); return }
    if (newPassword.length < 8) { setPwError('Mindestens 8 Zeichen'); return }
    setPwError(''); setPwLoading(true)
    const res = await updateMe({ password: newPassword })
    setPwLoading(false)
    if (res.ok) {
      setPwSuccess(true)
      setTimeout(() => { handleClosePasswordModal() }, 1500)
    } else {
      setPwError(res.error)
    }
  }

  if (!user) return null

  return (
    <PageShell title="Profil">
      {/* Profile header */}
      <div className="flex flex-col items-center py-6 mb-6">
        <Avatar name={user.name} color={user.avatar_color} size="lg" />
        <h2 className="text-xl font-bold text-white mt-3">{user.name}</h2>
        <p className="text-slate-400 text-sm mt-1">{user.email}</p>
        <div className="mt-2">
          <Badge role={user.role} />
        </div>
      </div>

      {/* Avatar color picker */}
      <Card className="mb-4">
        <p className="text-sm font-medium text-white mb-3">Avatar-Farbe</p>
        <div className="flex gap-3 flex-wrap">
          {AVATAR_COLORS.map(color => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className="w-8 h-8 rounded-full transition-transform active:scale-95"
              style={{
                backgroundColor: color,
                outline: user.avatar_color === color ? `2px solid ${color}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        <Button variant="secondary" className="w-full" onClick={() => setShowPassword(true)}>
          Passwort ändern
        </Button>
        <Button variant="danger" className="w-full" onClick={handleLogout}>
          Abmelden
        </Button>
      </div>

      <Modal open={showPassword} onClose={handleClosePasswordModal} title="Passwort ändern">
        {pwSuccess ? (
          <p className="text-center text-teal-400 py-4">✓ Passwort geändert!</p>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <Input label="Neues Passwort" type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} required />
            <Input label="Passwort bestätigen" type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} required />
            {pwError && <p className="text-sm text-red-400">{pwError}</p>}
            <Button type="submit" loading={pwLoading} className="w-full">Speichern</Button>
          </form>
        )}
      </Modal>
    </PageShell>
  )
}

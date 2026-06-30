import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Camera, Users, Bell, BellOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { updateMe, uploadAvatar } from '../api/users'
import { getICalToken, regenerateICalToken, icalUrl } from '../api/training'
import { listMyChildren } from '../api/members'
import { subscribePush, unsubscribePush } from '../api/push'
import type { ChildUser } from '../api/members'
import type { ICalToken } from '../types'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { ImageCropModal } from '../components/ui/ImageCropModal'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

const AVATAR_COLORS = ['#0EA5E9', '#14B8A6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#F97316']

export function Profil() {
  const { user, logout, setUser, isTrainer, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [icalToken, setICalToken] = useState<ICalToken | null>(null)
  const [icalLoading, setICalLoading] = useState(false)
  const [icalCopied, setICalCopied] = useState(false)
  const [myresultsName, setMyresultsName] = useState(user?.myresults_name ?? '')
  const [myresultsSaving, setMyresultsSaving] = useState(false)
  const [myresultsSaved, setMyresultsSaved] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [myChildren, setMyChildren] = useState<ChildUser[]>([])
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [pushLoading, setPushLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getICalToken().then(res => { if (res.ok) setICalToken(res.data) })
    if (user?.role === 'eltern') {
      listMyChildren().then(res => { if (res.ok) setMyChildren(res.data) })
    }
    if ('Notification' in window) setPushPermission(Notification.permission)
  }, [user?.role])

  async function handleEnablePush() {
    setPushLoading(true)
    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission === 'granted') await subscribePush()
    } finally {
      setPushLoading(false)
    }
  }

  async function handleDisablePush() {
    setPushLoading(true)
    try {
      await unsubscribePush()
      setPushPermission('default')
    } finally {
      setPushLoading(false)
    }
  }

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

  async function handleRegenerateIcal() {
    if (!confirm('Alten Kalender-Link ungültig machen und neuen erstellen?')) return
    setICalLoading(true)
    const res = await regenerateICalToken()
    setICalLoading(false)
    if (res.ok) setICalToken(res.data)
  }

  async function handleCopyIcal() {
    if (!icalToken) return
    const url = icalUrl(icalToken.token)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      Object.assign(ta.style, { position: 'fixed', opacity: '0', top: '0', left: '0' })
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setICalCopied(true)
    setTimeout(() => setICalCopied(false), 2000)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleCropConfirm(blob: Blob) {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setAvatarError('')
    setAvatarUploading(true)
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
    const res = await uploadAvatar(file)
    if (res.ok) setUser(res.data)
    else setAvatarError(res.error ?? 'Upload fehlgeschlagen')
    setAvatarUploading(false)
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  async function handleSaveMyresults() {
    setMyresultsSaving(true)
    const res = await updateMe({ myresults_name: myresultsName || null })
    if (res.ok) { setUser(res.data); setMyresultsSaved(true); setTimeout(() => setMyresultsSaved(false), 2000) }
    setMyresultsSaving(false)
  }

  if (!user) return null

  return (
    <PageShell title="Profil">
      {cropSrc && (
        <ImageCropModal imageSrc={cropSrc} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}
      {/* Profile header */}
      <div className="flex flex-col items-center py-6 mb-6">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
        <button
          className="relative group"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
        >
          <Avatar name={user.name} color={user.avatar_color} imageUrl={user.avatar_url} size="lg" />
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {avatarUploading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Camera size={20} className="text-white" />}
          </div>
        </button>
        <h2 className="text-xl font-bold text-white mt-3">{user.name}</h2>
        <p className="text-slate-400 text-sm mt-1">{user.email}</p>
        {avatarError && <p className="text-red-400 text-xs mt-1">{avatarError}</p>}
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

      {/* Meine Kinder — for parents */}
      {user?.role === 'eltern' && myChildren.length > 0 && (
        <Card className="mb-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Meine Kinder</p>
          <div className="space-y-2">
            {myChildren.map(child => (
              <div key={child.id} className="flex items-center gap-3">
                <Avatar name={child.name} color={child.avatar_color ?? undefined} imageUrl={child.avatar_url ?? undefined} size="sm" />
                <span className="text-white text-sm flex-1">{child.name}</span>
                <Link to={`/training?childId=${child.id}`} className="text-xs text-teal-400 hover:text-teal-300">Training →</Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Admin / Trainer section */}
      {(isAdmin || isTrainer) && (
        <Card className="mb-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Administration</p>
          <Link to="/mitglieder" className="flex items-center gap-3 py-2 text-white hover:text-teal-400 transition-colors">
            <Users size={18} className="text-teal-400 shrink-0" />
            <span className="text-sm font-medium">Mitglieder verwalten</span>
          </Link>
        </Card>
      )}

      {/* Push notifications */}
      {pushPermission !== 'unsupported' && (
        <Card className="mb-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Benachrichtigungen</p>
          {pushPermission === 'granted' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell size={18} className="text-teal-400 shrink-0" />
                <div>
                  <p className="text-white text-sm font-medium">Aktiv</p>
                  <p className="text-slate-400 text-xs">Push-Benachrichtigungen eingeschaltet</p>
                </div>
              </div>
              <button onClick={handleDisablePush} disabled={pushLoading}
                className="text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50 px-2 py-1">
                Aus
              </button>
            </div>
          ) : pushPermission === 'denied' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <BellOff size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">Benachrichtigungen blockiert</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Benötigt HTTPS + Erlaubnis in iOS-Einstellungen:<br />
                    <span className="text-teal-400">Einstellungen → Mermaids → Mitteilungen → Erlauben</span>
                  </p>
                </div>
              </div>
              <button onClick={handleEnablePush} disabled={pushLoading}
                className="w-full py-2 rounded-xl bg-white/5 text-slate-300 text-sm font-medium disabled:opacity-50">
                {pushLoading ? 'Bitte warten…' : 'Erneut versuchen'}
              </button>
            </div>
          ) : (
            <button onClick={handleEnablePush} disabled={pushLoading}
              className="w-full flex items-center gap-3 py-2 text-white active:opacity-70 transition-opacity disabled:opacity-50">
              <Bell size={18} className="text-teal-400 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium">{pushLoading ? 'Bitte warten…' : 'Benachrichtigungen aktivieren'}</p>
                <p className="text-slate-400 text-xs">Für Chat, Training und Dokument-Erinnerungen</p>
              </div>
              <span className="ml-auto text-slate-500 text-lg">›</span>
            </button>
          )}
        </Card>
      )}

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

      <Card className="mb-4">
        <h3 className="text-sm font-semibold text-white mb-1">Kalender abonnieren</h3>
        <p className="text-xs text-slate-400 mb-3">
          Deinen Trainingsplan in Outlook, Apple Calendar oder Google Calendar einbinden.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleCopyIcal} className="flex-1 text-xs py-2">
            {icalCopied ? '✓ Kopiert' : 'Link kopieren'}
          </Button>
          {icalToken && (
            <a
              href={icalUrl(icalToken.token)}
              download="mermaids-training.ics"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold glass text-white hover:bg-white/10 transition-all"
            >
              .ics herunterladen
            </a>
          )}
        </div>
        <button
          onClick={handleRegenerateIcal}
          disabled={icalLoading}
          className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {icalLoading ? 'Wird erneuert…' : 'Link zurücksetzen'}
        </button>
      </Card>

      <Card className="p-4 space-y-3">
        <div>
          <h3 className="text-white font-medium text-sm">myresults.eu</h3>
          <p className="text-slate-500 text-xs mt-0.5">Dein Suchname für automatische Ergebnis-Importe</p>
        </div>
        <input
          type="text"
          placeholder="NACHNAME Vorname (z.B. URBAN Herman)"
          value={myresultsName}
          onChange={e => { setMyresultsName(e.target.value); setMyresultsSaved(false) }}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
        />
        <Button
          onClick={handleSaveMyresults}
          disabled={myresultsSaving}
          variant="secondary"
        >
          {myresultsSaved ? '✓ Gespeichert' : myresultsSaving ? 'Wird gespeichert…' : 'Speichern'}
        </Button>
      </Card>
    </PageShell>
  )
}

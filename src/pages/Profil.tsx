import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Camera, Users, FileText, Bell, BellOff, KeyRound, LogOut, Calendar, ChevronRight, Fingerprint, Trash2, Check, Globe } from 'lucide-react'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { useAuth } from '../hooks/useAuth'
import { updateMe, uploadAvatar } from '../api/users'
import { getICalToken, regenerateICalToken, icalUrl } from '../api/training'
import { listMyChildren } from '../api/members'
import { subscribePush, unsubscribePush } from '../api/push'
import { registerPasskey, listPasskeys, deletePasskey } from '../api/passkey'
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
  const [passkeys, setPasskeys] = useState<{ id: string; device_type: string; backed_up: boolean; created_at: string }[]>([])
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeyError, setPasskeyError] = useState('')
  const [passkeySuccess, setPasskeySuccess] = useState(false)
  const [webAuthnSupported] = useState(() => browserSupportsWebAuthn())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getICalToken().then(res => { if (res.ok) setICalToken(res.data) })
    if (user?.role === 'eltern') {
      listMyChildren().then(res => { if (res.ok) setMyChildren(res.data) })
    }
    if ('Notification' in window) setPushPermission(Notification.permission)
    if (browserSupportsWebAuthn()) {
      listPasskeys().then(res => { if (res.ok) setPasskeys(res.data) })
    }
  }, [user?.role])

  async function handleAddPasskey() {
    setPasskeyLoading(true)
    setPasskeyError('')
    setPasskeySuccess(false)
    const res = await registerPasskey()
    setPasskeyLoading(false)
    if (res.ok) {
      setPasskeySuccess(true)
      const list = await listPasskeys()
      if (list.ok) setPasskeys(list.data)
      setTimeout(() => setPasskeySuccess(false), 3000)
    } else {
      setPasskeyError(res.error ?? 'Fehler')
    }
  }

  async function handleDeletePasskey(id: string) {
    await deletePasskey(id)
    setPasskeys(prev => prev.filter(p => p.id !== id))
  }

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
    <PageShell title="Mehr">
      {cropSrc && (
        <ImageCropModal imageSrc={cropSrc} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}

      {/* ── Profil-Header ─────────────────────────────── */}
      <div className="flex flex-col items-center py-6 mb-6">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
        <button className="relative group" onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}>
          <Avatar name={user.name} color={user.avatar_color} imageUrl={user.avatar_url} size="lg" />
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity">
            {avatarUploading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Camera size={20} className="text-white" />}
          </div>
        </button>
        <h2 className="text-xl font-bold text-white mt-3">{user.name}</h2>
        <p className="text-slate-400 text-sm mt-0.5">{user.email}</p>
        {avatarError && <p className="text-red-400 text-xs mt-1">{avatarError}</p>}
        <div className="mt-2"><Badge role={user.role} /></div>
      </div>

      {/* ── Avatar-Farbe ──────────────────────────────── */}
      <Card className="mb-4">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Avatar-Farbe</p>
        <div className="flex gap-3 flex-wrap">
          {AVATAR_COLORS.map(color => (
            <button key={color} onClick={() => handleColorChange(color)}
              className="w-8 h-8 rounded-full transition-transform active:scale-95"
              style={{ backgroundColor: color, outline: user.avatar_color === color ? `2px solid ${color}` : 'none', outlineOffset: '2px' }}
            />
          ))}
        </div>
      </Card>

      {/* ── Administration (Trainer / Admin) ──────────── */}
      {(isAdmin || isTrainer) && (
        <Card className="mb-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Administration</p>
          <div className="divide-y divide-white/5">
            <Link to="/mitglieder" className="flex items-center gap-3 py-3 text-white hover:text-teal-400 transition-colors">
              <Users size={18} className="text-teal-400 shrink-0" />
              <span className="text-sm font-medium flex-1">Mitglieder verwalten</span>
              <ChevronRight size={16} className="text-slate-500" />
            </Link>
            <Link to="/dokumente" className="flex items-center gap-3 py-3 text-white hover:text-teal-400 transition-colors">
              <FileText size={18} className="text-sky-400 shrink-0" />
              <span className="text-sm font-medium flex-1">Dokumente</span>
              <ChevronRight size={16} className="text-slate-500" />
            </Link>
          </div>
        </Card>
      )}

      {/* ── Meine Kinder (Eltern) ─────────────────────── */}
      {user.role === 'eltern' && myChildren.length > 0 && (
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

      {/* ── Einstellungen ─────────────────────────────── */}
      <Card className="mb-4">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Einstellungen</p>
        <div className="divide-y divide-white/5">
          {/* myresults */}
          <div className="py-3 space-y-2">
            <div className="flex items-center gap-3">
              <Globe size={18} className="text-slate-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">myresults.eu Name</p>
                <p className="text-xs text-slate-500">Für automatische Ergebnis-Importe</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="NACHNAME Vorname (z.B. URBAN Herman)"
              value={myresultsName}
              onChange={e => { setMyresultsName(e.target.value); setMyresultsSaved(false) }}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-teal-500"
            />
            <button onClick={handleSaveMyresults} disabled={myresultsSaving}
              className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50 transition-colors">
              {myresultsSaved ? <span className="flex items-center gap-1"><Check size={12} />Gespeichert</span> : myresultsSaving ? 'Wird gespeichert…' : 'Speichern'}
            </button>
          </div>

          {/* Push notifications */}
          {pushPermission !== 'unsupported' && (
            <div className="py-3">
              {pushPermission === 'granted' ? (
                <div className="flex items-center gap-3">
                  <Bell size={18} className="text-teal-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Push-Benachrichtigungen</p>
                    <p className="text-xs text-slate-500">Aktiv</p>
                  </div>
                  <button onClick={handleDisablePush} disabled={pushLoading}
                    className="text-xs text-red-400/70 hover:text-red-400 disabled:opacity-50 px-2 py-1">
                    Aus
                  </button>
                </div>
              ) : pushPermission === 'denied' ? (
                <div className="flex items-start gap-3">
                  <BellOff size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">Benachrichtigungen blockiert</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Einstellungen → Mermaids → Mitteilungen → Erlauben
                    </p>
                  </div>
                </div>
              ) : (
                <button onClick={handleEnablePush} disabled={pushLoading}
                  className="w-full flex items-center gap-3 text-white active:opacity-70 disabled:opacity-50">
                  <Bell size={18} className="text-teal-400 shrink-0" />
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium">{pushLoading ? 'Bitte warten…' : 'Benachrichtigungen aktivieren'}</p>
                    <p className="text-xs text-slate-500">Chat, Training und Dokument-Erinnerungen</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-500" />
                </button>
              )}
            </div>
          )}

          {/* Passwort ändern */}
          <button onClick={() => setShowPassword(true)}
            className="w-full flex items-center gap-3 py-3 text-white hover:text-teal-400 active:opacity-70 transition-colors">
            <KeyRound size={18} className="text-slate-400 shrink-0" />
            <span className="text-sm font-medium flex-1 text-left">Passwort ändern</span>
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </div>
      </Card>

      {/* ── Passkeys ──────────────────────────────────── */}
      {webAuthnSupported && (
        <Card className="mb-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Face ID / Touch ID</p>
          {passkeys.length > 0 && (
            <div className="space-y-2 mb-3">
              {passkeys.map(pk => (
                <div key={pk.id} className="flex items-center gap-3">
                  <Fingerprint size={16} className="text-teal-400 shrink-0" />
                  <span className="text-sm text-white flex-1">
                    {pk.device_type === 'singleDevice' ? 'Dieses Gerät' : 'Synchronisiert'}
                    {pk.backed_up && <span className="text-xs text-slate-500 ml-1">(iCloud)</span>}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(pk.created_at).toLocaleDateString('de-AT')}
                  </span>
                  <button onClick={() => handleDeletePasskey(pk.id)} className="text-red-400/60 hover:text-red-400 transition-colors p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {passkeyError && <p className="text-xs text-red-400 mb-2">{passkeyError}</p>}
          {passkeySuccess && <p className="text-xs text-teal-400 mb-2 flex items-center gap-1"><Check size={12} />Passkey hinzugefügt</p>}
          <button onClick={handleAddPasskey} disabled={passkeyLoading}
            className="w-full flex items-center gap-3 py-2 text-white active:opacity-70 disabled:opacity-50 transition-opacity">
            <Fingerprint size={18} className="text-teal-400 shrink-0" />
            <div className="text-left flex-1">
              <p className="text-sm font-medium">{passkeyLoading ? 'Warte auf Face ID…' : 'Passkey hinzufügen'}</p>
              <p className="text-xs text-slate-500">Mit Face ID oder Touch ID schnell anmelden</p>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </Card>
      )}

      {/* ── Kalender ──────────────────────────────────── */}
      <Card className="mb-4">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Kalender</p>
        <div className="flex items-center gap-3 mb-3">
          <Calendar size={18} className="text-violet-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">Training abonnieren</p>
            <p className="text-xs text-slate-500">In Outlook, Apple Calendar oder Google Calendar</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleCopyIcal} className="flex-1 text-xs py-2">
            {icalCopied ? <span className="flex items-center gap-1.5"><Check size={14} />Kopiert</span> : 'Link kopieren'}
          </Button>
          {icalToken && (
            <a href={icalUrl(icalToken.token)} download="mermaids-training.ics"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold glass text-white hover:bg-white/10 transition-all">
              .ics
            </a>
          )}
        </div>
        <button onClick={handleRegenerateIcal} disabled={icalLoading}
          className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50">
          {icalLoading ? 'Wird erneuert…' : 'Link zurücksetzen'}
        </button>
      </Card>

      {/* ── Abmelden ──────────────────────────────────── */}
      <button onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-colors mb-6">
        <LogOut size={18} className="shrink-0" />
        <span className="text-sm font-medium">Abmelden</span>
      </button>

      <Modal open={showPassword} onClose={handleClosePasswordModal} title="Passwort ändern">
        {pwSuccess ? (
          <p className="text-center text-teal-400 py-4 flex items-center justify-center gap-2"><Check size={16} />Passwort geändert!</p>
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

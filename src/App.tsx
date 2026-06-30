import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Mitglieder } from './pages/Mitglieder'
import { Dokumente } from './pages/Dokumente'
import { Profil } from './pages/Profil'
import { Chat } from './pages/Chat'
import { Training } from './pages/Training'
import { Zeiten } from './pages/Zeiten'
import { SwimmerProfile } from './pages/SwimmerProfile'

function SplashScreen({ visible }: { visible: boolean }) {
  return (
    <div
      className="fixed inset-0 bg-ocean-950 flex items-center justify-center z-50"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 900ms ease-in-out', pointerEvents: visible ? 'auto' : 'none' }}
    >
      <img src="/icon.svg" alt="Mermaids" className="w-36 h-36 rounded-3xl shadow-2xl shadow-teal-500/20" />
    </div>
  )
}

const SPLASH_MIN_MS = 1800

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [splashVisible, setSplashVisible] = useState(true)
  const mountTime = useState(() => Date.now())[0]

  useEffect(() => {
    if (!loading) {
      const elapsed = Date.now() - mountTime
      const delay = Math.max(0, SPLASH_MIN_MS - elapsed)
      const t = setTimeout(() => setSplashVisible(false), delay)
      return () => clearTimeout(t)
    }
  }, [loading, mountTime])

  if (loading || splashVisible) {
    return <SplashScreen visible={splashVisible} />
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/mitglieder" element={<RequireAuth><Mitglieder /></RequireAuth>} />
      <Route path="/dokumente" element={<RequireAuth><Dokumente /></RequireAuth>} />
      <Route path="/profil" element={<RequireAuth><Profil /></RequireAuth>} />
      <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
      <Route path="/training" element={<RequireAuth><Training /></RequireAuth>} />
      <Route path="/zeiten" element={<RequireAuth><Zeiten /></RequireAuth>} />
      <Route path="/mehr" element={<RequireAuth><Profil /></RequireAuth>} />
      <Route path="/schwimmer/:userId" element={<RequireAuth><SwimmerProfile /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

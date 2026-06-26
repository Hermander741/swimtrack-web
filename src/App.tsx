import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Mitglieder } from './pages/Mitglieder'
import { Dokumente } from './pages/Dokumente'
import { Profil } from './pages/Profil'
import { Placeholder } from './pages/Placeholder'
import { Chat } from './pages/Chat'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-dvh bg-ocean-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
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
      <Route path="/training" element={<RequireAuth><Placeholder title="Trainingsplan" icon="📅" /></RequireAuth>} />
      <Route path="/zeiten" element={<RequireAuth><Placeholder title="Zeiten" icon="⏱" /></RequireAuth>} />
      <Route path="/mehr" element={<RequireAuth><Profil /></RequireAuth>} />
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

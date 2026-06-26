import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { me, login as apiLogin, logout as apiLogout, refreshToken } from '../api/auth'
import { setAccessToken } from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  isAdmin: boolean
  isTrainer: boolean
  setUser: (u: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refreshToken()
      .then(token => {
        if (token) return me()
        return null
      })
      .then(result => {
        if (result?.ok) setUser(result.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password)
    if (result.ok) { setUser(result.data.user); return { ok: true } }
    return { ok: false, error: result.error }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
    setAccessToken(null)
  }, [])

  const value: AuthContextValue = {
    user, loading, login, logout, setUser,
    isAdmin: user?.role === 'admin',
    isTrainer: user?.role === 'trainer' || user?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

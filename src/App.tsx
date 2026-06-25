import { createContext } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useStore } from './store/useStore'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { Kalender } from './pages/Kalender'
import { Zeiten } from './pages/Zeiten'
import { Ergebnisse } from './pages/Ergebnisse'
import { Dokumente } from './pages/Dokumente'

type StoreType = ReturnType<typeof useStore>
export const StoreContext = createContext<StoreType | null>(null)

export default function App() {
  const store = useStore()
  return (
    <StoreContext.Provider value={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kalender" element={<Kalender />} />
          <Route path="/zeiten" element={<Zeiten />} />
          <Route path="/ergebnisse" element={<Ergebnisse />} />
          <Route path="/dokumente" element={<Dokumente />} />
        </Routes>
        <BottomNav />
      </BrowserRouter>
    </StoreContext.Provider>
  )
}

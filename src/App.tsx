import { createContext, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useStore } from './store/useStore'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { Kalender } from './pages/Kalender'
import { Zeiten } from './pages/Zeiten'
import { Ergebnisse } from './pages/Ergebnisse'
import { Dokumente } from './pages/Dokumente'
import { ApiConfigModal } from './components/ApiConfigModal'

type StoreType = ReturnType<typeof useStore>
export const StoreContext = createContext<StoreType | null>(null)
export const ApiConfigContext = createContext<{ openConfig: () => void }>({ openConfig: () => {} })

export default function App() {
  const store = useStore()
  const [configOpen, setConfigOpen] = useState(false)
  return (
    <StoreContext.Provider value={store}>
      <ApiConfigContext.Provider value={{ openConfig: () => setConfigOpen(true) }}>
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
        <ApiConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
      </ApiConfigContext.Provider>
    </StoreContext.Provider>
  )
}

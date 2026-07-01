import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Reload the page when a new service worker takes control (update installed).
// controllerchange only fires when the controller *changes* (not on first install
// if we capture prevController before listening).
if ('serviceWorker' in navigator) {
  const prevController = navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (prevController) window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

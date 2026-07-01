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

// Track the visual viewport height so the layout shrinks when the iOS keyboard
// opens. dvh and interactive-widget are ignored by iOS Safari in standalone PWA
// mode; visualViewport.resize is the only reliable signal available.
function syncVV() {
  const h = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty('--vvh', `${h}px`)
  // iOS scrolls the window when the keyboard opens to reveal the focused input.
  // We reset that scroll immediately so the fixed-height container stays at
  // the top of the screen and the content doesn't slide out of view.
  if (window.scrollY !== 0) window.scrollTo(0, 0)
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncVV)
  window.visualViewport.addEventListener('scroll', syncVV)
} else {
  window.addEventListener('resize', syncVV)
}
syncVV()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

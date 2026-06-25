import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { SwimmerSelectorModal } from './SwimmerSelectorModal'
import type { Swimmer } from '../types'

interface SwimmerChipProps {
  swimmer: Swimmer
  swimmerCount: number
  mode?: 'interactive' | 'readonly'
}

export function SwimmerChip({ swimmer, swimmerCount, mode = 'interactive' }: SwimmerChipProps) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const navigate = useNavigate()
  const initials = swimmer.name.split(' ').filter(Boolean).map(n => n[0]).join('')

  if (mode === 'readonly') {
    return (
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 opacity-70 hover:opacity-100 active:opacity-100 transition-opacity"
        aria-label="Zum Dashboard"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
          style={{ backgroundColor: swimmer.avatarColor }}
        >
          {initials}
        </div>
        <span className="text-slate-400 text-xs">{swimmer.name}</span>
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setSelectorOpen(true)}
        className="flex items-center gap-3"
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0"
          style={{ backgroundColor: swimmer.avatarColor }}
        >
          {initials}
        </div>
        <div>
          <p className="text-slate-400 text-xs">Willkommen zurück</p>
          <p className="text-white font-bold text-xl leading-tight">{swimmer.name}</p>
          <p className="text-sky-400 text-xs flex items-center gap-0.5">
            {swimmer.club}
            {swimmerCount > 1 && <ChevronDown size={10} className="opacity-60" />}
          </p>
        </div>
      </button>
      <SwimmerSelectorModal open={selectorOpen} onClose={() => setSelectorOpen(false)} />
    </>
  )
}

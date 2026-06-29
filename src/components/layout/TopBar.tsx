import React from 'react'

interface TopBarProps {
  title: React.ReactNode
  right?: React.ReactNode
}

export function TopBar({ title, right }: TopBarProps) {
  return (
    <header className="sticky top-0 glass border-b border-white/8 z-30 safe-top">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          {typeof title === 'string'
            ? <h1 className="text-base font-semibold text-white">{title}</h1>
            : title}
        </div>
        {right && <div>{right}</div>}
      </div>
    </header>
  )
}

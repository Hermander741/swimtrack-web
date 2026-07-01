import React from 'react'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

interface PageShellProps {
  title: React.ReactNode
  topBarRight?: React.ReactNode
  fab?: React.ReactNode
  children: React.ReactNode
  fullHeight?: boolean
  hideNav?: boolean
}

export function PageShell({ title, topBarRight, fab, children, fullHeight, hideNav }: PageShellProps) {
  return (
    <div className="h-dvh bg-ocean-950 flex flex-col">
      <TopBar title={title} right={topBarRight} />
      <main className={fullHeight
        ? 'flex-1 flex flex-col overflow-hidden min-h-0'
        : 'flex-1 overflow-y-auto scrollbar-none px-4 pt-4 pb-6'
      }>
        {children}
      </main>
      {fab && (
        <div className="fixed bottom-6 right-4 z-40" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)' }}>{fab}</div>
      )}
      {!hideNav && <BottomNav />}
    </div>
  )
}

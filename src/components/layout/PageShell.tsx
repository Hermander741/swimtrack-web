import React from 'react'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

interface PageShellProps {
  title: string
  topBarRight?: React.ReactNode
  fab?: React.ReactNode
  children: React.ReactNode
  fullHeight?: boolean
}

export function PageShell({ title, topBarRight, fab, children, fullHeight }: PageShellProps) {
  return (
    <div className="h-dvh bg-ocean-950 flex flex-col">
      <TopBar title={title} right={topBarRight} />
      <main className={fullHeight
        ? 'flex-1 flex flex-col overflow-hidden min-h-0'
        : 'flex-1 overflow-y-auto scrollbar-none px-4 pt-4'
      }>
        {children}
      </main>
      {fab && (
        <div className="fixed bottom-24 right-4 z-40">{fab}</div>
      )}
      <BottomNav />
    </div>
  )
}

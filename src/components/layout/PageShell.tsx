import React from 'react'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

interface PageShellProps {
  title: string
  topBarRight?: React.ReactNode
  fab?: React.ReactNode
  children: React.ReactNode
}

export function PageShell({ title, topBarRight, fab, children }: PageShellProps) {
  return (
    <div className="min-h-dvh bg-ocean-950 flex flex-col">
      <TopBar title={title} right={topBarRight} />
      <main className="flex-1 overflow-y-auto scrollbar-none pb-24 px-4 pt-4">
        {children}
      </main>
      {fab && (
        <div className="fixed bottom-24 right-4 z-40">{fab}</div>
      )}
      <BottomNav />
    </div>
  )
}

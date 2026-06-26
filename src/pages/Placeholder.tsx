import { PageShell } from '../components/layout/PageShell'

interface PlaceholderProps {
  title: string
  icon: string
}

export function Placeholder({ title, icon }: PlaceholderProps) {
  return (
    <PageShell title={title}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h2 className="text-xl font-bold text-white mb-2">Kommt bald</h2>
        <p className="text-slate-400 text-sm max-w-xs">
          {title} wird in einem der nächsten Sub-Projekte hinzugefügt.
        </p>
      </div>
    </PageShell>
  )
}

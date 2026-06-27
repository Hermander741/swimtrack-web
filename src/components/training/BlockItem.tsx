import type { TrainingSessionBlock } from '../../types'

const CATEGORY_LABELS: Record<string, string> = {
  aufwaermen: 'Aufwärmen', hauptset: 'Hauptset', abkuehlen: 'Abkühlen',
  kraft: 'Kraft', technik: 'Technik', sonstiges: 'Sonstiges',
}
const CATEGORY_COLORS: Record<string, string> = {
  aufwaermen: 'bg-yellow-500/20 text-yellow-400', hauptset: 'bg-teal-500/20 text-teal-400',
  abkuehlen: 'bg-sky-500/20 text-sky-400', kraft: 'bg-purple-500/20 text-purple-400',
  technik: 'bg-pink-500/20 text-pink-400', sonstiges: 'bg-slate-500/20 text-slate-400',
}

interface BlockItemProps { block: TrainingSessionBlock }

export function BlockItem({ block }: BlockItemProps) {
  const meta: string[] = []
  if (block.distance_m) meta.push(`${block.distance_m}m`)
  if (block.stroke) meta.push(block.stroke)
  if (block.reps) meta.push(`×${block.reps}`)
  if (block.rest_s) meta.push(`${block.rest_s}s Pause`)

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${CATEGORY_COLORS[block.category] ?? CATEGORY_COLORS.sonstiges}`}>
        {CATEGORY_LABELS[block.category] ?? block.category}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm">{block.name}</p>
        {meta.length > 0 && <p className="text-xs text-slate-400 mt-0.5">{meta.join(' · ')}</p>}
        {block.description && <p className="text-xs text-slate-500 mt-0.5">{block.description}</p>}
        {block.override_note && <p className="text-xs text-amber-400/80 mt-0.5 italic">{block.override_note}</p>}
      </div>
    </div>
  )
}

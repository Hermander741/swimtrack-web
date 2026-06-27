import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import type { useTraining } from '../../hooks/useTraining'
import { GroupEditor } from './GroupEditor'
import { BlockLibrary } from './BlockLibrary'
import { TemplateEditor } from './TemplateEditor'
import { SessionCard } from './SessionCard'
import { SessionEditor } from './SessionEditor'
import { listGroups } from '../../api/training'
import type { TrainingGroup, TrainingSession } from '../../types'

type TrainingState = ReturnType<typeof useTraining>

const TABS = ['Übersicht', 'Gruppen', 'Bausteine', 'Templates'] as const
type Tab = typeof TABS[number]

interface TrainerPanelProps {
  training: TrainingState
  onClose: () => void
  onSessionClick: (session: TrainingSession) => void
}

export function TrainerPanel({ training, onClose, onSessionClick }: TrainerPanelProps) {
  const [tab, setTab] = useState<Tab>('Übersicht')
  const [editGroup, setEditGroup] = useState<TrainingGroup | null | 'new'>(null)
  const [showSessionEditor, setShowSessionEditor] = useState(false)

  useEffect(() => {
    training.loadTrainerData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGroupSaved() {
    const res = await listGroups()
    if (res.ok) training.setGroups(res.data)
    setEditGroup(null)
  }

  async function handleGroupDeleted() {
    const res = await listGroups()
    if (res.ok) training.setGroups(res.data)
    setEditGroup(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full glass rounded-t-3xl safe-bottom animate-in slide-in-from-bottom max-h-[90dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center px-6 pt-5 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
          <button onClick={onClose} className="absolute right-4 text-slate-400 hover:text-white p-2 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-1 px-4 pb-3 flex-shrink-0 overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto scrollbar-none px-6 pb-6 flex-1">
          {tab === 'Übersicht' && (
            <div className="space-y-3">
              {showSessionEditor ? (
                <SessionEditor
                  groups={training.groups}
                  blocks={training.blocks}
                  onSaved={training.refreshAll}
                  onClose={() => setShowSessionEditor(false)}
                />
              ) : (
                <>
                  <button
                    onClick={() => { training.loadTrainerData(); setShowSessionEditor(true) }}
                    className="w-full glass rounded-xl p-3 flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors text-sm font-medium"
                  >
                    <Plus size={16} /> Neue Session erstellen
                  </button>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aktuelle Woche</p>
                  {training.sessions.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">Keine Sessions diese Woche</p>
                  ) : (
                    training.sessions.map(s => (
                      <SessionCard key={s.id} session={s} onClick={() => { onClose(); onSessionClick(s) }} />
                    ))
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'Gruppen' && (
            <div className="space-y-3">
              {editGroup !== null ? (
                <>
                  <button onClick={() => setEditGroup(null)} className="text-sm text-slate-400 hover:text-white mb-2">← Zurück</button>
                  <GroupEditor
                    group={editGroup === 'new' ? null : editGroup}
                    onSaved={handleGroupSaved}
                    onDeleted={handleGroupDeleted}
                  />
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditGroup('new')}
                    className="w-full glass rounded-xl p-3 flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors text-sm font-medium"
                  >
                    <Plus size={16} /> Neue Gruppe
                  </button>
                  {training.groups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setEditGroup(g)}
                      className="w-full glass rounded-xl p-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{g.name}</p>
                        {g.description && <p className="text-xs text-slate-400 truncate">{g.description}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'Bausteine' && (
            <BlockLibrary
              blocks={training.blocks}
              onChanged={training.setBlocks}
            />
          )}

          {tab === 'Templates' && (
            <TemplateEditor
              groups={training.groups}
              blocks={training.blocks}
              templates={training.templates}
              onChanged={training.setTemplates}
              onSessionsGenerated={training.refreshAll}
            />
          )}
        </div>
      </div>
    </div>
  )
}

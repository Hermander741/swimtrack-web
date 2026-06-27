import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTraining } from '../hooks/useTraining'
import { PageShell } from '../components/layout/PageShell'
import { ListView } from '../components/training/ListView'
import { WeekView } from '../components/training/WeekView'
import { SessionDetail } from '../components/training/SessionDetail'
import { TrainerPanel } from '../components/training/TrainerPanel'
import type { TrainingSession } from '../types'

export function Training() {
  const { user } = useAuth()
  const training = useTraining()
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null)
  const [showTrainerPanel, setShowTrainerPanel] = useState(false)
  const isTrainer = user?.role === 'admin' || user?.role === 'trainer'

  const fab = isTrainer ? (
    <button
      onClick={() => setShowTrainerPanel(true)}
      className="w-14 h-14 bg-gradient-to-r from-teal-500 to-sky-500 rounded-full shadow-lg shadow-teal-500/25 flex items-center justify-center text-white active:scale-95 transition-transform"
    >
      <Plus size={24} />
    </button>
  ) : undefined

  return (
    <PageShell
      title="Trainingsplan"
      topBarRight={
        <div className="flex gap-1">
          <button
            onClick={() => training.setView('list')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${training.view === 'list' ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400'}`}
          >
            Liste
          </button>
          <button
            onClick={() => training.setView('week')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${training.view === 'week' ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400'}`}
          >
            Woche
          </button>
        </div>
      }
      fab={fab}
    >
      {training.loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : training.view === 'list' ? (
        <ListView sessions={training.sessions} onSelect={setSelectedSession} />
      ) : (
        <WeekView
          weekStart={training.weekStart}
          weekEnd={training.weekEnd}
          sessions={training.sessions}
          onSelect={setSelectedSession}
          onPrev={training.prevWeek}
          onNext={training.nextWeek}
          onToday={training.goToCurrentWeek}
        />
      )}

      {selectedSession && (
        <SessionDetail session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}

      {isTrainer && showTrainerPanel && (
        <TrainerPanel
          training={training}
          onClose={() => setShowTrainerPanel(false)}
          onSessionClick={setSelectedSession}
        />
      )}
    </PageShell>
  )
}

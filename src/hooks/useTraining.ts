import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import type { TrainingGroup, TrainingSession, TrainingBlock, TrainingTemplate } from '../types'
import { listGroups, listSessions, listBlocks, listTemplates } from '../api/training'

export type TrainingView = 'list' | 'week'

export function useTraining() {
  const [view, setView] = useState<TrainingView>('list')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [groups, setGroups] = useState<TrainingGroup[]>([])
  const [blocks, setBlocks] = useState<TrainingBlock[]>([])
  const [templates, setTemplates] = useState<TrainingTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const fetchSessions = useCallback(async (from: Date, to: Date) => {
    setLoading(true)
    const res = await listSessions(format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd'))
    if (res.ok) setSessions(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    const from = view === 'list' ? new Date() : weekStart
    const to = view === 'list' ? addDays(new Date(), 21) : weekEnd
    fetchSessions(from, to)
  }, [view, weekStart, weekEnd, fetchSessions])

  useEffect(() => {
    listGroups().then(res => { if (res.ok) setGroups(res.data) })
  }, [])

  const prevWeek = () => setWeekStart(w => addDays(w, -7))
  const nextWeek = () => setWeekStart(w => addDays(w, 7))
  const goToCurrentWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  const refreshAll = useCallback(async () => {
    const [blocksRes, templatesRes] = await Promise.all([listBlocks(), listTemplates()])
    if (blocksRes.ok) setBlocks(blocksRes.data)
    if (templatesRes.ok) setTemplates(templatesRes.data)
    const from = view === 'list' ? new Date() : weekStart
    const to = view === 'list' ? addDays(new Date(), 21) : weekEnd
    await fetchSessions(from, to)
  }, [view, weekStart, weekEnd, fetchSessions])

  const loadTrainerData = useCallback(async () => {
    const [blocksRes, templatesRes] = await Promise.all([listBlocks(), listTemplates()])
    if (blocksRes.ok) setBlocks(blocksRes.data)
    if (templatesRes.ok) setTemplates(templatesRes.data)
  }, [])

  return {
    view, setView, weekStart, weekEnd,
    sessions, setSessions,
    groups, setGroups,
    blocks, setBlocks,
    templates, setTemplates,
    loading,
    prevWeek, nextWeek, goToCurrentWeek,
    refreshAll, loadTrainerData, fetchSessions,
  }
}

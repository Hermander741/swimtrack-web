import { useState, useEffect, useCallback } from 'react'
import type { Swimmer, SwimTime, Competition, PDFDocument } from '../types'

const STORAGE_KEYS = {
  swimmers: 'swimtrack_swimmers',
  times: 'swimtrack_times',
  competitions: 'swimtrack_competitions',
  pdfs: 'swimtrack_pdfs',
  activeSwimmerId: 'swimtrack_active_swimmer',
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

const DEMO_SWIMMER: Swimmer = {
  id: 'swimmer-1',
  name: 'Max Muster',
  birthYear: 2012,
  club: 'SV Wien',
  avatarColor: '#0ea5e9',
}

const today = new Date()
const fmt = (d: Date) => d.toISOString().split('T')[0]
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }

const DEMO_COMPETITIONS: Competition[] = [
  {
    id: 'comp-1',
    name: 'Wiener Stadtmeisterschaften',
    location: 'Stadionbad Wien',
    startDate: fmt(addDays(today, 12)),
    endDate: fmt(addDays(today, 13)),
    course: 'LB',
    organizer: 'Wiener Schwimmverband',
    status: 'upcoming',
    registered: true,
  },
  {
    id: 'comp-2',
    name: 'NÖ Landesmeisterschaften Jugend',
    location: 'Schwimmhalle Krems',
    startDate: fmt(addDays(today, 34)),
    endDate: fmt(addDays(today, 35)),
    course: 'LB',
    organizer: 'NÖ Schwimmverband',
    status: 'upcoming',
    registered: false,
  },
  {
    id: 'comp-3',
    name: 'Austria Open Kurzbahn',
    location: 'Sportbad Linz',
    startDate: fmt(addDays(today, -14)),
    endDate: fmt(addDays(today, -13)),
    course: 'KB',
    organizer: 'ÖSV',
    status: 'past',
    registered: true,
  },
  {
    id: 'comp-4',
    name: 'Frühjahrsschwimmen Graz',
    location: 'Hallenbad Graz',
    startDate: fmt(addDays(today, 0)),
    endDate: fmt(addDays(today, 1)),
    course: 'KB',
    organizer: 'Stmk. Schwimmverband',
    status: 'ongoing',
    registered: true,
  },
]

const DEMO_TIMES: SwimTime[] = [
  { id: 't1', swimmerId: 'swimmer-1', event: '100m Freistil', course: 'LB', timeMs: 63420, date: fmt(addDays(today, -14)), competition: 'Austria Open Kurzbahn', isPersonalBest: true },
  { id: 't2', swimmerId: 'swimmer-1', event: '50m Freistil', course: 'LB', timeMs: 29800, date: fmt(addDays(today, -14)), competition: 'Austria Open Kurzbahn', isPersonalBest: true },
  { id: 't3', swimmerId: 'swimmer-1', event: '200m Lagen', course: 'LB', timeMs: 152340, date: fmt(addDays(today, -45)), competition: 'Herbst Cup', isPersonalBest: false },
  { id: 't4', swimmerId: 'swimmer-1', event: '200m Lagen', course: 'LB', timeMs: 149820, date: fmt(addDays(today, -14)), competition: 'Austria Open Kurzbahn', isPersonalBest: true },
  { id: 't5', swimmerId: 'swimmer-1', event: '100m Rücken', course: 'KB', timeMs: 71200, date: fmt(addDays(today, -60)), competition: 'Wintermeeting', isPersonalBest: true },
  { id: 't6', swimmerId: 'swimmer-1', event: '50m Brust', course: 'KB', timeMs: 38500, date: fmt(addDays(today, -30)), competition: 'Vereinsmeisterschaften', isPersonalBest: true },
]

export function useStore() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>(() => {
    const stored = load<Swimmer[]>(STORAGE_KEYS.swimmers, [])
    return stored.length ? stored : [DEMO_SWIMMER]
  })
  const [times, setTimes] = useState<SwimTime[]>(() => {
    const stored = load<SwimTime[]>(STORAGE_KEYS.times, [])
    return stored.length ? stored : DEMO_TIMES
  })
  const [competitions, setCompetitions] = useState<Competition[]>(() => {
    const stored = load<Competition[]>(STORAGE_KEYS.competitions, [])
    return stored.length ? stored : DEMO_COMPETITIONS
  })
  const [pdfs, setPdfs] = useState<PDFDocument[]>(() => load<PDFDocument[]>(STORAGE_KEYS.pdfs, []))

  const [activeSwimmerId, setActiveSwimmerIdState] = useState<string | null>(() => {
    const storedActive = load<string | null>(STORAGE_KEYS.activeSwimmerId, null)
    const storedSwimmers = load<Swimmer[]>(STORAGE_KEYS.swimmers, [])
    const allSwimmers = storedSwimmers.length ? storedSwimmers : [DEMO_SWIMMER]
    if (storedActive && allSwimmers.some(s => s.id === storedActive)) return storedActive
    return allSwimmers[0]?.id ?? null
  })

  useEffect(() => { save(STORAGE_KEYS.swimmers, swimmers) }, [swimmers])
  useEffect(() => { save(STORAGE_KEYS.times, times) }, [times])
  useEffect(() => { save(STORAGE_KEYS.competitions, competitions) }, [competitions])
  useEffect(() => { save(STORAGE_KEYS.pdfs, pdfs) }, [pdfs])
  useEffect(() => { save(STORAGE_KEYS.activeSwimmerId, activeSwimmerId) }, [activeSwimmerId])

  // Fix up activeSwimmerId when the swimmers list changes (e.g. after delete)
  useEffect(() => {
    if (swimmers.length === 0) {
      setActiveSwimmerIdState(null)
      return
    }
    if (!swimmers.find(s => s.id === activeSwimmerId)) {
      setActiveSwimmerIdState(swimmers[0].id)
    }
  }, [swimmers, activeSwimmerId])

  const addSwimmer = useCallback((s: Swimmer) => {
    setSwimmers(p => [...p, s])
    setActiveSwimmerIdState(prev => prev ?? s.id)
  }, [])
  const updateSwimmer = useCallback((s: Swimmer) => setSwimmers(p => p.map(x => x.id === s.id ? s : x)), [])
  const removeSwimmer = useCallback((id: string) => {
    setSwimmers(p => p.filter(x => x.id !== id))
    setTimes(p => p.filter(x => x.swimmerId !== id))
  }, [])

  const setActiveSwimmerId = useCallback((id: string) => setActiveSwimmerIdState(id), [])

  const addTime = useCallback((t: SwimTime) => {
    setTimes(prev => {
      const updated = prev.map(x => {
        if (x.swimmerId === t.swimmerId && x.event === t.event && x.course === t.course && x.isPersonalBest) {
          return t.timeMs < x.timeMs ? { ...x, isPersonalBest: false } : x
        }
        return x
      })
      const existingPB = updated.find(x => x.swimmerId === t.swimmerId && x.event === t.event && x.course === t.course && x.isPersonalBest)
      const isNewPB = !existingPB || t.timeMs < existingPB.timeMs
      return [...updated, { ...t, isPersonalBest: isNewPB }]
    })
  }, [])

  const removeTime = useCallback((id: string) => setTimes(p => p.filter(x => x.id !== id)), [])

  const addCompetition = useCallback((c: Competition) => setCompetitions(p => [...p, c]), [])
  const updateCompetition = useCallback((c: Competition) => setCompetitions(p => p.map(x => x.id === c.id ? c : x)), [])
  const removeCompetition = useCallback((id: string) => setCompetitions(p => p.filter(x => x.id !== id)), [])

  const addPDF = useCallback((doc: PDFDocument) => setPdfs(p => [...p, doc]), [])
  const removePDF = useCallback((id: string) => setPdfs(p => p.filter(x => x.id !== id)), [])

  const getPersonalBests = useCallback((swimmerId: string) => {
    return times.filter(t => t.swimmerId === swimmerId && t.isPersonalBest)
  }, [times])

  const activeSwimmer = swimmers.find(s => s.id === activeSwimmerId)

  return {
    swimmers, addSwimmer, updateSwimmer, removeSwimmer,
    times, addTime, removeTime,
    competitions, addCompetition, updateCompetition, removeCompetition,
    pdfs, addPDF, removePDF,
    getPersonalBests,
    activeSwimmerId, activeSwimmer, setActiveSwimmerId,
  }
}

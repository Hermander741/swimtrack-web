# Multi-Swimmer Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `swimmers[0]` pattern with a flexible active-swimmer system, with UI to add, switch, edit, and delete swimmers.

**Architecture:** A new `activeSwimmerId` field in the store (persisted to localStorage) drives a derived `activeSwimmer` getter. Three new components handle swimmer management: `SwimmerFormModal` (add/edit form), `SwimmerSelectorModal` (list + switch + CRUD), and `SwimmerChip` (header avatar that opens the selector or navigates to Dashboard in readonly mode). No new routes or context layers — everything flows through the existing `StoreContext`.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS v4, Vite 8, localStorage. No test framework is configured; verification is manual via `npm run dev`.

## Global Constraints

- All UI copy in German (Austrian): "Schwimmer", "Verein", "Geburtsjahr", "Hinzufügen", "Speichern", "Löschen"
- Locale: `de-AT` for all date formatting
- Course labels: `LB` = Langbahn (50m), `KB` = Kurzbahn (25m)
- Colors only from `AVATAR_COLORS` in `src/utils/format.ts`
- All new components follow existing dark-mode palette: `slate-950/900/800` backgrounds, `sky-400/500` accents, `rounded-2xl` / `rounded-xl` borders
- `StoreContext` from `src/App.tsx` is the only data source — no prop drilling through more than 1 level

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/store/useStore.ts` | Modify | Add `activeSwimmerId` state, `activeSwimmer` getter, `setActiveSwimmerId` action, cascade delete in `removeSwimmer`, auto-activate in `addSwimmer` |
| `src/components/SwimmerFormModal.tsx` | Create | Add/edit form: name, birthYear, club, avatarColor picker |
| `src/components/SwimmerSelectorModal.tsx` | Create | List all swimmers, active indicator, switch, add (opens form), edit (opens form), delete with guard |
| `src/components/SwimmerChip.tsx` | Create | Avatar chip in two modes: `interactive` (opens selector, used on Dashboard) and `readonly` (navigates to `/`, used on other pages) |
| `src/pages/Dashboard.tsx` | Modify | Replace `swimmers[0]` + avatar block with `SwimmerChip` (interactive); add onboarding state when no swimmers |
| `src/pages/Zeiten.tsx` | Modify | Replace `swimmers[0]` with `activeSwimmer`; add readonly `SwimmerChip` in header |
| `src/pages/Kalender.tsx` | Modify | Add readonly `SwimmerChip` in header (page data is not swimmer-specific) |
| `src/pages/Dokumente.tsx` | Modify | Add readonly `SwimmerChip` in header (page data is not swimmer-specific) |

---

## Task 1: Store — activeSwimmerId, activeSwimmer, cascade delete

**Files:**
- Modify: `src/store/useStore.ts`

**Interfaces produced:**
- `store.activeSwimmerId: string | null`
- `store.activeSwimmer: Swimmer | undefined`
- `store.setActiveSwimmerId(id: string): void`
- `store.removeSwimmer(id)` now also deletes all `SwimTime` entries with that `swimmerId`
- `store.addSwimmer(s)` auto-activates the new swimmer if `activeSwimmerId` is currently null

---

- [ ] **Step 1: Add storage key and state**

  In `src/store/useStore.ts`, extend `STORAGE_KEYS` and add the new state:

  ```ts
  const STORAGE_KEYS = {
    swimmers: 'swimtrack_swimmers',
    times: 'swimtrack_times',
    competitions: 'swimtrack_competitions',
    pdfs: 'swimtrack_pdfs',
    activeSwimmerId: 'swimtrack_active_swimmer',   // add this line
  }
  ```

  Inside `useStore`, after the existing `useState` declarations, add:

  ```ts
  const [activeSwimmerId, setActiveSwimmerIdState] = useState<string | null>(() => {
    const storedActive = load<string | null>(STORAGE_KEYS.activeSwimmerId, null)
    const storedSwimmers = load<Swimmer[]>(STORAGE_KEYS.swimmers, [])
    const allSwimmers = storedSwimmers.length ? storedSwimmers : [DEMO_SWIMMER]
    if (storedActive && allSwimmers.some(s => s.id === storedActive)) return storedActive
    return allSwimmers[0]?.id ?? null
  })
  ```

- [ ] **Step 2: Persist and derive**

  After the existing `useEffect` blocks (the four that call `save`), add:

  ```ts
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
  ```

  Just before the `return` statement, derive the active swimmer:

  ```ts
  const activeSwimmer = swimmers.find(s => s.id === activeSwimmerId)
  ```

- [ ] **Step 3: Update addSwimmer, removeSwimmer, add setActiveSwimmerId**

  Replace the existing `addSwimmer` and `removeSwimmer` with:

  ```ts
  const addSwimmer = useCallback((s: Swimmer) => {
    setSwimmers(p => [...p, s])
    setActiveSwimmerIdState(prev => prev ?? s.id)
  }, [])

  const removeSwimmer = useCallback((id: string) => {
    setSwimmers(p => p.filter(x => x.id !== id))
    setTimes(p => p.filter(x => x.swimmerId !== id))
  }, [])
  ```

  Add the new action (alongside the other `useCallback`s):

  ```ts
  const setActiveSwimmerId = useCallback((id: string) => setActiveSwimmerIdState(id), [])
  ```

- [ ] **Step 4: Add to return value**

  In the `return { ... }` object, add:

  ```ts
  activeSwimmerId, activeSwimmer, setActiveSwimmerId,
  ```

- [ ] **Step 5: Verify in browser**

  ```bash
  cd /Users/hermanurban/swimtrack-web && npm run dev
  ```

  Open DevTools → Application → Local Storage. After app loads, confirm `swimtrack_active_swimmer` exists and equals `"swimmer-1"` (the demo swimmer's id). No console errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/store/useStore.ts
  git commit -m "feat: add activeSwimmerId, activeSwimmer, cascade delete to store"
  ```

---

## Task 2: SwimmerFormModal — add/edit form

**Files:**
- Create: `src/components/SwimmerFormModal.tsx`

**Interfaces:**
- Consumes: `StoreContext` → `store.addSwimmer`, `store.updateSwimmer`; `AVATAR_COLORS`, `generateId` from `src/utils/format.ts`; `Swimmer` from `src/types/index.ts`; `Modal` from `src/components/Modal.tsx`
- Produces: `SwimmerFormModal({ open, onClose, swimmer? })` — `swimmer` prop = edit mode, undefined/null = add mode

---

- [ ] **Step 1: Create the file**

  Create `src/components/SwimmerFormModal.tsx` with the following content:

  ```tsx
  import { useState, useEffect, useContext } from 'react'
  import { Modal } from './Modal'
  import { StoreContext } from '../App'
  import { AVATAR_COLORS, generateId } from '../utils/format'
  import type { Swimmer } from '../types'

  interface SwimmerFormModalProps {
    open: boolean
    onClose: () => void
    swimmer?: Swimmer | null
  }

  export function SwimmerFormModal({ open, onClose, swimmer }: SwimmerFormModalProps) {
    const store = useContext(StoreContext)!
    const isEdit = !!swimmer
    const [form, setForm] = useState({
      name: '',
      birthYear: '',
      club: '',
      avatarColor: AVATAR_COLORS[0],
    })

    useEffect(() => {
      setForm({
        name: swimmer?.name ?? '',
        birthYear: swimmer?.birthYear?.toString() ?? '',
        club: swimmer?.club ?? '',
        avatarColor: swimmer?.avatarColor ?? AVATAR_COLORS[0],
      })
    }, [swimmer])

    function submit(e: React.FormEvent) {
      e.preventDefault()
      const year = parseInt(form.birthYear)
      if (isEdit) {
        store.updateSwimmer({ ...swimmer!, name: form.name, birthYear: year, club: form.club, avatarColor: form.avatarColor })
      } else {
        store.addSwimmer({ id: generateId(), name: form.name, birthYear: year, club: form.club, avatarColor: form.avatarColor })
      }
      onClose()
    }

    return (
      <Modal open={open} onClose={onClose} title={isEdit ? 'Schwimmer bearbeiten' : 'Schwimmer hinzufügen'}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
              placeholder="z.B. Max Muster"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Geburtsjahr *</label>
            <input
              required
              type="number"
              min={1950}
              max={new Date().getFullYear()}
              value={form.birthYear}
              onChange={e => setForm(f => ({ ...f, birthYear: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
              placeholder="z.B. 2012"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Verein *</label>
            <input
              required
              value={form.club}
              onChange={e => setForm(f => ({ ...f, club: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
              placeholder="z.B. SV Wien"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-2">Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, avatarColor: color }))}
                  className={`w-8 h-8 rounded-full transition-all ${form.avatarColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {isEdit ? 'Speichern' : 'Hinzufügen'}
          </button>
        </form>
      </Modal>
    )
  }
  ```

- [ ] **Step 2: Verify in browser**

  Temporarily import and render `<SwimmerFormModal open={true} onClose={() => {}} />` somewhere (e.g. at the bottom of Dashboard). Confirm the modal appears with all 4 fields + color picker. Remove the temporary import after confirming.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/SwimmerFormModal.tsx
  git commit -m "feat: add SwimmerFormModal for add/edit swimmer"
  ```

---

## Task 3: SwimmerSelectorModal — list, switch, add, edit, delete

**Files:**
- Create: `src/components/SwimmerSelectorModal.tsx`

**Interfaces:**
- Consumes: `StoreContext` → `store.swimmers`, `store.activeSwimmer`, `store.setActiveSwimmerId`, `store.removeSwimmer`; `SwimmerFormModal` from Task 2; `Modal` from `src/components/Modal.tsx`; `Swimmer` from `src/types/index.ts`
- Produces: `SwimmerSelectorModal({ open, onClose })` — opens the form modal for add/edit internally

---

- [ ] **Step 1: Create the file**

  Create `src/components/SwimmerSelectorModal.tsx`:

  ```tsx
  import { useContext, useState } from 'react'
  import { Plus, Check, Pencil, Trash2 } from 'lucide-react'
  import { Modal } from './Modal'
  import { SwimmerFormModal } from './SwimmerFormModal'
  import { StoreContext } from '../App'
  import type { Swimmer } from '../types'

  interface SwimmerSelectorModalProps {
    open: boolean
    onClose: () => void
  }

  export function SwimmerSelectorModal({ open, onClose }: SwimmerSelectorModalProps) {
    const store = useContext(StoreContext)!
    const [formOpen, setFormOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<Swimmer | null>(null)

    function handleSelect(id: string) {
      store.setActiveSwimmerId(id)
      onClose()
    }

    function handleEdit(s: Swimmer, e: React.MouseEvent) {
      e.stopPropagation()
      setEditTarget(s)
      setFormOpen(true)
    }

    function handleDelete(s: Swimmer, e: React.MouseEvent) {
      e.stopPropagation()
      if (store.swimmers.length <= 1) return
      store.removeSwimmer(s.id)
    }

    function handleFormClose() {
      setFormOpen(false)
      setEditTarget(null)
    }

    return (
      <>
        <Modal open={open} onClose={onClose} title="Schwimmer wechseln">
          <div className="space-y-1 mb-4">
            {store.swimmers.map(s => {
              const initials = s.name.split(' ').map(n => n[0]).join('')
              const isActive = store.activeSwimmer?.id === s.id
              const canDelete = store.swimmers.length > 1
              return (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${isActive ? 'bg-sky-500/10' : 'hover:bg-slate-700/50'}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: s.avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{s.name}</p>
                    <p className="text-slate-400 text-xs">{s.club} · {s.birthYear}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isActive && <Check size={15} className="text-sky-400 mr-1" />}
                    <button
                      onClick={e => handleEdit(s, e)}
                      className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={e => handleDelete(s, e)}
                      disabled={!canDelete}
                      className={`p-1.5 rounded-lg transition-colors ${canDelete ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-700' : 'text-slate-700 cursor-not-allowed'}`}
                      title={canDelete ? 'Löschen' : 'Letzter Schwimmer kann nicht gelöscht werden'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => { setEditTarget(null); setFormOpen(true) }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-sky-500 hover:text-sky-400 transition-colors text-sm"
          >
            <Plus size={16} />
            Schwimmer hinzufügen
          </button>
        </Modal>
        <SwimmerFormModal open={formOpen} onClose={handleFormClose} swimmer={editTarget} />
      </>
    )
  }
  ```

- [ ] **Step 2: Verify in browser**

  Temporarily render `<SwimmerSelectorModal open={true} onClose={() => {}} />` in Dashboard. Verify:
  - Demo swimmer "Max Muster" shown with checkmark
  - Delete button is disabled (only 1 swimmer)
  - "+ Schwimmer hinzufügen" button opens the form modal
  - Adding a second swimmer shows both in the list, delete becomes enabled on both
  - Switching swimmers and reopening the modal shows the correct checkmark
  - Editing a swimmer updates the name/club in the list

  Remove temporary render after confirming.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/SwimmerSelectorModal.tsx
  git commit -m "feat: add SwimmerSelectorModal with list, switch, add, edit, delete"
  ```

---

## Task 4: SwimmerChip — interactive and readonly modes

**Files:**
- Create: `src/components/SwimmerChip.tsx`

**Interfaces:**
- Consumes: `SwimmerSelectorModal` from Task 3; `Swimmer` from `src/types/index.ts`; `useNavigate` from `react-router-dom`
- Produces:
  - `SwimmerChip({ swimmer, swimmerCount, mode? })` — default `mode='interactive'`
  - `mode='interactive'`: large avatar + name + club + "wechseln" hint when >1 swimmer; tap opens `SwimmerSelectorModal`
  - `mode='readonly'`: compact chip (small avatar + name); tap navigates to `/`

---

- [ ] **Step 1: Create the file**

  Create `src/components/SwimmerChip.tsx`:

  ```tsx
  import { useState } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { ChevronDown } from 'lucide-react'
  import { SwimmerSelectorModal } from './SwimmerSelectorModal'
  import type { Swimmer } from '../types'

  interface SwimmerChipProps {
    swimmer: Swimmer
    swimmerCount: number
    mode?: 'interactive' | 'readonly'
  }

  export function SwimmerChip({ swimmer, swimmerCount, mode = 'interactive' }: SwimmerChipProps) {
    const [selectorOpen, setSelectorOpen] = useState(false)
    const navigate = useNavigate()
    const initials = swimmer.name.split(' ').map(n => n[0]).join('')

    if (mode === 'readonly') {
      return (
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 opacity-70 hover:opacity-100 active:opacity-100 transition-opacity"
          aria-label="Zum Dashboard"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
            style={{ backgroundColor: swimmer.avatarColor }}
          >
            {initials}
          </div>
          <span className="text-slate-400 text-xs">{swimmer.name}</span>
        </button>
      )
    }

    return (
      <>
        <button
          onClick={() => setSelectorOpen(true)}
          className="flex items-center gap-3"
          aria-label="Schwimmer wechseln"
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0"
            style={{ backgroundColor: swimmer.avatarColor }}
          >
            {initials}
          </div>
          <div>
            <p className="text-slate-400 text-xs">Willkommen zurück</p>
            <h1 className="text-white font-bold text-xl leading-tight">{swimmer.name}</h1>
            <p className="text-sky-400 text-xs flex items-center gap-0.5">
              {swimmer.club}
              {swimmerCount > 1 && <ChevronDown size={10} className="opacity-60" />}
            </p>
          </div>
        </button>
        <SwimmerSelectorModal open={selectorOpen} onClose={() => setSelectorOpen(false)} />
      </>
    )
  }
  ```

- [ ] **Step 2: Verify in browser**

  Temporarily render both modes in Dashboard:
  ```tsx
  <SwimmerChip swimmer={store.swimmers[0]} swimmerCount={1} mode="interactive" />
  <SwimmerChip swimmer={store.swimmers[0]} swimmerCount={1} mode="readonly" />
  ```
  Confirm interactive chip opens SwimmerSelectorModal on tap. Confirm readonly chip navigates to `/` (no-op when already on Dashboard, but check the navigate call fires). Remove temporary renders.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/SwimmerChip.tsx
  git commit -m "feat: add SwimmerChip component (interactive and readonly modes)"
  ```

---

## Task 5: Dashboard — wire up SwimmerChip and onboarding

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `store.activeSwimmer` (replaces `store.swimmers[0]`); `SwimmerChip` from Task 4; `SwimmerFormModal` from Task 2

---

- [ ] **Step 1: Update imports and swimmer reference**

  At the top of `src/pages/Dashboard.tsx`, add imports:

  ```tsx
  import { useContext, useState } from 'react'   // add useState
  import { SwimmerChip } from '../components/SwimmerChip'
  import { SwimmerFormModal } from '../components/SwimmerFormModal'
  ```

  Inside the `Dashboard` function, change:

  ```tsx
  // Before:
  const swimmer = store.swimmers[0]

  // After:
  const swimmer = store.activeSwimmer
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  ```

- [ ] **Step 2: Replace the avatar block with SwimmerChip**

  In the hero header section, find the block starting with:

  ```tsx
  <div className="flex items-center gap-3 mb-6">
    {swimmer ? (
      <>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
          style={{ backgroundColor: swimmer.avatarColor }}
        >
          {swimmer.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <p className="text-slate-400 text-xs">Willkommen zurück</p>
          <h1 className="text-white font-bold text-xl leading-tight">{swimmer.name}</h1>
          <p className="text-sky-400 text-xs">{swimmer.club}</p>
        </div>
      </>
    ) : (
      <div>
        <p className="text-slate-400 text-xs">Willkommen bei</p>
        <h1 className="text-white font-bold text-xl">SwimTrack Austria</h1>
      </div>
    )}
  ```

  Replace it with:

  ```tsx
  <div className="flex items-center gap-3 mb-6">
    {swimmer ? (
      <SwimmerChip
        swimmer={swimmer}
        swimmerCount={store.swimmers.length}
        mode="interactive"
      />
    ) : (
      <div>
        <p className="text-slate-400 text-xs">Willkommen bei</p>
        <h1 className="text-white font-bold text-xl">SwimTrack Austria</h1>
        <button
          onClick={() => setOnboardingOpen(true)}
          className="mt-2 text-sky-400 text-sm flex items-center gap-1.5"
        >
          + Ersten Schwimmer anlegen
        </button>
      </div>
    )}
  ```

  Also close the `div` and add `SwimmerFormModal` for onboarding. Find the closing `</div>` of the `flex items-center gap-3 mb-6` div and add after it (but before the `{/* Next competition hero card */}` block):

  ```tsx
  <SwimmerFormModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
  ```

  The Zap icon button remains unchanged (it's the sibling of the swimmer block, via `ml-auto`).

- [ ] **Step 3: Verify in browser**

  - Dashboard shows SwimmerChip with "Max Muster" and "SV Wien"
  - Tapping the chip opens SwimmerSelectorModal
  - After adding a second swimmer, the chip shows a small ChevronDown hint
  - Switching swimmers updates the hero card's name and PB list instantly
  - Stats row (Bestzeiten count, Zeiten count) updates per active swimmer

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/Dashboard.tsx
  git commit -m "feat: wire SwimmerChip and activeSwimmer into Dashboard"
  ```

---

## Task 6: Zeiten, Kalender, Dokumente — activeSwimmer + readonly chip

**Files:**
- Modify: `src/pages/Zeiten.tsx`
- Modify: `src/pages/Kalender.tsx`
- Modify: `src/pages/Dokumente.tsx`

---

- [ ] **Step 1: Update Zeiten.tsx**

  Add import at top:
  ```tsx
  import { SwimmerChip } from '../components/SwimmerChip'
  ```

  Change the swimmer line:
  ```tsx
  // Before:
  const swimmer = store.swimmers[0]

  // After:
  const swimmer = store.activeSwimmer
  ```

  In the page JSX, find the outer `<div className="px-4 pt-14 pb-4 max-w-lg mx-auto">` and add the readonly chip as the very first child (before the title row):

  ```tsx
  <div className="px-4 pt-14 pb-4 max-w-lg mx-auto">
    {swimmer && (
      <div className="mb-4">
        <SwimmerChip swimmer={swimmer} swimmerCount={store.swimmers.length} mode="readonly" />
      </div>
    )}
    <div className="flex items-center justify-between mb-6">
      {/* existing title row unchanged */}
  ```

- [ ] **Step 2: Update Kalender.tsx**

  Add import at top:
  ```tsx
  import { SwimmerChip } from '../components/SwimmerChip'
  ```

  In the page JSX, find `<div className="px-4 pt-14 pb-4 max-w-lg mx-auto">` and add readonly chip as first child:

  ```tsx
  <div className="px-4 pt-14 pb-4 max-w-lg mx-auto">
    {store.activeSwimmer && (
      <div className="mb-4">
        <SwimmerChip swimmer={store.activeSwimmer} swimmerCount={store.swimmers.length} mode="readonly" />
      </div>
    )}
    <div className="flex items-center justify-between mb-6">
      {/* existing title row unchanged */}
  ```

- [ ] **Step 3: Update Dokumente.tsx**

  Add import at top:
  ```tsx
  import { SwimmerChip } from '../components/SwimmerChip'
  ```

  In the page JSX, find `<div className="px-4 pt-14 pb-4 max-w-lg mx-auto">` and add readonly chip as first child:

  ```tsx
  <div className="px-4 pt-14 pb-4 max-w-lg mx-auto">
    {store.activeSwimmer && (
      <div className="mb-4">
        <SwimmerChip swimmer={store.activeSwimmer} swimmerCount={store.swimmers.length} mode="readonly" />
      </div>
    )}
    <div className="mb-6">
      {/* existing title block unchanged */}
  ```

- [ ] **Step 4: Verify in browser**

  - Navigate to Zeiten, Kalender, Dokumente — each shows the compact swimmer chip at the top
  - Chip shows the active swimmer's initials + name
  - Tapping the chip navigates back to Dashboard
  - Switch swimmer on Dashboard, navigate back to Zeiten — chip updates to new swimmer
  - Zeiten page only shows times for the active swimmer

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/Zeiten.tsx src/pages/Kalender.tsx src/pages/Dokumente.tsx
  git commit -m "feat: add readonly SwimmerChip and activeSwimmer to Zeiten/Kalender/Dokumente"
  ```

---

## Self-Review Checklist

- [x] `activeSwimmerId` persisted and restored on reload — Task 1
- [x] `activeSwimmer` derived, never stale — Task 1 (useEffect fixes up on swimmers change)
- [x] Auto-activate new swimmer if none active — Task 1 `addSwimmer`
- [x] Cascade delete times on swimmer delete — Task 1 `removeSwimmer`
- [x] Delete guard when only 1 swimmer — Task 3 (button disabled, no handler fires)
- [x] Add/edit form with all 4 fields + color picker — Task 2
- [x] Edit pre-populates form via `useEffect([swimmer])` — Task 2
- [x] SwimmerChip interactive on Dashboard — Task 4 + Task 5
- [x] SwimmerChip readonly on Zeiten/Kalender/Dokumente — Task 4 + Task 6
- [x] Readonly chip taps navigate to `/` — Task 4
- [x] Onboarding state when no swimmers — Task 5
- [x] Zeiten filters on `activeSwimmer.id` — Task 6
- [x] Demo swimmer activates on first load (no stored active) — Task 1 initializer

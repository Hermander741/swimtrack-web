# SwimTrack Phase 1: Multi-Swimmer Support

**Date:** 2026-06-25  
**Status:** Approved  
**Scope:** Phase 1 of 3 (Phase 2: Backend + myresults.eu; Phase 3: Charts, FINA-Punkte, Heat Sheet)

## Context

SwimTrack is a German-language PWA for Austrian competitive swimming parents (and optionally coaches/clubs). Currently the app hardcodes `swimmers[0]` throughout, making it single-swimmer only. This spec covers adding flexible multi-swimmer support — usable for a family with 2–3 children or a team of 10–30+.

The chosen approach is a **global swimmer selector in the Dashboard header** (avatar chip → modal), consistent with Apple Health's family member pattern.

## Data Model

No new types needed. The existing `Swimmer` type and `SwimTime.swimmerId` field already support multi-swimmer. One addition to the store:

- **`activeSwimmerId: string | null`** — persisted in localStorage under `swimtrack_active_swimmer`

Rules:
- On app init, if `activeSwimmerId` is null or doesn't match any swimmer, default to `swimmers[0]?.id`
- When a new swimmer is added and no swimmer is currently active, auto-activate the new swimmer
- Deleting the active swimmer activates the first remaining swimmer (or sets null if none left)

## Store Changes

New additions to `useStore`:

```ts
activeSwimmerId: string | null
setActiveSwimmerId: (id: string) => void
activeSwimmer: Swimmer | undefined  // derived getter, not stored
```

The `activeSwimmer` getter is derived: `swimmers.find(s => s.id === activeSwimmerId)`.

All existing actions (`addTime`, `removeTime`, etc.) are unchanged — callers pass `swimmerId` explicitly as they already do.

`removeSwimmer` gets a **cascade delete**: removing a swimmer also removes all `SwimTime` entries with that `swimmerId`. Competitions and PDFs are global and unaffected.

## New Components

### `SwimmerChip`
Replaces the avatar block in the Dashboard header. Shows avatar circle + name + club. If more than one swimmer exists, shows a subtle "wechseln" (switch) indicator. Tapping opens `SwimmerSelectorModal`.

### `SwimmerSelectorModal`
- Lists all swimmers with avatar, name, club
- Active swimmer has a checkmark indicator
- Tapping a swimmer calls `setActiveSwimmerId` and closes the modal
- Plus button at the bottom opens `SwimmerFormModal` in add-mode
- Each list item has edit (pencil) and delete (trash) icons
- Delete is blocked (with a brief inline warning) if only one swimmer exists — so the "no swimmers" state can only occur after a manual localStorage clear, not through normal use

### `SwimmerFormModal`
Used for both add and edit. Fields:
- Name (required)
- Geburtsjahr / Birth year (required, number)
- Verein / Club (required)
- Avatar color — picker using the existing `AVATAR_COLORS` palette from `utils/format.ts`

On submit (add): creates swimmer with `generateId()`, calls `addSwimmer`, auto-activates if no active swimmer.  
On submit (edit): calls `updateSwimmer`.

## Page Changes

### Dashboard
- `swimmer` sourced from `store.activeSwimmer` instead of `store.swimmers[0]`
- Avatar block replaced with `<SwimmerChip />`
- **Empty state:** if no swimmers exist, show an onboarding screen ("Ersten Schwimmer anlegen") instead of the hero block; `SwimmerFormModal` opens automatically

### Zeiten
- `swimmerTimes` filters on `store.activeSwimmer?.id`
- New time entry uses `store.activeSwimmer!.id` as `swimmerId`
- Read-only `SwimmerChip` in top-left — tapping navigates to Dashboard (where the real switcher lives)

### Kalender
- Not swimmer-specific — no data changes
- Read-only `SwimmerChip` in top-left — tapping navigates to Dashboard

### Dokumente
- Not swimmer-specific — no data changes
- Read-only `SwimmerChip` in top-left — tapping navigates to Dashboard

### Ergebnisse
- Unchanged

### BottomNav
- Unchanged — stays 5 tabs, no new "Profil" tab

## Error / Edge Cases

| Case | Behavior |
|------|----------|
| No swimmers in store | Dashboard shows onboarding, modal auto-opens |
| Active swimmer deleted | Activate first remaining swimmer; if none, show onboarding |
| Single swimmer | SwimmerChip shows no "wechseln" hint; delete blocked in modal |
| Demo data on first load | Demo swimmer (`swimmer-1`) becomes the initial active swimmer |

## What This Spec Explicitly Excludes

- Swimmer-specific competition registration (Kalender stays global for now)
- Swimmer-specific document storage (Dokumente stays global for now)
- Authentication or cloud sync (localStorage only)
- Swimmer photos (avatarColor palette is sufficient for Phase 1)

## Roadmap

- **Phase 2:** Backend proxy on Mac Mini (Tailscale for remote access) + myresults.eu + ÖSV live result import
- **Phase 3:** Time progression charts, World Aquatics point calculation, competition heat sheet / start list

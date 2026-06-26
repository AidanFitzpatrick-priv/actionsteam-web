# Prompt: Battle Royale (BR) tracker + split action types by tracker

Implement in **actionsteam-web** (`web/`). Match existing conventions. `npm run build` must pass. Commit and push to `main`.

---

## Context / problem

The action tracker lives at `/months/[slug]/tracker` (`TrackerRow`, `TrackerClient.tsx`, `GET/PATCH /api/months/[slug]/tracker`, live events `tracker.updated`, etc.).

We need a **second tracker** for Battle Royales (BRs) at `/months/[slug]/br-tracker`. BR data is **separate** — not linked to schedule slots, schedule sync, or action goal points.

Both trackers must only show **relevant action types**. The three BR types must **not** appear on the action tracker or schedule.

---

## Type filtering (required)

**BR-only types** (store/display consistently; case-insensitive match OK when filtering):

- `City BR`
- `Cayo BR`
- `Sandy BR`

| Surface | Types shown |
|---------|-------------|
| **Action tracker** (`/months/[slug]/tracker`) | All types **except** the 3 BR types above |
| **BR tracker** (`/months/[slug]/br-tracker`) | **Only** City BR, Cayo BR, Sandy BR |
| **Schedule** (`/months/[slug]/schedule`) | Same as action tracker — **exclude** BR types (BRs are not booked on the schedule grid) |

**Implementation** (prefer schema):

- Add `ActionType.kind` enum: `action` \| `br` (default `action`)
- Seed/upsert the 3 BR types with `kind: br` and distinct `colourHex` values if missing
- Filter in API / `getDropdownOptions()` helpers:
  - Action tracker + schedule → `kind === action`
  - BR tracker → `kind === br`
- **Admin → Action types:** aux+ can set `kind` when adding/editing types
- Existing action tracker rows that already have a BR type may still **display** that type on the row; removing it from the dropdown is enough (no migration required unless trivial)

---

## BR tracker columns

| Column | Behaviour |
|--------|-----------|
| **Date** | Same as action tracker — `actionDate`, DD/MM/YY input, blur-to-save |
| **Type** | Dropdown — only City BR, Cayo BR, Sandy BR (+ colours from `ActionType`) |
| **Status** | Dropdown — **only** `Completed` and `Actions Didn't Attend` |
| **Attended** | Same multi-select checkbox dropdown as action tracker (`accountUsers` from filtered dropdowns) |
| **1st place** | **Text input** — free text for winner ID(s), same UX as action tracker **ID's** column (`idsText`: compact input, blur-to-save, `maxLength` 500, placeholder e.g. `IDs`) |
| **2nd place** | **Text input** — same |
| **3rd place** | **Text input** — same |
| **Winner comped** | Boolean toggle — same UX as action tracker `winnerComped` |

**Not included:** ORG 1, ORG 2, Winner, ORG headcounts, ID's column.

**Important:** 1st / 2nd / 3rd place are **not** account-user dropdowns. Staff type numeric/game IDs manually, like the action tracker ID field.

**Attended** remains the people dropdown (hidden users + management excluded via existing `getDropdownOptions()` / `shouldShowOnGoalTracker` rules).

---

## Schema

### `BrTrackerRow` (on `Month`)

- `id`, `monthId`, `sortOrder`
- `actionDate` (Date?, `@db.Date`)
- `typeName` (String?)
- `status` (String[] — single value stored like action tracker)
- `attended` (String[])
- `firstPlace`, `secondPlace`, `thirdPlace` (String?, map `first_place`, etc.) — **plain text, not user FKs**
- `winnerComped` (Boolean, default false)
- `deletedAt`, `createdAt`, `updatedAt`
- `@@index([monthId, sortOrder])`

### `ActionType`

- Add `kind ActionTypeKind @default(action)` enum `action` \| `br`

Railway deploy uses `prisma db push` on start — columns apply automatically.

---

## Backend

| Area | Paths / notes |
|------|----------------|
| Service | `src/services/br-tracker.ts` — mirror `tracker.ts`: list, patch, add row, soft delete |
| API | `src/app/api/months/[slug]/br-tracker/route.ts` — `GET` + `PATCH` with `action: update\|add\|delete`, audit log, live sync |
| Types filter | Extend `reference-data.ts` / dropdown helpers — `getDropdownOptions({ typeKind: 'action' \| 'br' })` or separate exports |
| Colours | Reuse `getTypeColorMap()` / `colorForType()` |
| Status | BR API returns `statusOptions: ['Completed', "Actions Didn't Attend"]` only |
| Live sync | `br_tracker.updated`, `br_tracker.added`, `br_tracker.deleted` — extend `live-sync.ts` + `useLiveSync` hook |
| Backups | Ensure `BrTrackerRow` included in backup export if backups enumerate models |

**Update existing routes** so action tracker and schedule APIs return **action-only** types (no BR types in dropdown).

---

## Frontend

| Area | Notes |
|------|--------|
| Page | `/months/[slug]/br-tracker/page.tsx` + `BrTrackerClient.tsx` |
| UX | Copy action tracker: table, add row, delete row, `useLiveSync`, `useEditingIds`, blur-to-save text fields |
| Action tracker | Use filtered types from API — no BR types in type dropdown |
| Schedule | Use filtered types from API — no BR types |
| Nav | **BR Tracker** link next to **Tracker** when active month exists |
| Home | Optional link under Schedule & Tracker card |
| CSS | Reuse `.tracker-*` classes or add `.br-tracker-*` column widths if needed |
| Admin types | If using `kind`, add control on Admin → Action types (action vs BR) |

---

## Scope

**In scope:** BR tracker page, API, schema, type split on both trackers + schedule, nav, live sync, admin kind field, backups.

**Out of scope:** Schedule sync for BR rows, action goal points from BRs, stats page changes, booking goals (already removed).

---

## Acceptance criteria

| Scenario | Expected |
|----------|----------|
| Action tracker type dropdown | No City BR, Cayo BR, Sandy BR |
| BR tracker type dropdown | Only City BR, Cayo BR, Sandy BR |
| Schedule type dropdown | No BR types |
| Open `/months/{slug}/br-tracker` | Correct columns; can add rows |
| Edit any field | Persists; live refresh for other viewers |
| BR status dropdown | Only Completed / Actions Didn't Attend |
| 1st / 2nd / 3rd place | Plain text fields; persist on blur; **no user picker** |
| Attended | Checkbox dropdown of account users |
| Winner comped | Toggle saves per row |
| Delete row | Soft-deleted; gone for everyone |
| Action tracker | Otherwise unchanged (ORG, winner, IDs, etc.) |

---

## Deploy

- Tests for `ActionType.kind` filtering if easy
- `npm run test` and `npm run build` pass
- Commit and push to `main`

---

## Files likely touched

| Area | Paths |
|------|--------|
| Schema | `prisma/schema.prisma`, optional `prisma/seed.ts` |
| Types | `src/services/reference-data.ts`, `src/app/admin/data/AdminDataClient.tsx` |
| BR backend | `src/services/br-tracker.ts`, `src/app/api/months/[slug]/br-tracker/route.ts` |
| BR frontend | `src/app/months/[slug]/br-tracker/page.tsx`, `BrTrackerClient.tsx` |
| Existing | `TrackerClient.tsx`, schedule API/client, `src/lib/live-events.ts`, `src/services/live-sync.ts`, `src/hooks/useLiveSync.ts`, `Nav.tsx`, `src/app/page.tsx`, `src/services/backups.ts` |

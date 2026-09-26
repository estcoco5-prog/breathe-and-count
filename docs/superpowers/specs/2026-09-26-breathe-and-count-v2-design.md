# Breathe &amp; Count v2 — design spec

**Date:** 2026-09-26 · **Status:** awaiting Co's review · **Approved mockup:** `docs/2026-09-26-v2-mockup.html` (canvas: https://claude.ai/artifact/FNLG97RDdt74kBnsnKXomR)

Supersedes nothing: v1 (`docs/spec/2026-07-14-breathe-and-count-design.md`) stays the description of Count + Breathe. This spec adds to it.

---

## 1. Intent

Co asked for four things, in their words:

1. *"in the stat tab of each count I want to see the previous count of each day showing in the graph"*
2. *"add another tab for target activities that I would like to track how many day I do not do it"*
3. *"present the design to me that aligned with the old system"*
4. *"can I transfer the previous count and track into the new one"*

Decisions taken with Co during design:

| Question | Co's answer |
|---|---|
| What is a "target activity"? | **Both kinds, chosen per activity** — "activity we would like to build momentum" and "what I will not do" |
| How should past days' numbers appear? | **Number above every bar** (weekly); the monthly view gets numbers inside calendar boxes instead |
| Design direction | Second pass approved: *"I liked this one better"* — depth on cards, dated box grids, three redesigned tab icons |

Success = Co can (a) read any past day's count off the stats screen, (b) track both a daily habit and an abstinence streak in a new Target tab, (c) keep every existing counter and its history, and (d) the app on their iPhone actually updates.

## 2. Scope

**In:** per-day numbers on count stats; a 30-day box grid for counts; a Target tab with two activity kinds and their stats screens; converting an existing counter to a target with history intact; Backup &amp; Restore; a service-worker cache bump; small-text contrast fixes.

**Out:** the Breathe tab (untouched); notifications/reminders; sound or vibration; any server, account or sync; editing a past day's value; dark-mode redesign (existing dark tokens simply gain the new ones).

## 3. Data model

One state object in `localStorage` under the existing key `bc_state`. The key, the origin and the file layout do not change, which is what makes §7 work.

```js
{
  version: 2,
  counters: [ { id, name, kind, goal, limit, createdAt } ],
  history:  { [id]: { 'YYYY-MM-DD': number } }
}
```

`kind` is one of four values. **Targets are counters with a different `kind`** — not a separate array. That is deliberate: it keeps one storage shape, one history map, and makes conversion (§6) a one-field edit rather than a data move.

| `kind` | Tab | Meaning of a day's number | Uses |
|---|---|---|---|
| `good` | Count | how many times you did it | `goal` |
| `bad` | Count | how many times you did it | `limit` |
| `build` | Target | `>= 1` = done that day, `0` = missed | — |
| `avoid` | Target | `>= 1` = slipped that day, `0` = clean | — |

`build`/`avoid` write exactly `1` or `0`, never higher. Nothing about the history format changes, so a day recorded under one kind is readable under any other.

### Migration

`migrate(state)` runs inside `load()`:

- `version` absent → it is a v1 state. Set `version: 2`. **Change nothing else.**
- Before the first v2 *write*, copy the raw v1 JSON to `bc_state_backup_v1`, once, only if that key is absent.
- `kind` not one of the four → coerce to `good` (defensive; cannot occur from v1 data).

Old counters therefore load and behave exactly as they do today.

## 4. Pure logic to add (`js/logic.js`)

All pure, all unit-tested, no DOM. `startKey` = `todayKey(new Date(counter.createdAt))` and bounds every backward walk — the v1 bug where an unbounded walk looped forever must not be reintroduced.

| Function | Returns |
|---|---|
| `isMarked(state, id, key)` | day value `>= 1` |
| `markDay` / `unmarkDay` / `toggleDay` | new state with that day set to `1` / `0` |
| `cleanStreak(days, todayK, startKey)` | consecutive clean days ending today; **`0` if today is a slip** (no grace — a slip today resets it) |
| `buildStreak(days, todayK, startKey)` | consecutive done days; today not yet done does **not** break yesterday's streak. Same rule as v1 `goodStreak`, which terminates on its own because an unrecorded day reads as `0`; `cleanStreak` cannot rely on that, since `0` means clean, which is why only it needs `startKey` |
| `bestRun(days, startKey, todayK, wanted)` | longest run where `marked === wanted` |
| `runList(days, startKey, todayK, wanted)` | `[{ length, endKey, current }]`, longest first, for the "longest runs" card |
| `markedDays(days, startKey, todayK)` | count of days marked |
| `missedDays(days, startKey, todayK)` | days in `[startKey, yesterday]` not marked — **today is never a miss until the day ends** |
| `gridCells(days, startKey, todayK, n)` | `n` trailing days as weekday-aligned cells plus leading blanks: `[{ key, value, dayOfMonth, blank, beforeStart, today }]` |
| `intensityStep(value, goal)` | `0–4` shading step for the count heatmap |
| `weekTotal` / `dailyAverage` / `daysAtGoal` | the three summary chips |

## 5. Screens

Every screen matches the approved mockup element for element. Shared visual additions: 1px inner top highlight plus soft drop shadow on cards; one accent colour per tab; uppercase section labels with a small accent dot.

**New CSS tokens:** `--slate` `#4A5D7E` / `--slate-soft` `#E3E8F1` (Target accent, today's outline); `--honey-deep` `#8A5E17` and `--rose-deep` `#96424A` for text at 11–13px only; grid tints `--cell-done` `#CFE5DA`, `--cell-done-old` `#EDF4F0`, `--cell-count-1..4`. Dark mode gets matching values. Buttons and big numerals keep the colours approved in July.

**Count tab** — progress ring against today's goal; a 7-day strip under the number; the new tally-mark icon; a `Backup & restore` link under "New counter".

**Count stats, weekly** — count above every bar, weekday + date below, dashed goal line, today outlined, and a chip row (streak · week total · daily average).

**Count stats, monthly** — 30 days as a weekday-aligned box grid with **the count printed in every box**, shaded in 5 steps, solid at goal. Replaces the unreadable 30-bar chart.

**Target tab** — a "today" band (`n of m` done · `n` clean), then two labelled groups: *Building momentum* (spruce) and *Not doing* (rose). Each card: name, kind tag, `Stats ›`, the big number, a 7-day box strip, one action button — `Mark today done` / `Done today` (tap toggles) for `build`, an outlined `I slipped today` for `avoid` — and `Edit`.

**Target stats** — hero band with the big number and a bar toward best-ever; three chips; the 30-day box grid; a ranked "longest runs" card. `build` shows streak now / best / days done / days missed; `avoid` shows days clean / best run / slips ever / last slip.

**Tab bar** — three tabs. Active tab sits in a soft tinted pill with a heavier stroke. Icons: tally marks (Count), summit with a peak dot (Target), breath spreading from a point (Breathe).

## 6. Converting an existing counter

The Edit sheet's Type list gains `Target — build momentum` and `Target — will not do`, and shows a before/after strip.

Changing `kind` **only** changes that field. The day history is untouched, so:

- count → `build`: any day with `1+` reads as done; days at `0` read as missed.
- count → `avoid`: any day with `1+` reads as a slip; days at `0` read as clean.
- target → count: marks read as a count of `1`.

Because nothing is overwritten, switching back restores the original numbers exactly. Editing a name never touches history either — history is keyed by `id`.

## 7. Transferring existing data

**In the normal case there is nothing to transfer.** The app is served from the same address, so the phone keeps the same storage area; the update ships new *code*, and the new code reads the old shape (§3). No key is renamed, no data is rewritten on load.

Two things make that safe rather than merely likely:

1. **Automatic one-time backup.** v2 copies the untouched v1 JSON to `bc_state_backup_v1` before its first write.
2. **Backup &amp; restore, shipped in v2.** A small panel with:
   - **Copy my data** — the whole state as JSON in a selectable box (plus a `.json` download on desktop), to paste into Notes or send to yourself.
   - **Paste data here → Restore** — validates the JSON, then *replaces* everything after an explicit confirm. Invalid text is refused with a plain-English reason and changes nothing.

   This is also the answer for the two cases where storage genuinely does **not** carry over, because they are different storage areas: **Safari tab ↔ Home Screen app** on iOS, and **phone ↔ laptop**. Copy on the one that has the data, paste into the other.

**Order of work, so nothing is at risk:** build on a branch, never on `main` (pushing `main` publishes to the live app immediately). Merge only when Co says go.

## 8. Service worker

`service-worker.js` caches by name `breathe-count-v1` and answers from the cache first. Unless that file changes, an installed app keeps serving the old files indefinitely. Therefore: bump to `breathe-count-v2` and add every new JS file to `ASSETS`. Failing to do this is the single most likely way for this release to look like it did nothing.

## 9. Testing

- **Unit (`node:test`, no installs):** every function in §4 — including a slip today forcing `cleanStreak` to `0`, today never counting as a missed day, `gridCells` leading-blank alignment, and runs bounded by `createdAt`. Plus `migrate()` (v1 in → v2 out, nothing else altered), the one-time backup, and `importState` on valid, malformed and hostile input.
- **Regression:** all 23 existing tests stay green, unchanged.
- **By hand in Chrome, then reported to Co:** create one target of each kind; mark and unmark; reload and confirm persistence; convert a counter with real history to `avoid` and back, confirming the numbers return; export, wipe, re-import; confirm the service worker serves v2 and 30-day grids render offline.

## 10. Risks

| Risk | Handling |
|---|---|
| Phone never picks up the update | §8 cache bump; Co confirms by eye after the push |
| iOS clears site storage for an unused web app | Backup &amp; restore (§7), and it is Co's copy to keep — the app has no server by design |
| Co's data is in Safari but the Home Screen app looks empty | Documented as expected; fixed by Copy → Paste |
| Stats screens grow long on a small phone | The mockup screens are drawn taller than a phone on purpose; they scroll |
| `stats.js` doing too much | The grid renderer moves to its own `js/grid.js`; target rendering to `js/targets.js`; backup to `js/backup.js` |

# Breathe & Count — Design Spec

**Date:** 2026-07-14
**Owner:** Borirak (Co)
**Status:** Approved design, ready for implementation plan

---

## 1. What this is

A small personal app for Co's iPhone that does two simple things in one place:

1. **Count** everyday activities (both good habits to build and bad habits to cut down).
2. **Breathe** — guided breathwork timer with a calm animated circle.

It is **not** App Store grade. It is a simple, private, personal tool that lives on the
phone and works with no internet.

## 2. Platform & delivery

- Built as a **PWA** (a web app installed to the iPhone Home Screen via Safari's
  "Add to Home Screen"). Opens full-screen like a native app, no browser chrome.
- **Works fully offline** after first load (service worker caches the app shell).
- **All data stays on the device** in the browser's `localStorage`. Nothing is uploaded.
- Hosted as static files on a **free host** (GitHub Pages or Netlify — decided at install).
  Only harmless app code is hosted; no personal data ever leaves the phone.
- Target device: iPhone / iOS Safari. Must also render on desktop for development.

## 3. Non-goals (deliberately excluded)

Accounts/login, cloud sync, notifications/reminders, sharing/export, multi-user,
sound or vibration cues. Everything is single-user, on-device, silent.

## 4. Information architecture

- Two bottom tabs: **Count** and **Breathe**.
- From the Count tab, tapping a counter's **Stats** opens a per-counter stats view.
- Starting a breathing session opens a full-screen session overlay.

## 5. Data model (localStorage)

```
counters: [
  {
    id: string,
    name: string,
    kind: "good" | "bad",
    goal:  number | null,   // good habits only: optional daily target (e.g. 20)
    limit: number | null,   // bad habits only: daily limit (e.g. 5)
    createdAt: ISO date
  }
]

history: {
  [counterId]: {
    [YYYY-MM-DD]: number    // the final count recorded for that day
  }
}
```

- `today` value for a counter = `history[id][todayKey]` (defaults to 0).
- **Daily reset** is implicit: a new day is simply a new date key. On app open, if the
  last-seen date differs from today, yesterday's value is already persisted in history;
  today starts at 0 automatically. No data is deleted.

## 6. Feature: Count

- A vertical list of counter cards the user creates.
- Each card shows: **name**, a **type tag** ("Good habit" / "Cutting down"),
  the **big today number**, a context line (goal or limit), and controls:
  - **+1** (large primary button)
  - **−1** (small, to fix mistakes; never goes below 0)
  - **Stats ›** link
- **Add counter:** a small form — name, choose **Good habit** or **Cutting down**,
  and optionally set a **daily goal** (good) or **daily limit** (bad).
- **Edit / delete** a counter (rename, change goal/limit, remove).
- Colour coding: good habits use the **honey** accent; bad habits use the **rose** accent.

## 7. Feature: Stats (per counter)

Built entirely from the on-device daily history.

- **Two headline tiles:**
  - *Good habit:* **Streak** (consecutive days with ≥ 1) and **All-time total**.
  - *Bad habit:* **Under-limit streak** (consecutive days at or **under** the daily limit)
    and a period total (this week).
- **Chart toggle:** Weekly (last 7 days, labelled bars) and Monthly (last ~30 days, compact bars).
- Chart bars are honey for good habits, rose for bad habits.
- Chart caption states the frame (e.g. "This week · avg 18/day" for good;
  "This week · limit 5/day" for bad).

### Streak rules (explicit)
- **Good:** a day counts toward the streak if its recorded value ≥ 1.
  (If a goal is set, we still use ≥ 1 for the streak; goal is shown as context, not the streak gate. This can be revisited.)
- **Bad:** a day counts toward the streak if its recorded value ≤ `limit`.
  Streak = number of consecutive such days ending today (or yesterday if today not yet over).

## 8. Feature: Breathe

- **Preset patterns** (tap to select):
  - Box breathing — 4-4-4-4 (in-hold-out-hold)
  - Relax — 4-7-8 (in-hold-out)
  - Calm — 5-5 (in-out)
  - **Custom** — user sets seconds for Inhale / Hold / Exhale / Hold (any of the holds may be 0)
- **Length:** choose by **minutes** (2 / 5 / 10) or by **rounds** (e.g. 6). Values adjustable.
- **Session screen:**
  - A calm **circle that grows on inhale, holds, shrinks on exhale**, driven by the selected
    pattern's per-phase seconds.
  - A small **phase word** ("Breathe in / Hold / Breathe out") with a per-phase countdown.
  - A **thin ring around the circle that empties as the total session time counts down**
    (shows time remaining at a glance).
  - Controls: **Pause / Resume** and **End**.
  - No sound, no vibration.

## 9. Look & feel

- **Native iOS feel:** system (SF) typography so it reads like a real iPhone app; big,
  light-weight numbers for counts; generous tap targets.
- **Two accent worlds:** cool **spruce/eucalyptus** green for Breathe (calm); warm **honey**
  for Count (energy); **rose** for "cutting down" habits.
- **Light & dark:** follows the phone's system theme automatically (token-based palette).
- Soft, minimal, calm. Rounded cards, soft paper ground in light, calm charcoal in dark.

Reference: the approved interactive mockup (iPhone layout, tappable).

## 10. Technical approach

- Plain **HTML + CSS + vanilla JavaScript** (no heavy framework). Small enough to stay simple
  and fast, and easy to host as static files.
- Files (approximate):
  - `index.html` — app shell and views
  - `app.js` — state, counters, stats, breathing engine
  - `styles.css` — tokens + components (light/dark)
  - `manifest.webmanifest` — app name, icon, standalone display (enables Home Screen install)
  - `service-worker.js` — offline caching of the app shell
  - `icons/` — Home Screen app icons (multiple sizes)
- Charts drawn with lightweight DOM/SVG (no chart library needed).
- State persisted to `localStorage` on every change; loaded on start.

## 11. Install flow (for later, at hand-off)

1. Put the files on a free static host (GitHub Pages or Netlify).
2. Open the URL in **Safari** on the iPhone.
3. Share → **Add to Home Screen**.
4. Launch from the new icon — full-screen, offline, data saved on device.

## 12. Open questions

None blocking. Possible future niceties (not in v1): making the good-habit streak
gate on the goal instead of ≥ 1; simple data backup/export; reordering counters.

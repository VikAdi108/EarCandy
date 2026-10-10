# EarCandy — Dev Handoff

_Last updated 2026-10-09. Written so you can pick up the live-learning work and
drive it toward the listener test. Pairs with
[REFRAMING_WITH_MARKET_RESEARCH.md](REFRAMING_WITH_MARKET_RESEARCH.md) (the why)
and [LISTENER_TEST_KIT.md](LISTENER_TEST_KIT.md) (the how)._

## TL;DR

The app records a **per-song event log** now — hearts, skips, and **how many
seconds of each clip were actually heard** — which is exactly the thing both
research docs said had to exist before any listener test can run. That
foundation is built, verified, and pushed. What's left is the **Round-2 "test
mode"** and **getting the app on a URL**. Details and a concrete next-steps list
are below.

## Branch map — where the code is

| Branch | State | Contains |
|---|---|---|
| `main` | stable, deploy-ready | App through Stage 3e + the **Affect Space** tab + all the research docs |
| `feature/live-learning` | **active — the telemetry work lives here** | Everything in `main` **plus** Stage 4 live-learning (this handoff's subject) |
| tag `v0.3e` | frozen snapshot | The known-good build before live learning, restore with `git checkout v0.3e` |

**To continue the work:**
```bash
git fetch origin
git checkout feature/live-learning   # the live-learning code is here, not on main
npm install
npm run dev                          # http://localhost:5173
```
When Stage 4 is ready to be official, open a PR from `feature/live-learning` → `main`.

## What was just built (Stage 4 — live-learning telemetry)

Commit `c4157ca` on `feature/live-learning`. Three new modules + wiring:

### 1. The event log — [src/utils/profileStore.js](src/utils/profileStore.js)
A **swappable store** (localStorage today, a backend later — swap one line,
`createLocalStore()` → `createRemoteStore()`, nothing else changes). It holds a
per-song event log that is the single source of truth:

```js
Event = { type, id, genre, region, ts, ms? }
  type  : 'like'  (❤)              // positive
          'skip'  (👎 remove)       // light negative
          'never' (⊘ never again)   // strong negative
          'play'                    // ms = milliseconds actually heard
```
- Migrates any older v1 `{likes,skips}` data automatically on load.
- `serialize()` / `deserialize()` back Export/Import of a profile as JSON.
- This log is a **superset** of what the taste model needs now and what the
  Round-2 test export needs later — one log serves both.

### 2. The taste model — [src/utils/tasteModel.js](src/utils/tasteModel.js)
Pure functions that derive a **per-genre taste vector** from the log.
- `❤ = +1`, `👎 = −1`, `⊘ = −1.5`; a `play` counts by listen time (finished the
  clip ≈ mild +, bailed in <5s ≈ mild −). This is the "listening time informs
  taste" the research asked for, folded straight in.
- Squashed through `tanh` so a few signals read as a lean, not a landslide.
- Applied as a **±8-point nudge** on a ~70-point proximity score, so it only
  settles near-ties. **It never moves the user's chosen mood marker** — that
  stays sacred (a locked design decision — don't change it without discussion).

### 3. The UI — [src/components/TastePanel.jsx](src/components/TastePanel.jsx)
Shows what's been learned (leaning toward / steering clear of / mood centre) and
has **Export / Import / Reset**. Renders at the top of the **Discover** tab.

### How it's wired into [src/EarCandy.jsx](src/EarCandy.jsx)
- `logEvent(type, track, ms)` appends an event (stamping genre + region) and
  persists it.
- ❤/👎/⊘ buttons call it; `togglePreview` times each clip via `flushPlay()` at
  every stop point (pause, switch, clip-end, tab-leave, unmount) and logs the
  real seconds heard.
- `regionOf(genre)` maps a track to its world region (used for familiarity).

### Verified
`npm run build` passes; v1→v2 migration, play-weighted learning, and region/ms
stamping are unit-tested. (Not yet manually clicked through in the browser —
worth doing once as a sanity pass.)

## The strategic frame (so the next moves make sense)

Per the research: EarCandy's bet is **cross-cultural discovery, with mood as the
bridge** (mood has no language). The **12 regional genres are the mechanism** —
they're how we tell a song that's *familiar* to a given listener from one that's
*unfamiliar*, which is the whole thing the test measures. Recognition (humming)
is table-stakes; the catalog is owned by others (Spotify's valence/energy API is
closed to new apps — our pool is a frozen snapshot). See
[COMPETITIVE_LANDSCAPE.md](COMPETITIVE_LANDSCAPE.md) for the full picture.

## Next steps — to drive this forward

**Round 1 needs NO code** (per the test kit) — 5 people, by hand, this week,
with the tally sheet in [LISTENER_TEST_KIT.md](LISTENER_TEST_KIT.md). That can
start immediately and will tell us what to fix before Round 2.

**Round 2 is the engineering work**, and the event log already covers most of
the data. What's still needed:

1. **Participant mode** — ask for a participant number at session start; tag all
   events with it.
2. **Familiar/unfamiliar tagging** — capture which regions a participant already
   listens to (one setup screen), then compare against each song's `region`
   (already stamped on every event) to mark familiar vs unfamiliar.
3. **Two A/B levers** (randomize per participant):
   - reason line on each card **on vs off** (the "why this song" text already
     exists — just gate its visibility),
   - playlist mix **~20% vs ~50% unfamiliar**.
4. **CSV export** — we have JSON export; add a one-click spreadsheet dump of the
   event log for analysis.
5. **Put the app on a URL** — today it only runs on a laptop with the code.
   Needed for the one-week follow-up. (It's a static Vite build —
   `npm run build` → any static host.)

**Design decisions already locked (don't silently undo):**
- The mood marker is the user's explicit intent — learning biases *within* it,
  never moves it.
- Storage is local-first and swappable; a backend is a future drop-in, not a
  prerequisite.
- Genre/region is the familiarity mechanism, not just a filter.

## Gotchas
- The live-learning code is on `feature/live-learning`, **not `main`** — check
  out the branch first.
- There are 3 pre-existing lint warnings in `EarCandy.jsx`
  (`noteSequenceToString`, `currentPitch`, an unused `i`) — not from this work.
- Windows line-endings: git will warn `LF will be replaced by CRLF` — harmless.

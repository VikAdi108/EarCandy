# EarCandy — Roadmap

Hum a melody → recognize the song → get a mood-matched playlist you can sculpt.

This file is the durable record of where the project has been and where it's
going, reconstructed from git history and kept current as stages land. (It
exists so a reset/crash never loses the plan — the commit trail is the source
of truth; this is the human-readable map over it.)

**Status:** Stage 3 (recommendation engine) complete through 3e.
**Last updated:** 2026-06-18

---

## Foundation — melody recognition (pre-Stage 1)

The hum-to-song pipeline the rest of the app sits on. See
[SOUND_FLOW.md](SOUND_FLOW.md) / [SOUND_FLOW_DETAILED.md](SOUND_FLOW_DETAILED.md)
for the detailed mic → match walkthrough.

- Mic capture → pitch detection (autocorrelation), floor raised 60 → **80 Hz**
  to reject low-frequency noise.
- Wobble-proof melody quantizer + octave/noise-robust detector for short,
  imperfect hums.
- Local song-match scoring with a confidence calc (score-spread bug fixed).
- **AudD cloud fallback** when local confidence is low.
- Song database tuned down to an **81-song demo set** for short-hum reliability
  (full merged DB of 9,213 entries lives in the repo for later use).
- Recognition thresholds **auto-tune by database size**.

## Stage 1 — Mood scoring _(2026-06-18)_

Recommendations scored by **valence/energy proximity** in affect-space
(Russell's circumplex), each with a plain-language "why this song?" reason.
Mood-match rating badges added to recommendation cards.

## Stage 2 — Affect-space control _(2026-06-18)_

- **2D affect-space picker** — drag a marker in valence × energy space.
- **Journey mode** — a path from current → desired mood; the playlist becomes a
  mood-regulation arc (sampled waypoints along the line).
- Time-of-day awareness.

## Stage 3 — Recommendation engine

### 3a — Curated baseline _(2026-06-18)_
Hand-curated **100-track baseline** spanning our 12 regional genre categories.

### 3b — Spotify pool _(2026-06-18)_
Merged in a **Spotify Audio Features pool (~1,097 tracks)**, lifting the pool to
~1,200 tracks; richer, finer-grained reasons calibrated for the denser pool.
_(Per project note: we keep **both** our 12 regional categories **and**
Spotify's genres — neither replaces the other.)_

### 3c — Refinement controls _(2026-06-18)_
Per-track more / less like this / skip, with auto-regeneration.
_Superseded by 3e — see below._

### 3d — Audio previews _(2026-06-18)_
**30-second iTunes previews** per recommendation, one shared `<audio>` element,
lazy fetch + localStorage cache, graceful "unavailable" state.

### Fixes after 3d _(2026-06-18)_
- **Preview lookup correctness** — `iTunes limit=1` blindly trusted the top
  keyword hit, so common-word titles collided (Jobim's "Wave" resolved to "The
  Girl from Ipanema", whose credits feature Jobim). Now fetches a 25-result
  window and **title/artist-matches** with accent/qualifier normalization;
  cache bumped `v1 → v2`. See [previewLookup.js](src/utils/previewLookup.js).
- **Refinement glyph swap** — ⊘ (no-sign) and 👎 (thumbs-down) swapped to match
  the more intuitive reading from user testing.

### 3e — Like-adjusted playlist expansion _(2026-06-18)_
Driven by live user testing: people wanted a liked song to **stay put**, and
wanted **more songs** — without sacrificing the stability of starting at 6.
Solved with one mechanic.

- The playlist is now a **living, hand-sculpted list**, not a re-roll of the
  marker. The marker only **seeds** the initial 6 (Discover / deliberate mood
  moves).
- **❤ Like** keeps the song in place and **inserts a 6-track cluster right after
  it** (`1 2 3 [4] → 1 2 3 [4] 4A…4F 5 6`). Works on any song, **nests**, and is
  idempotent while a cluster is present.
- **⊘ Less like this** removes + mutes (never resurfaces this session);
  **👎 Skip** removes from the current list only. Neither re-rolls the playlist.
- **Cluster flavor: genre-weighted** — mood proximity plus a `+0.06` same-genre
  affinity, so "more like ❤ Wave" leads with bossa nova but still admits strong
  cross-genre mood matches.
- **Visual coherence** — derived tracks are indented with a genre-colored left
  accent and a "↳ more like ❤ {seed}" caption; nested clusters step in further.

---

## Backlog / candidate next steps

Not committed to an order — pick by user value.

- **Playlist persistence** — save / name / reload sculpted playlists across
  sessions (localStorage or export).
- **Journey visualization** — draw the affect-space path for journey mode.
- **Preview UX polish** — show iTunes `artworkUrl` (already fetched); harden the
  `togglePreview` rapid-click race with a request token.
- **Broaden the live pool** — wire in more of the merged 9,213-song database
  beyond the curated ~1,200.
- **Recognition-side improvements** — accuracy/robustness work on the
  hum → match pipeline.

---

## Conventions

- **Genres:** keep both our 12 regional categories and Spotify's — don't
  collapse one into the other.
- **Start small, sculpt up:** features default to a safe 6-track playlist and
  let the user grow it, rather than front-loading complexity.

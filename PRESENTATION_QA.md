# EarCandy — Presentation Q&A

Grounded, defensible answers to the professors' feedback. Each section maps a
question/critique to a correct answer, the supporting facts, and a short "say it
like this" soundbite for the talk. Numbers are fact-checked; sources at the bottom.

---

## Q: Where do the 80–400 Hz numbers come from? What notes are they? What can you hum?

### What the numbers are (pure math, equal temperament, A4 = 440 Hz)

| Boundary | Nearest note | Exact note freq |
|---|---|---|
| **80 Hz** (floor) | just below **E2** | E2 = 82.4 Hz (Eb2 = 77.8 Hz) |
| **400 Hz** (ceiling) | just above **G4** | G4 = 392.0 Hz (G#4 = 415.3 Hz) |

The band is **≈ E2 → G4**, a little over 2.5 octaves. These are round-number Hz
values chosen to bracket the human voice's **fundamental frequency** (the pitch you
hear) — which is exactly what the autocorrelation pitch detector measures.

### Fact-check: does it cover real humming?

| Reference | Range | vs. 80–400 Hz band |
|---|---|---|
| Adult **male speech** (F0) | ~85–160 Hz | fully inside |
| Adult **female speech** (F0) | ~165–255 Hz | fully inside |
| **Bass** singing | E2–E4 = 82–330 Hz | fully inside |
| **Soprano** singing | C4–C6 = 262–1047 Hz | top **exceeds** the ceiling |

**Verdict:**
- **The 80 Hz floor is solid.** It sits at the bottom of the bass range (E2 = 82 Hz),
  just below the lowest male speech. Below it is mostly noise — 60 Hz AC mains hum
  lives just under it. Nobody hums below 80 Hz.
- **The 400 Hz ceiling covers all speech and all *comfortable* humming, but clips the
  high *singing* register.** Humming is a relaxed, closed-mouth phonation done in a
  comfortable mid-range, not a soprano belt — so 400 Hz catches the vast majority of
  real hums. A soprano or child *could* hum a melody above G4, and those notes would
  be rejected. That is a deliberate trade-off, not a bug.

### Say it like this

> "The 80–400 Hz window is the fundamental-frequency range of the human voice — from
> the bottom of a bass (E2, 82 Hz) up to G4. We track the fundamental, not the full
> audible spectrum, because that's the pitch your ear and our autocorrelator follow.
> The 80 Hz floor also clears 60 Hz electrical hum. The one trade-off: a soprano or
> child humming above G4 falls outside it — we optimized for the comfortable humming
> register, where most people actually hum, rather than the full singing range up to
> ~1000 Hz."

### Live-demo tip (answers "what can YOU hum?")
Use the **How it works** tab → 🎤 Microphone → hum your lowest and highest comfortable
notes and read the Hz/note off the panel. Then state your own measured range in the
talk — personal data + interactive demo answering their exact question.

### If you want to remove the caveat
Raise the ceiling (e.g. ~600–1000 Hz) to capture high hums, at the cost of a wider
autocorrelation search and slightly more octave-error risk. Recommended: keep 400 Hz
and just state the trade-off.

---

## Q: Why is it necessary to convert frequency into 12-tone Western notes?

### The core reason: the two things being compared must share a representation

The database is **not audio** — it's symbolic note lists extracted from MIDI
(e.g. `notes: ['F#5','F#5','D5','B4',…]`, [songDatabase.js:14](src/utils/songDatabase.js#L14)),
and the matcher reads `song.notes` directly ([matchingEngine.js:163](src/utils/matchingEngine.js#L163)).
A hum arrives as a continuous stream of Hz (`262.4, 261.1, 263.8, 329.5…`). You cannot
compare a wiggly frequency curve to a list of note names until one is converted into the
other's alphabet. Quantizing the hum to notes is that bridge — it's necessary *given the
design*, not decorative.

### Four reinforcing reasons it's the right bridge

1. **Denoises toward the musical alphabet.** A held note isn't one frequency — humming
   wobbles (vibrato, drift, jitter). Western melodies are *composed* on the 12-tone
   equal-tempered grid, so the continuous Hz is a noisy realization of a discrete intent.
   Snapping to the nearest note recovers the intended symbol. (This is what the ±50-cent
   tolerance does.)
2. **Dimensionality reduction.** ~60 Hz readings/sec collapse to ~3 notes/sec — small
   enough to match thousands of songs in milliseconds.
3. **Enables transposition invariance.** Integer semitones let you take *differences* →
   intervals, which are key-independent. That's what lets you hum in any key and still
   match. (The DB stores melodies at their original octave — e.g. F#5 ≈ 740 Hz, above the
   400 Hz humming ceiling — yet a 200 Hz hum still matches, because the matcher compares
   intervals, not absolute pitch.)
4. **Makes matching tractable.** Discrete symbols allow efficient edit distance
   (Levenshtein) and integer DTW. Matching raw continuous contours is possible but heavier
   and more noise-sensitive — and the DB isn't stored that way.

### Honest caveat (shows depth)

12-tone quantization is a **Western** simplification. It discards microtonality and pitch
ornamentation — the gamakas of Carnatic/Hindustani music, flamenco's bends, qawwali's
slides — which are exactly the global traditions EarCandy showcases. So quantization is the
right call *for matching a 12-TET symbolic database*, but it's a known limitation of that
database, not a universal truth about music.

### Say it like this

> "Our database is symbolic — note lists from MIDI, not audio. So the hum has to be put
> into the same alphabet before we can compare. Quantizing to the 12 Western notes denoises
> the wobble of a real voice into the discrete pitches the melody was composed from, shrinks
> the data ~20×, and — once notes are integers — lets us take intervals for key-independent
> matching. The trade-off: the 12-tone grid can't capture the microtones of the Carnatic or
> flamenco melodies we feature, a real limitation of matching against a Western-notated
> database."

---

## Q: If every song has the same potential accuracy, how is recognition practical?

Honest answer: **they don't all have the same accuracy** — recognition reliability depends
on how *distinctive* and *long* the melody is, and we measured exactly where it breaks.

### What we measured

Feeding songs back as hums (transposed to a different key):

| Song | Clean hum | Realistic "messy" hum (1 dropped repeat + 1 slipped note) |
|---|---|---|
| Happy Birthday | ranks #1, but only ~1% ahead of the next song | falls out of the top 50 |
| Take On Me / Twinkle / Für Elise | #1, by a thin 2–7% margin | out of the top 50 |
| Ode to Joy (Extended) | #1 | the **only** one that survives a messy hum |

### Why — the real finding

Happy Birthday's stored melody is just **4 intervals** (`[+2,−2,+5,−1]`). Dozens of real
songs share that exact short contour, so they **tie** on the interval score (which is 90% of
the match). Only a thin absolute-pitch tiebreaker separates them — hence the ~1% margin, and
why any humming imperfection drops the true song far down. A 4-interval pattern has no error
budget: one slipped note is a 25% corruption.

The melody that holds up (Ode to Joy) is the longest and most distinctive — **proving the
lever is melody length/uniqueness, not the scoring math.** This is the core insight:

> **Interval-based matching cannot distinguish melodies that share a short contour. Short
> hums and short templates are information-limited — no scoring formula can identify a song
> from a pattern that dozens of songs share.**

### What we did tighten (and it helped for distinctive melodies)
- Collapse repeated notes (the hum can't capture re-articulated same-pitch notes anyway).
- Graded interval-error cost + a steeper score curve (near-misses now cost something).
- Coverage scoring (a full-melody match outranks a coincidental fragment).
- A **minimum of 6 distinct notes** to attempt a match, with a "hum a longer phrase" prompt —
  because short hums are inherently ambiguous.

### Say it like this

> "Accuracy isn't uniform — it scales with how distinctive the melody is and how much you
> hum. We measured the limit: a 4-note pattern like Happy Birthday's opening is shared by
> dozens of songs, so interval matching can't separate them — the true song ranks first but
> by a hair, and a realistic imperfect hum loses it. A longer, distinctive melody like Ode to
> Joy stays robust. So we now require a longer hum, and we're honest that short snippets are
> ambiguous by nature."

### Future work (to revisit — see code note in matchingEngine.js)
1. **Use rhythm/duration** as a tiebreaker — we capture note durations but currently discard
   them; they'd separate same-contour melodies.
2. **Richer database** — store full/longer melodies instead of ~12-note openings, so contours
   become unique. This is the true root-cause fix.

---

## Sources

- [Voice Science — average speaking frequencies (F0 norms)](https://www.voicescience.org/lexicon/average-speaking-frequencies/)
- [Voice frequency — Wikipedia](https://en.wikipedia.org/wiki/Voice_frequency)
- [Voice Science — average singing frequencies by voice type](https://www.voicescience.org/lexicon/average-singing-frequencies/)
- [Singer's vocal range chart — Doctor Mix](https://doctormix.com/blog/singers-vocal-range-chart)

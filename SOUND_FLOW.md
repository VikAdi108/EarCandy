# EarCandy — Sound Flow Visual Map

A complete trace of how a hummed sound travels through the codebase, from microphone to song match.

---

## The Big Picture

```
        ┌──────────────────────────────────────────────────┐
        │                  THE USER                         │
        │              hums into the mic                    │
        └────────────────────┬─────────────────────────────┘
                             │
                             ▼  sound waves (vibrating air)
                  ┌──────────────────────┐
                  │     Microphone       │  (physical hardware)
                  └──────────┬───────────┘
                             │
                             ▼  digital audio samples (~44,100/sec)
        ╔════════════════════════════════════════════════════╗
        ║                  BROWSER                            ║
        ║          (Web Audio API + EarCandy code)            ║
        ╚════════════════════╤═══════════════════════════════╝
                             │
        ┌────────────────────┴────────────────────┐
        │                                          │
        ▼                                          ▼
  ┌──────────────┐                       ┌──────────────────┐
  │ AnalyserNode │ ───────live frames───▶│ Pitch Detection  │
  │ (waveform)   │                       │ (autocorrelation)│
  └──────────────┘                       └────────┬─────────┘
                                                  │
                                                  ▼  Hz values
                                         ┌──────────────────┐
                                         │ Melody Quantizer │
                                         │ (Hz → notes)     │
                                         └────────┬─────────┘
                                                  │
                                                  ▼  ['C4','E4','G4',...]
                                         ┌──────────────────┐
                                         │ Matching Engine  │
                                         │ (DTW + intervals)│
                                         └────────┬─────────┘
                                                  │
                                                  ▼  ranked matches
                                         ┌──────────────────┐
                                         │   UI Results     │
                                         │  "Happy Birthday │
                                         │     87% match"   │
                                         └──────────────────┘
```

---

## Stage 1 — Capture the Sound

**File: [src/EarCandy.jsx](src/EarCandy.jsx)** — function `startRecording()` at line 193

```
              ┌──────────────────────────────────────┐
              │ navigator.mediaDevices.getUserMedia  │  Line 196
              │   "Hey browser, give me the mic"     │
              └──────────────────┬───────────────────┘
                                 │
                                 ▼ MediaStream
              ┌──────────────────────────────────────┐
              │       new AudioContext()             │  Line 208
              │   The browser's audio engine         │
              └──────────────────┬───────────────────┘
                                 │
                ┌────────────────┴───────────────────┐
                ▼                                    ▼
   ┌─────────────────────┐              ┌─────────────────────┐
   │   AnalyserNode      │              │   MediaRecorder     │
   │   fftSize = 2048    │  Line 210    │   (saves .webm)     │  Line 218
   │   for pitch tracking│              │   for playback      │
   └─────────────────────┘              └─────────────────────┘
            │                                      │
            ▼                                      ▼
     pitchData array                          audioBlob
     (built every 50ms)                       (full recording)
```

### What's happening
- `getUserMedia()` triggers the browser permission popup
- `AudioContext` is the entry point for real-time audio processing
- `AnalyserNode` exposes the raw waveform — this is what feeds the pitch detector
- `MediaRecorder` runs in parallel, just to save the audio for later playback
- `fftSize = 2048` means the analyser keeps a buffer of 2,048 samples (~46ms of audio at 44.1kHz)

---

## Stage 2 — Detect the Pitch

**File: [src/EarCandy.jsx](src/EarCandy.jsx)** — function `detectPitch()` at line 72, called by `detectPitchRealtime()` at line 256

```
       ┌────────────────────────────────────────────────┐
       │  Every 50ms, grab a snapshot from AnalyserNode │
       └─────────────────────┬──────────────────────────┘
                             │
                             ▼  Float32Array of 2,048 samples
                ┌─────────────────────────┐
                │   detectPitch()         │  Line 72
                │   (autocorrelation)     │
                └─────────────┬───────────┘
                              │
                              ▼
       ┌──────────────────────────────────────┐
       │  Slide the wave against itself.      │
       │  Find the lag where it best matches  │
       │  itself. That lag = the period.      │
       │  Pitch = sampleRate / period         │
       └──────────────────┬───────────────────┘
                          │
                          ▼  pitch (in Hz, e.g. 261.6)
              ┌───────────────────────┐
              │ Append to pitchData[] │
              │  { pitch, time }      │
              └───────────────────────┘
```

### What autocorrelation actually does

```
Original wave:    /\  /\  /\  /\
                   \/  \/  \/  \/

Shifted by 1ms:    /\  /\  /\  /\     ← bad match
                    \/  \/  \/  \/

Shifted by 3.8ms:  /\  /\  /\  /\     ← perfect match!
                   \/  \/  \/  \/      Period = 3.8ms
                                       Pitch = 1/0.0038 ≈ 263 Hz (C4)
```

The detector is bounded to **80–400 Hz** — the realistic human humming range. Anything outside that is rejected as noise.

### Why the floor is 80 Hz (not 60 Hz)

The original 60 Hz floor was too generous. Two practical reasons we raised it:

| Frequency | What lives there |
|---|---|
| **60 Hz** | US electrical mains hum — pure noise, never humming |
| 65 Hz (C2) | Russian Octavist bass singers (extremely rare) |
| **80 Hz** | Bottom of a bass-baritone's range — our new floor |
| 82 Hz (E2) | Lowest string of a guitar |
| 100 Hz | Bottom of typical male *humming* range |

Cutting the 60-80 Hz band gets rid of AC mains hum (a real-world noise source) and shrinks the autocorrelation search by ~25%, while still catching every realistic human humming voice — bass-baritone to soprano.

---

## Stage 3 — Quantize Hz to Musical Notes

**File: [src/utils/melodyQuantizer.js](src/utils/melodyQuantizer.js)**

```
   Raw pitch stream: [261.4, 262.1, 261.8, 329.5, 330.1, 329.8, ...]
                            │
                            ▼
              ┌───────────────────────────────┐
              │     frequencyToSemitone()     │  Line 16
              │                                │
              │  semitones = 12 × log₂(f/440) │
              │             + 57               │
              └──────────────┬────────────────┘
                             │
                             ▼  [60, 60, 60, 64, 64, 64, ...]
              ┌───────────────────────────────┐
              │    quantizePitchData()        │  Line 51
              │                                │
              │  - Group consecutive same-    │
              │    pitch readings             │
              │  - Tolerate ±2 semitone drift │
              │  - Require 80ms minimum       │
              │  - Average the frequencies    │
              └──────────────┬────────────────┘
                             │
                             ▼
              ┌───────────────────────────────┐
              │   semitoneToNote()            │  Line 26
              │                                │
              │  60 → { note: 'C', octave: 4 }│
              │  64 → { note: 'E', octave: 4 }│
              └──────────────┬────────────────┘
                             │
                             ▼
              Discrete note sequence: ['C4', 'E4', 'G4', 'C5', ...]
```

### Why log₂?
Doubling frequency = up one octave. So distances in pitch are *logarithmic*, not linear:

```
C4 → C5:  261.6 Hz → 523.2 Hz   (×2)
C5 → C6:  523.2 Hz → 1046.5 Hz  (×2)

Linear distance:    261 Hz   vs   523 Hz   ← very different
Log₂ distance:      1 octave  =   1 octave  ← same musical interval
```

Human hearing is logarithmic — the formula respects how we actually perceive pitch.

---

## Stage 4 — Match Against the Database

**File: [src/utils/matchingEngine.js](src/utils/matchingEngine.js)**

```
   Hummed notes: ['C4', 'E4', 'G4', 'C5']
                       │
                       ▼
       ┌────────────────────────────────┐
       │      notesToSemitones()        │  Line 103
       │   ['C4','E4','G4','C5']        │
       │       → [60, 64, 67, 72]       │
       └──────────────┬─────────────────┘
                      │
                      ▼
       ┌────────────────────────────────┐
       │       getIntervals()           │  Line 130
       │   [60,64,67,72] → [4,3,5]      │
       │   (key-independent pattern)    │
       └──────────────┬─────────────────┘
                      │
                      ▼
       ╔══════════════════════════════════════╗
       ║  For each of 9,213 songs in DB:      ║
       ║                                       ║
       ║   ┌─────────────────────────────┐    ║
       ║   │ findBestSubstringMatch()    │    ║  Line 70
       ║   │  Slide your pattern along   │    ║
       ║   │  the song's full melody.    │    ║
       ║   │  Find the best alignment.   │    ║
       ║   └────────────┬────────────────┘    ║
       ║                │                      ║
       ║                ▼                      ║
       ║   ┌─────────────────────────────┐    ║
       ║   │  levenshteinDistance()      │    ║  Line 46
       ║   │  Count edits to align       │    ║
       ║   │  your intervals to theirs   │    ║
       ║   └────────────┬────────────────┘    ║
       ║                │                      ║
       ║                ▼                      ║
       ║   ┌─────────────────────────────┐    ║
       ║   │  normalizedDTWDistance()    │    ║  Line 36
       ║   │  Allow tempo flex via       │    ║
       ║   │  Dynamic Time Warping       │    ║
       ║   └────────────┬────────────────┘    ║
       ║                │                      ║
       ║                ▼                      ║
       ║      score = 0.8×intervals            ║  Line 197
       ║            + 0.2×semitones            ║
       ╚══════════════════════════════════════╝
                       │
                       ▼
              Sort by confidence
                       │
                       ▼
              Top 5 matches returned
```

### The two algorithms working together

```
  YOUR HUM:       C4 ─── D4 ─── E4
                            ╲      ╲
  DATABASE:       C4 ─ D4 ──── E4 ── E4
                  ↑       ↑          ↑
                  match   stretch    extra note
                          (DTW)      (Levenshtein
                                     forgives this)
```

- **Levenshtein** forgives missing or extra notes
- **DTW** forgives tempo differences (humming slowly vs. fast)
- Combining them lets the matcher work with imperfect human humming

---

## Stage 5 — Display Results

**File: [src/EarCandy.jsx](src/EarCandy.jsx)** — function `recognizeSongs()` at line 413

```
       Matches: [
         { title: 'Happy Birthday', confidence: 87 },
         { title: 'Twinkle Twinkle', confidence: 64 },
         ...
       ]
                       │
                       ▼
              ┌─────────────────────┐
              │  setSongMatches()   │
              │  setActiveTab(      │
              │   'recognition')    │
              └──────────┬──────────┘
                         │
                         ▼
       ┌────────────────────────────────────┐
       │   Recognition tab renders:         │
       │                                     │
       │   [87%]  Happy Birthday             │
       │          Traditional                │
       │                                     │
       │   [64%]  Twinkle Twinkle            │
       │          Traditional                │
       │                                     │
       │   ...                               │
       └────────────────────────────────────┘
```

---

## Complete File Map

| File | Purpose | Key functions |
|---|---|---|
| [src/EarCandy.jsx](src/EarCandy.jsx) | Main React component, UI, audio I/O | `startRecording`, `detectPitch`, `detectPitchRealtime`, `analyzeRecording`, `recognizeSongs` |
| [src/utils/melodyQuantizer.js](src/utils/melodyQuantizer.js) | Hz → discrete notes | `frequencyToSemitone`, `semitoneToNote`, `quantizePitchData` |
| [src/utils/matchingEngine.js](src/utils/matchingEngine.js) | Note sequence → song match | `matchMelody`, `levenshteinDistance`, `dynamicTimeWarpingDistance`, `findBestSubstringMatch` |
| [src/utils/songDatabase.js](src/utils/songDatabase.js) | 9,213 song melodies | `songDatabase` (array export) |
| [scripts/extractMelodies.js](scripts/extractMelodies.js) | MIDI → database pipeline | `processMidiFile`, `scoreMelodyTrack`, `extractOpeningNotes` |
| [scripts/mergeDatabases.js](scripts/mergeDatabases.js) | Combine handcrafted + MIDI | priority merge |

---

## Time Domain vs. Frequency Domain

A useful mental model for what's happening at each stage:

```
  STAGE 1 (Capture)        STAGE 2 (Detect)         STAGE 3 (Quantize)
  ─────────────────        ────────────────         ──────────────────
  Time domain              Time domain              Symbolic domain
  Amplitude vs time        Period found             Notes named
                           via autocorrelation

       ▲                         ▲                       C4
       │/\    /\                 │  /\                   ─────
       │ \  /  \                 │ /  \                  D4
       │  \/    \                │/    \                 ─────
       └─────────▶               └──────▶                E4
       seconds                   period (ms)             ─────


  STAGE 4 (Match)
  ────────────────
  Pattern domain
  Intervals compared

  +4  +3  +5  -7
   ↓   ↓   ↓   ↓
  +4  +3  +5  -7    ← perfect match
```

---

## The One-Sentence Summary

> A sound wave becomes a song match by being **captured** (microphone → `AudioContext`), **measured** (autocorrelation finds the pitch), **named** (log₂ formula maps Hz to notes), **patterned** (consecutive notes become key-independent intervals), and **matched** (DTW + Levenshtein finds the closest melody in a 9,213-song database).

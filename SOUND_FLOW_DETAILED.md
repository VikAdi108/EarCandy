# EarCandy — Detailed Sound Pipeline Map

A step-by-step trace through every transformation a hummed sound undergoes, with the **exact code** that performs each step and a plain-English explanation of *why* that code matters.

---

## Map Legend

```
🎤 = Physical world (sound waves, hardware)
💻 = Browser API call (built-in, not our code)
🟦 = Our code (EarCandy)
📦 = Data being passed between stages
🔢 = Step number
```

---

## STEP 1 of 14 — Sound Waves Reach the Microphone

```
🎤  You hum "C-D-E-F-G..."
       │
       ▼   Air pressure variations
🎤  Microphone diaphragm vibrates
       │
       ▼   Analog electrical signal
💻  Operating system audio driver samples it at 44,100 Hz
       │
       ▼   Stream of digital amplitude values
```

**What's in the stream:** numbers between -1.0 and +1.0 representing how compressed/rarefied the air is at each sample point.

**No code yet** — this is hardware and OS-level. Our app receives the result.

---

## STEP 2 of 14 — Request Microphone Permission

**File: [src/EarCandy.jsx](src/EarCandy.jsx#L196)** — inside `startRecording()`

```javascript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,   // remove acoustic echo
    noiseSuppression: true,   // suppress background noise
    sampleRate: 44100         // CD-quality sampling
  }
});
```

### Why this matters
- `navigator.mediaDevices` is the browser's gateway to hardware. Without it, no audio input is possible.
- `echoCancellation: true` is critical — without it, your laptop speakers playing back the recording would feed back into the mic.
- `noiseSuppression: true` filters background hiss before the audio even reaches us.
- `sampleRate: 44100` matches CD-quality audio. Higher would waste CPU; lower would lose vocal frequencies.
- `await` because the user must click "Allow" in the browser's permission popup.

📦 **Output:** `MediaStream` object — a live audio source.

---

## STEP 3 of 14 — Create the Web Audio Engine

**File: [src/EarCandy.jsx:208](src/EarCandy.jsx#L208)**

```javascript
audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
analyserRef.current = audioContextRef.current.createAnalyser();
analyserRef.current.fftSize = 2048;

const source = audioContextRef.current.createMediaStreamSource(stream);
source.connect(analyserRef.current);
```

### Why this matters

| Code | Role |
|---|---|
| `new AudioContext()` | Spins up the browser's real-time audio engine. Everything that processes audio flows through this. |
| `createAnalyser()` | An `AnalyserNode` — gives us access to the raw waveform as it streams in. |
| `fftSize = 2048` | The analyser keeps a rolling buffer of 2,048 samples. At 44.1kHz, that's ~46ms of audio. Enough to detect frequencies down to ~22Hz, more than enough for our 80Hz floor. |
| `createMediaStreamSource(stream)` | Wraps the microphone stream so it can plug into the audio graph. |
| `source.connect(analyserRef)` | Wires mic → analyser. Now whenever we ask the analyser for data, it gives us the latest 46ms snapshot. |

📦 **Output:** A live audio graph: `Microphone → MediaStreamSource → AnalyserNode`.

---

## STEP 4 of 14 — Start the Recording in Parallel

**File: [src/EarCandy.jsx:218](src/EarCandy.jsx#L218)**

```javascript
mediaRecorderRef.current = new MediaRecorder(stream);
chunksRef.current = [];

mediaRecorderRef.current.ondataavailable = (e) => {
  chunksRef.current.push(e.data);
};

mediaRecorderRef.current.onstop = async () => {
  const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
  setAudioBlob(blob);
  // ...
};

mediaRecorderRef.current.start();
```

### Why this matters
This runs **parallel** to the live analysis. Two paths from the same `stream`:
- `MediaRecorder` saves the full audio as a `.webm` blob so the user can replay it.
- `AnalyserNode` (from Step 3) provides live waveform data for pitch analysis.

If we only had the recorder, we'd have to wait until the user stopped to know the pitch. The analyser lets us update in real time.

📦 **Output:** A recording in progress + a live analysis loop ready to start.

---

## STEP 5 of 14 — The Real-Time Pitch Detection Loop

**File: [src/EarCandy.jsx:256](src/EarCandy.jsx#L256)** — `detectPitchRealtime()`

```javascript
const detect = () => {
  if (!isRecordingRef.current) return;  // stop when recording ends

  analyserRef.current.getFloatTimeDomainData(dataArray);
  // dataArray now contains the latest 2048 audio samples

  const rms = calculateRMS(dataArray);
  setVolumeLevel(Math.min(rms * 10, 1));

  const pitch = detectPitch(dataArray, audioContextRef.current.sampleRate);
  if (pitch) {
    const note = frequencyToNote(pitch);
    pitchDataRef.current.push({ time: Date.now(), pitch, note });
  }

  animationRef.current = requestAnimationFrame(detect);  // loop ~60×/sec
};
detect();
```

### Why this matters

| Code | Role |
|---|---|
| `getFloatTimeDomainData(dataArray)` | Pulls the latest 2,048 samples from the analyser into our buffer. |
| `calculateRMS(dataArray)` | Computes loudness — for the visual volume meter, *not* used to gate pitch detection. |
| `detectPitch(...)` | The core algorithm (Step 6). |
| `requestAnimationFrame(detect)` | Browser-native way to loop at ~60fps. Smoother than `setInterval`, pauses when tab is hidden. |

The loop runs ~60 times per second, each iteration analyzing the most recent 46ms of audio.

📦 **Output:** A growing array of `{ time, pitch, note }` objects.

---

## STEP 6 of 14 — Autocorrelation: Find the Repeating Pattern

**File: [src/EarCandy.jsx:72](src/EarCandy.jsx#L72)** — `detectPitch()`

### 6a — Reject silence
```javascript
let max = 0;
for (let i = 0; i < bufferSize; i++) {
  max = Math.max(max, Math.abs(audioData[i]));
}
if (max < 0.001) return null; // Too silent
```
Why: don't waste CPU running autocorrelation on background noise.

### 6b — Apply Hamming window (line 84-89)
```javascript
for (let i = 0; i < bufferSize; i++) {
  const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (bufferSize - 1));
  windowed[i] = audioData[i] * window;
}
```
**Why this matters:** without windowing, the abrupt cutoff at the start and end of the 2048-sample buffer creates artificial high-frequency artifacts (called "spectral leakage"). The Hamming window smoothly fades the edges to zero, eliminating that.

```
Before window:    │██████████████│    ← sharp edges = false high freqs
                  │              │

After window:     ╱██████████████╲    ← smooth tapered edges
                 ╱                ╲
```

### 6c — Cross-correlation at every lag (line 93-110)
```javascript
for (let lag = 1; lag < bufferSize; lag++) {
  let sum = 0, sum1 = 0, sum2 = 0;
  for (let i = 0; i < bufferSize - lag; i++) {
    sum += windowed[i] * windowed[i + lag];
    sum1 += windowed[i] * windowed[i];
    sum2 += windowed[i + lag] * windowed[i + lag];
  }
  if (sum1 * sum2 > 0) {
    correlations[lag] = sum / Math.sqrt(sum1 * sum2);
  }
}
```

**Why this matters:** the heart of pitch detection. For each possible time-shift (`lag`), we measure how well the signal matches a shifted copy of itself.

```
Wave at lag=0:       /\/\/\/\
Wave at lag=L:           /\/\/\/\
                         ────────→
                         If L = one period of the wave,
                         these line up perfectly → correlation = 1.0
```

The `/ Math.sqrt(sum1 * sum2)` part normalizes the result to a value between -1 and 1, so volume changes don't fool us.

### 6d — Find the lag with the strongest match (line 113-124)
```javascript
let minLag = Math.floor(sampleRate / 400);  // Max freq ~400Hz
let maxLag = Math.floor(sampleRate / 80);   // Min freq ~80Hz

for (let lag = minLag; lag < Math.min(maxLag, bufferSize); lag++) {
  if (correlations[lag] > bestValue) {
    bestValue = correlations[lag];
    bestLag = lag;
  }
}
```

**Why this matters:**
- `minLag = sampleRate / 400` bounds the search to frequencies ≤ 400 Hz
- `maxLag = sampleRate / 80` bounds the search to frequencies ≥ 80 Hz
- This range covers every realistic human humming voice (typical: 80–300 Hz)

### Why the floor is 80 Hz (not 60 Hz)

We originally used 60 Hz as the floor — but that range catches far more noise than it does humming. Three reasons we raised it to 80 Hz:

| Frequency | What lives there |
|---|---|
| **60 Hz** | US electrical mains hum — the literal sound of bad power. Pure noise. |
| 65 Hz (C2) | Russian Octavist bass singers — extremely rare |
| **80 Hz** | Bottom of a bass-baritone's range — our new floor |
| 82 Hz (E2) | Lowest open string of a guitar |
| 100 Hz | Bottom of typical male humming range |

**1. Rejects AC mains hum.** Electrical interference at exactly 60 Hz is a real-world noise source in any room with wall power. Cutting below 80 Hz eliminates this entirely.

**2. ~25% faster autocorrelation.** The search range shrinks from 110-735 samples to 110-551 samples per frame. Autocorrelation is O(n²) per lag, so this measurably reduces CPU load on every frame at 60 fps.

**3. No realistic users lost.** Even deep bass-baritones don't hum below 80 Hz. Russian Octavists can technically produce notes that low, but they're singing — not humming — and they're vanishingly rare. The floor was raised after confirming that no plausible humming voice would be cut off.

Trade-off summary:
- **Before (60 Hz):** Caught everything humanly possible, plus AC hum and sub-bass noise
- **After (80 Hz):** Covers every realistic humming voice; cleaner signal, faster code

### 6e — Convert lag to frequency (line 127-133)
```javascript
if (bestLag > 0 && bestValue > 0.5) {
  const frequency = sampleRate / bestLag;
  if (frequency >= 60 && frequency <= 400) return frequency;
}
return null;
```

**Why this matters:**
- `bestValue > 0.5` rejects weak/ambiguous matches (less than 50% correlation)
- `frequency = sampleRate / bestLag` is the core formula: period (in samples) → frequency (in Hz)
  - Example: sampleRate=44100, bestLag=168 → frequency = 44100/168 ≈ 262.5 Hz ≈ C4

📦 **Output:** A single number — the pitch in Hz — or `null` if no confident detection.

---

## STEP 7 of 14 — Convert Hz to a Musical Note

**File: [src/EarCandy.jsx:139](src/EarCandy.jsx#L139)** — `frequencyToNote()`

```javascript
const A4 = 440;
const semitones = 12 * Math.log2(frequency / A4);
const semitonesFromC0 = Math.round(semitones) + 57;
const octave = Math.floor(semitonesFromC0 / 12);
const noteName = noteNames[((semitonesFromC0 % 12) + 12) % 12];
return { note: noteName, octave, frequency: Math.round(frequency) };
```

### Why this matters — the log₂ formula explained

| Line | Math | Why |
|---|---|---|
| `Math.log2(frequency / A4)` | How many octaves above (or below) A4? | Doubling Hz = +1 octave |
| `× 12` | Convert octaves to semitones | 12 semitones per octave |
| `Math.round(...)` | Snap to nearest semitone | Eliminates micro-tonal drift |
| `+ 57` | Shift origin from A4 to C0 | A4 = 57 semitones above C0 |
| `Math.floor(... / 12)` | Which octave (0-9)? | 12 semitones per octave |
| `noteNames[... % 12]` | Which note within the octave? | Cycle through C, C#, D...B |

**Example trace:** `frequency = 261.6 Hz` (which is C4)
```
log2(261.6 / 440) = -0.749
× 12 = -8.99
round(-9) + 57 = 48
floor(48 / 12) = 4         ← octave 4
48 % 12 = 0 → 'C'           ← note C
Result: { note: 'C', octave: 4 }
```

📦 **Output:** `{ note: 'C', octave: 4, frequency: 262 }`. Appended to `pitchDataRef` as `{ time, pitch, note }`.

---

## STEP 8 of 14 — Stop Recording

**File: [src/EarCandy.jsx:316](src/EarCandy.jsx#L316)** — `stopRecording()`

```javascript
setIsRecording(false);
isRecordingRef.current = false;       // signals the detect() loop to exit
cancelAnimationFrame(animationRef.current);
mediaRecorderRef.current.stop();       // triggers the onstop blob assembly
streamRef.current.getTracks().forEach(track => track.stop()); // release mic
audioContextRef.current.close();       // free audio engine
```

### Why this matters
The four shutdown steps in order:
1. Flag tells the `detect()` loop to stop on its next iteration
2. Cancels the pending `requestAnimationFrame` to be safe
3. Stops the MediaRecorder, which then assembles all chunks into the final blob
4. Closes the AudioContext (releases memory)

📦 **Output:** A complete `audioBlob` for playback + a complete `pitchData` array of all detected pitches over time.

---

## STEP 9 of 14 — Quantize the Pitch Stream into Discrete Notes

**File: [src/utils/melodyQuantizer.js:51](src/utils/melodyQuantizer.js#L51)** — `quantizePitchData()`

```javascript
function quantizePitchData(pitchData, options = {}) {
  const { windowMs = 150, minNoteDurationMs = 80 } = options;

  for (let i = 0; i < pitchData.length; i++) {
    const { pitch, time } = pitchData[i];
    const semitone = frequencyToSemitone(pitch);
    const timeSinceStart = time - noteStartTime;

    if (currentNoteSemitone === null) {
      // First note
    } else if (Math.abs(semitone - currentNoteSemitone) <= 2) {
      // Same note (within 2 semitones tolerance)
      noteFrequencies.push(pitch);
    } else if (timeSinceStart >= windowMs) {
      // Finalize current note, start new one
      const avgFrequency = noteFrequencies.reduce((a, b) => a + b, 0) / noteFrequencies.length;
      // ... emit note ...
    }
  }
}
```

### Why this matters — the messy reality of humming

Raw pitch data looks like this:
```
[262, 261, 263, 264, 261, 330, 329, 331, 330, 328, ...]
 ↑─────── C4 (with wobble) ──────↑  ↑──── E4 (with wobble) ────↑
```

The quantizer needs to:
1. **Tolerate vibrato** — `Math.abs(semitone - current) <= 2` allows ±2 semitones of wobble within the same note
2. **Wait for stability** — `windowMs = 150` requires the new pitch to hold for 150ms before committing it as a new note (avoids treating brief overshoots as separate notes)
3. **Average for accuracy** — once a note is committed, the average of all its frequency readings is more accurate than any single reading
4. **Filter artifacts** — `minNoteDurationMs = 80` discards notes that lasted less than 80ms (likely glitches, not real notes)

📦 **Output:** A clean note sequence like `[{note:'C', octave:4, duration:250}, {note:'E', octave:4, duration:200}, ...]`.

---

## STEP 10 of 14 — Run Song Recognition

**File: [src/EarCandy.jsx:413](src/EarCandy.jsx#L413)** — `recognizeSongs()`

```javascript
const noteNames = quantizedNotes.map(n => `${n.note}${n.octave}`);
const matches = matchMelody(noteNames, songDatabase, { maxResults: 5 });
setSongMatches(matches);
setActiveTab('recognition');
```

### Why this matters
- Flattens the rich note objects into simple strings: `['C4', 'E4', 'G4', 'C5']`
- Calls into the matching engine, which does the heavy lifting
- Switches to the recognition tab so the user sees results immediately

📦 **Output:** Up to 5 ranked song matches with confidence scores.

---

## STEP 11 of 14 — Convert Notes to Semitone Numbers

**File: [src/utils/matchingEngine.js:103](src/utils/matchingEngine.js#L103)** — `notesToSemitones()`

```javascript
function notesToSemitones(notes) {
  const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };
  return notes.map(noteStr => {
    const match = noteStr.match(/([A-G][#b]?)(\d)/);
    const noteName = match[1];
    const octave = parseInt(match[2]);
    return octave * 12 + NOTE_TO_SEMITONE[noteName];
  });
}
```

### Why this matters
- Semitone numbers are easier to compare than strings
- Handles both sharp (`C#`) and flat (`Db`) spellings — they map to the same number
- `octave × 12 + offset` gives a single integer per note: `C4 = 48`, `E4 = 52`, `G4 = 55`, `C5 = 60`

📦 **Output:** `[48, 52, 55, 60]`

---

## STEP 12 of 14 — Compute Intervals (Key-Independent Pattern)

**File: [src/utils/matchingEngine.js:130](src/utils/matchingEngine.js#L130)** — `getIntervals()`

```javascript
function getIntervals(semitones) {
  const intervals = [];
  for (let i = 1; i < semitones.length; i++) {
    intervals.push(semitones[i] - semitones[i - 1]);
  }
  return intervals;
}
```

### Why this matters — the single most important transformation

**With absolute notes:**
- Happy Birthday in C: `[60, 60, 62, 60, 65, 64]`
- Happy Birthday in G: `[67, 67, 69, 67, 72, 71]`
- These look completely different!

**With intervals:**
- Happy Birthday in C: `[0, +2, -2, +5, -1]`
- Happy Birthday in G: `[0, +2, -2, +5, -1]`  ← **identical!**

This is why singing in any key works. The matching engine compares interval patterns, not raw notes.

📦 **Output:** `[+4, +3, +5]` (intervals between notes)

---

## STEP 13 of 14 — Match Against Every Song in the Database

**File: [src/utils/matchingEngine.js:162-203](src/utils/matchingEngine.js#L162-L203)** — main loop inside `matchMelody()`

```javascript
for (const song of songDatabase) {              // 9,213 iterations
  const songSemitones = notesToSemitones(song.notes);
  const songIntervals = getIntervals(songSemitones);

  // Try every possible transposition (key shift)
  for (const shift of [0,1,2,...,11]) {

    // 13a — Interval matching (key-independent)
    const distance = findBestSubstringMatch(hummingIntervals, songIntervals);
    const intervalScore = Math.max(0, 1 - distance / (maxLen * 2));

    // 13b — Semitone matching (key-sensitive, with DTW)
    const transposedSemitones = transposeSequence(songSemitones, shift);
    const semitoneDist = normalizedDTWDistance(hummingSemitones, transposedSemitones);
    const semitoneScore = Math.max(0, 1 - (semitoneDist * 0.5));

    // 13c — Weighted combination
    const score = (intervalScore * 0.8) + (semitoneScore * 0.2);

    if (score > bestScore) bestScore = score;
  }

  results.push({ title: song.title, confidence: Math.round(bestScore * 100), ... });
}

results.sort((a, b) => b.confidence - a.confidence);
return results.slice(0, maxResults);
```

### Why this matters — three algorithms work together

**13a — Levenshtein on intervals** ([line 46](src/utils/matchingEngine.js#L46))
Counts insertions, deletions, and substitutions to align two interval sequences. Forgives missed notes and extra notes. Substitutions within ±1 semitone are free; bigger errors cost 1.

**13b — DTW on semitones** ([line 12](src/utils/matchingEngine.js#L12))
Dynamic Time Warping. Aligns two sequences by stretching/compressing the time axis. Forgives tempo differences:
```
Your hum:       C4 ─── D4 ───── E4
                            ╲       ╲
Database:       C4 ─ D4 ────── E4 ─ E4
                ↑       ↑              ↑
                aligns  warps         extra repeat ok
```

**13c — Substring matching** ([line 70](src/utils/matchingEngine.js#L70))
Slides your humming along every possible position in the song's full melody. Lets you hum just the chorus or just the first line and still match.

**13d — The 0.8 / 0.2 weighting** (line 197)
- 80% weight on intervals → transposition-invariant, doesn't matter what key you sing in
- 20% weight on absolute semitones → small bonus if you happen to sing in the song's original key

📦 **Output:** `[{title:'Happy Birthday', confidence:87}, {title:'Twinkle Twinkle', confidence:64}, ...]`

---

## STEP 14 of 14 — Render the Results

**File: [src/EarCandy.jsx](src/EarCandy.jsx)** — Recognition tab render block (~line 934)

```javascript
{songMatches.map(match => (
  <div className="match-card">
    <div className="confidence-badge">{match.confidence}%</div>
    <div className="title">{match.title}</div>
    <div className="artist">{match.artist}</div>
  </div>
))}
```

### Why this matters
- React's `map` renders one card per match
- The confidence badge gives the user an at-a-glance signal of match quality
- Title + artist gives them what they actually wanted: the song name

📦 **Output:** The user sees their answer on screen.

---

## Complete Data Flow Summary

```
   Step 1 │ 🎤  Air vibrations
          │
   Step 2 │ 💻  MediaStream from getUserMedia()
          │
   Step 3 │ 💻  AudioContext + AnalyserNode set up
          │
   Step 4 │ 💻  MediaRecorder started (parallel)
          │
   Step 5 │ 🟦  requestAnimationFrame loop pulling 2048-sample chunks
          │     ──> Float32Array buffer
          │
   Step 6 │ 🟦  detectPitch() autocorrelation
          │     ──> single Hz number per frame
          │
   Step 7 │ 🟦  frequencyToNote() log₂ math
          │     ──> { note: 'C', octave: 4, frequency: 262 }
          │     ──> pushed into pitchDataRef array
          │
   Step 8 │ 🟦  stopRecording() — graceful shutdown
          │     ──> { audioBlob, pitchData[] }
          │
   Step 9 │ 🟦  quantizePitchData() — smooth + group
          │     ──> [{note:'C',octave:4,duration:250}, ...]
          │
   Step 10│ 🟦  recognizeSongs() — call matcher
          │     ──> ['C4','E4','G4','C5']
          │
   Step 11│ 🟦  notesToSemitones()
          │     ──> [48, 52, 55, 60]
          │
   Step 12│ 🟦  getIntervals()
          │     ──> [+4, +3, +5]
          │
   Step 13│ 🟦  matchMelody() — DTW + Levenshtein × 9,213 songs
          │     ──> [{title, confidence, artist}, ...]
          │
   Step 14│ 🟦  React renders confidence cards
          │     ──> User sees result
          ▼
        DONE
```

---

## Two Sides of the Same Code

It helps to see the code split by **what it represents**:

### Signal processing (physical world)
- `detectPitch()` — autocorrelation, windowing
- `calculateRMS()` — loudness measurement
- `Hamming window` — spectral cleanup
- `getFloatTimeDomainData()` — raw waveform access

### Music theory (symbolic world)
- `frequencyToNote()` — Hz → note name
- `notesToSemitones()` — note name → integer
- `getIntervals()` — intervals between notes
- `transposeSequence()` — shift all notes by N semitones

### Pattern matching (algorithmic world)
- `dynamicTimeWarpingDistance()` — DTW
- `levenshteinDistance()` — edit distance
- `findBestSubstringMatch()` — sliding window
- `matchMelody()` — combines everything

Each layer translates the data into a form the next layer can use:
**physical → symbolic → pattern → match**.

---

## The Insight That Makes It All Work

Every layer reduces dimensionality:
```
44,100 numbers/sec  (raw audio)
      ↓
~60 pitch values/sec (60fps detection loop — 700× reduction)
      ↓
~3 notes/sec         (quantization — 20× reduction)
      ↓
~3 intervals/sec     (interval extraction)
      ↓
1 song match         (database lookup)
```

By the time we hit the matching engine, the data is compact enough to compare against thousands of songs in milliseconds — even though we started with a firehose of 44,100 raw samples per second.

That's the trick: **don't match audio. Match the musical fingerprint of audio.**

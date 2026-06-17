/**
 * Melody Quantizer
 * Converts continuous pitch frequencies to discrete musical notes
 * Handles octave detection and quantization
 */

// Note frequencies (equal temperament, A4 = 440Hz)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_FREQ = 440;
const A4_SEMITONE = 57; // A4 is 57 semitones above C0

/**
 * Convert frequency to the nearest semitone number
 * Returns semitone index relative to C0
 */
function frequencyToSemitone(frequency) {
  if (!frequency || frequency <= 0) return null;
  const semitones = 12 * Math.log2(frequency / A4_FREQ) + A4_SEMITONE;
  return Math.round(semitones);
}

/**
 * Convert frequency to a fractional semitone number (no rounding).
 * Used for sub-semitone (cents) comparisons: 1 semitone = 100 cents.
 */
function frequencyToSemitoneExact(frequency) {
  if (!frequency || frequency <= 0) return null;
  return 12 * Math.log2(frequency / A4_FREQ) + A4_SEMITONE;
}

/**
 * Convert semitone number to note name and octave
 * Example: 60 -> { note: 'C', octave: 4, semitone: 60 }
 */
function semitoneToNote(semitone) {
  const octave = Math.floor(semitone / 12);
  const noteIndex = ((semitone % 12) + 12) % 12;
  const note = NOTE_NAMES[noteIndex];
  return { note, octave, semitone };
}

/**
 * Convert frequency directly to note
 */
function frequencyToNote(frequency) {
  const semitone = frequencyToSemitone(frequency);
  if (semitone === null) return null;
  return semitoneToNote(semitone);
}

/**
 * Median-smooth the pitch stream to suppress vibrato and frame-to-frame jitter
 * before segmentation. Each reading's pitch becomes the median of the valid pitches
 * in a window centred on it. Median (not mean) so the occasional outlier frame
 * (e.g. a momentary octave glitch) can't drag the value.
 */
function medianSmoothPitches(pitchData, windowSize) {
  const half = Math.floor(windowSize / 2);
  return pitchData.map((d, i) => {
    const vals = [];
    for (let j = Math.max(0, i - half); j <= Math.min(pitchData.length - 1, i + half); j++) {
      if (pitchData[j].pitch) vals.push(pitchData[j].pitch);
    }
    if (vals.length === 0) return { ...d };
    vals.sort((a, b) => a - b);
    return { ...d, pitch: vals[Math.floor(vals.length / 2)] };
  });
}

/**
 * Quantize pitch data (array of { pitch, time } objects) to a note sequence.
 *
 * Two-stage, robust to the wobble of real (untrained) humming:
 *   1. median-smooth the pitch stream (kills vibrato/jitter), then
 *   2. group consecutive readings by nearest note (±50¢ band), but require a
 *      deviation to PERSIST for `confirmFrames` frames before starting a new note,
 *      so a transient excursion (vibrato peak, glitch) doesn't shatter a held note.
 *
 * @param {Array} pitchData - Array of { pitch, time } objects
 * @param {number} options.minNoteDurationMs - drop notes shorter than this (default 80)
 * @param {number} options.toleranceSemitones - ±band around a note's center (default 0.5 = ±50¢)
 * @param {number} options.smoothWindow - median-filter width in frames (default 15 ≈ 240ms
 *        at 60fps; ~one vibrato period, enough to flatten ±120¢ wobble into one note.
 *        Trade-off: very fast humming with notes shorter than ~240ms may merge.)
 * @param {number} options.confirmFrames - consecutive out-of-band frames to confirm a new note (default 4)
 * @returns {Array} Array of { note, octave, duration, frequency, semitone } objects
 */
function quantizePitchData(pitchData, options = {}) {
  const {
    // Raised from 80 to 180ms for demo-mode (small DB, casual humming):
    // filters transitional notes and breath blips between phrases so the
    // matcher sees a cleaner contour. Revisit if very fast humming gets cut.
    minNoteDurationMs = 180,
    toleranceSemitones = 0.5,
    smoothWindow = 15,
    confirmFrames = 4,
  } = options;

  if (!pitchData || pitchData.length === 0) return [];

  const smoothed = medianSmoothPitches(pitchData, smoothWindow);

  const notes = [];
  let currentNoteCenter = null; // integer semitone of the current note's center, or null
  let noteStartTime = smoothed[0].time;
  let noteFrequencies = [];
  // pending candidate for a new note, used to absorb transient excursions
  let candidateCenter = null;
  let candidateCount = 0;
  let candidateStartTime = 0;
  let candidateFreqs = [];

  const finalize = (endTime) => {
    if (currentNoteCenter === null || noteFrequencies.length === 0) return;
    const avgFrequency = noteFrequencies.reduce((a, b) => a + b, 0) / noteFrequencies.length;
    const noteInfo = semitoneToNote(frequencyToSemitone(avgFrequency));
    notes.push({ ...noteInfo, duration: endTime - noteStartTime, frequency: avgFrequency });
    console.log(`  Note: ${noteInfo.note}${noteInfo.octave} (${endTime - noteStartTime}ms, avg freq: ${avgFrequency.toFixed(1)}Hz)`);
  };

  for (let i = 0; i < smoothed.length; i++) {
    const { pitch, time } = smoothed[i];
    if (!pitch) continue;

    const semitoneExact = frequencyToSemitoneExact(pitch);
    const noteCenter = Math.round(semitoneExact);

    if (currentNoteCenter === null) {
      // First note
      currentNoteCenter = noteCenter;
      noteStartTime = time;
      noteFrequencies = [pitch];
      candidateCenter = null;
      candidateCount = 0;
      continue;
    }

    if (Math.abs(semitoneExact - currentNoteCenter) <= toleranceSemitones) {
      // Still within the current note's ±50¢ band: a prior excursion was transient.
      noteFrequencies.push(pitch);
      candidateCenter = null;
      candidateCount = 0;
      continue;
    }

    // Out of band -> possible new note. Only commit once it persists.
    if (noteCenter === candidateCenter) {
      candidateCount++;
      candidateFreqs.push(pitch);
    } else {
      candidateCenter = noteCenter;
      candidateCount = 1;
      candidateStartTime = time;
      candidateFreqs = [pitch];
    }

    if (candidateCount >= confirmFrames) {
      // Confirmed: close out the current note where the new pitch began, then start it.
      finalize(candidateStartTime);
      currentNoteCenter = candidateCenter;
      noteStartTime = candidateStartTime;
      noteFrequencies = candidateFreqs.slice();
      candidateCenter = null;
      candidateCount = 0;
      candidateFreqs = [];
    }
    // else: transient excursion — ignore it, the current note continues.
  }

  // Close out the final note.
  finalize(smoothed[smoothed.length - 1].time);

  // Drop notes shorter than the minimum (likely artifacts).
  const filtered = notes.filter(n => n.duration >= minNoteDurationMs);
  console.log(`Quantized ${notes.length} notes, kept ${filtered.length} after filtering`);
  return filtered;
}

/**
 * Convert note sequence to a string representation for easier comparison
 * Example: "C4 D4 E4 F4" or with durations "C4(0.5) D4(0.5) E4(1.0)"
 */
function noteSequenceToString(notes, includeDuration = false) {
  if (!notes || notes.length === 0) return '';
  
  if (includeDuration) {
    return notes
      .map(n => `${n.note}${n.octave}(${(n.duration / 1000).toFixed(2)})`)
      .join(' ');
  } else {
    return notes.map(n => `${n.note}${n.octave}`).join(' ');
  }
}

/**
 * Normalize notes to start from C (for transposition-invariant comparison)
 * Shifts all notes by the same amount so the first note becomes C
 */
function normalizeToC(notes) {
  if (!notes || notes.length === 0) return [];
  
  const firstNoteSemitone = notes[0].semitone;
  const targetSemitone = 24; // C2
  const shift = targetSemitone - firstNoteSemitone;
  
  return notes.map(n => ({
    ...n,
    semitone: n.semitone + shift,
    ...semitoneToNote(n.semitone + shift)
  }));
}

/**
 * Get relative intervals between notes (in semitones)
 * Useful for transposition-invariant matching
 * Example: [2, 2, 1, 2, 2, 2, 1] (like scale degrees)
 */
function getIntervalSequence(notes) {
  if (!notes || notes.length < 2) return [];
  
  const intervals = [];
  for (let i = 1; i < notes.length; i++) {
    intervals.push(notes[i].semitone - notes[i - 1].semitone);
  }
  return intervals;
}

/**
 * Get duration ratios (normalized by shortest note)
 * Useful for tempo-invariant matching
 */
function getDurationRatios(notes) {
  if (!notes || notes.length === 0) return [];
  
  const minDuration = Math.min(...notes.map(n => n.duration));
  return notes.map(n => Math.round(n.duration / minDuration * 10) / 10);
}

export {
  frequencyToSemitone,
  semitoneToNote,
  frequencyToNote,
  quantizePitchData,
  noteSequenceToString,
  normalizeToC,
  getIntervalSequence,
  getDurationRatios,
  NOTE_NAMES,
  A4_FREQ
};

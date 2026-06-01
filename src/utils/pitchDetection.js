/**
 * Pitch detection — the "physics layer".
 *
 * Time-domain autocorrelation pitch detection plus small note helpers.
 * This is the single source of truth shared by the live recorder (EarCandy.jsx)
 * and the "How it works" visualizer, so the picture on screen is exactly the
 * data the matcher uses — never a re-computation that could drift.
 *
 * NOT FFT: we never transform the signal into a frequency spectrum here. We
 * compare the waveform against time-shifted copies of itself; the shift (lag)
 * where it best matches is the fundamental period, and frequency = sampleRate / lag.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_FREQ = 440;

// Frequency search range for human humming (Hz).
// 80 Hz (~E2) rejects 60 Hz AC mains hum and sub-bass noise; 400 Hz (~G4) is
// above the top of a normal humming voice. Covers bass-baritone to soprano.
export const MIN_FREQ = 80;
export const MAX_FREQ = 400;

const MIN_CORRELATION = 0.5;   // reject weak / ambiguous matches
const SILENCE_THRESHOLD = 0.001;

/**
 * Analyze one frame of time-domain audio with normalized autocorrelation.
 * Returns the full intermediate state so callers can render exactly what the
 * detector sees.
 *
 * @param {Float32Array} audioData - one buffer of raw samples (-1..1)
 * @param {number} sampleRate
 * @returns {{
 *   frequency: number|null,     // detected fundamental in Hz, or null
 *   correlations: Float32Array, // normalized correlation per lag (-1..1)
 *   bestLag: number,            // lag (samples) of the chosen period, 0 if none
 *   bestValue: number,          // correlation strength at bestLag
 *   peakAmplitude: number,      // max |sample| this frame (loudness)
 *   minLag: number,             // search lower bound (samples) = MAX_FREQ
 *   maxLag: number,             // search upper bound (samples) = MIN_FREQ
 *   sampleRate: number
 * }}
 */
export function analyzePitchFrame(audioData, sampleRate) {
  const bufferSize = audioData.length;

  // Peak amplitude = how loud this frame is. (Amplitude, NOT frequency.)
  let peakAmplitude = 0;
  for (let i = 0; i < bufferSize; i++) {
    peakAmplitude = Math.max(peakAmplitude, Math.abs(audioData[i]));
  }

  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const maxLag = Math.floor(sampleRate / MIN_FREQ);
  const correlations = new Float32Array(bufferSize);

  const result = {
    frequency: null,
    correlations,
    bestLag: 0,
    bestValue: -1,
    peakAmplitude,
    minLag,
    maxLag,
    sampleRate,
  };

  if (peakAmplitude < SILENCE_THRESHOLD) return result; // too silent to analyze

  // Hamming window: taper the buffer edges to zero so the abrupt cutoff doesn't
  // create spurious high-frequency artifacts (spectral leakage).
  const windowed = new Float32Array(bufferSize);
  for (let i = 0; i < bufferSize; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (bufferSize - 1));
    windowed[i] = audioData[i] * w;
  }

  // Normalized autocorrelation at each lag. The /sqrt(...) normalization makes
  // the result a 0..1 similarity that is independent of loudness.
  for (let lag = 1; lag < bufferSize; lag++) {
    let sum = 0;
    let sum1 = 0;
    let sum2 = 0;
    for (let i = 0; i < bufferSize - lag; i++) {
      sum += windowed[i] * windowed[i + lag];
      sum1 += windowed[i] * windowed[i];
      sum2 += windowed[i + lag] * windowed[i + lag];
    }
    if (sum1 * sum2 > 0) {
      correlations[lag] = sum / Math.sqrt(sum1 * sum2);
    }
  }

  // Pick the lag with the strongest self-match within the human-humming range.
  let bestLag = 0;
  let bestValue = -1;
  for (let lag = minLag; lag < Math.min(maxLag, bufferSize); lag++) {
    if (correlations[lag] > bestValue) {
      bestValue = correlations[lag];
      bestLag = lag;
    }
  }
  result.bestLag = bestLag;
  result.bestValue = bestValue;

  if (bestLag > 0 && bestValue > MIN_CORRELATION) {
    const frequency = sampleRate / bestLag;
    if (frequency >= MIN_FREQ && frequency <= MAX_FREQ) {
      result.frequency = frequency;
    }
  }
  return result;
}

/**
 * Detect the fundamental pitch (Hz) of a frame, or null if none is confident.
 * Thin wrapper over analyzePitchFrame for callers that only want the number.
 */
export function detectPitch(audioData, sampleRate) {
  return analyzePitchFrame(audioData, sampleRate).frequency;
}

/**
 * Convert a frequency (Hz) to the nearest musical note.
 * Example: 261.6 -> { note: 'C', octave: 4, frequency: 262 }
 */
export function frequencyToNote(frequency) {
  if (!frequency || frequency <= 0) return null;
  const semitones = 12 * Math.log2(frequency / A4_FREQ);
  const semitonesFromC0 = Math.round(semitones) + 57; // A4 is 57 semitones above C0
  const octave = Math.floor(semitonesFromC0 / 12);
  const note = NOTE_NAMES[((semitonesFromC0 % 12) + 12) % 12];
  return { note, octave, frequency: Math.round(frequency) };
}

/**
 * How far (in cents, -50..+50) a frequency sits from its nearest note.
 * 100 cents = 1 semitone; the rounding boundary is at +/-50 cents.
 */
export function centsFromNearestNote(frequency) {
  if (!frequency || frequency <= 0) return 0;
  const semitones = 12 * Math.log2(frequency / A4_FREQ);
  return Math.round((semitones - Math.round(semitones)) * 100);
}

/** RMS amplitude (overall loudness) of a frame. */
export function calculateRMS(audioData) {
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  return Math.sqrt(sum / audioData.length);
}

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
 * Quantize pitch data (array of { pitch, time } objects) to a note sequence
 * Groups nearby pitches together and returns discrete notes
 * 
 * @param {Array} pitchData - Array of { pitch, time } objects
 * @param {number} options.windowMs - Time window to group notes (default: 150ms)
 * @param {number} options.minNoteDurationMs - Minimum note duration (default: 80ms)
 * @returns {Array} Array of { note, octave, duration, semitone } objects
 */
function quantizePitchData(pitchData, options = {}) {
  const { windowMs = 150, minNoteDurationMs = 80 } = options;
  
  if (!pitchData || pitchData.length === 0) return [];
  
  const notes = [];
  let currentNoteSemitone = null;
  let noteStartTime = pitchData[0].time;
  let noteFrequencies = [];
  
  for (let i = 0; i < pitchData.length; i++) {
    const { pitch, time } = pitchData[i];
    if (!pitch) continue;
    
    const semitone = frequencyToSemitone(pitch);
    const timeSinceStart = time - noteStartTime;
    
    // Check if this pitch belongs to the same note or a new note
    if (currentNoteSemitone === null) {
      // First note
      currentNoteSemitone = semitone;
      noteFrequencies = [pitch];
    } else if (Math.abs(semitone - currentNoteSemitone) <= 2) {
      // Same note (within 2 semitones tolerance - more lenient)
      noteFrequencies.push(pitch);
    } else if (timeSinceStart >= windowMs) {
      // Time to finalize the current note
      const avgFrequency = noteFrequencies.reduce((a, b) => a + b, 0) / noteFrequencies.length;
      const finalSemitone = frequencyToSemitone(avgFrequency);
      const noteInfo = semitoneToNote(finalSemitone);
      
      notes.push({
        ...noteInfo,
        duration: timeSinceStart,
        frequency: avgFrequency
      });
      
      console.log(`  Note: ${noteInfo.note}${noteInfo.octave} (${timeSinceStart}ms, avg freq: ${avgFrequency.toFixed(1)}Hz)`);
      
      // Start new note
      currentNoteSemitone = semitone;
      noteFrequencies = [pitch];
      noteStartTime = time;
    } else {
      // Pitch changed within window - favor the new pitch if it's sustained
      currentNoteSemitone = semitone;
      noteFrequencies = [pitch];
      noteStartTime = time;
    }
  }
  
  // Add the last note
  if (currentNoteSemitone !== null && noteFrequencies.length > 0) {
    const avgFrequency = noteFrequencies.reduce((a, b) => a + b, 0) / noteFrequencies.length;
    const finalSemitone = frequencyToSemitone(avgFrequency);
    const noteInfo = semitoneToNote(finalSemitone);
    const duration = pitchData[pitchData.length - 1].time - noteStartTime;
    
    notes.push({
      ...noteInfo,
      duration,
      frequency: avgFrequency
    });
    
    console.log(`  Note: ${noteInfo.note}${noteInfo.octave} (${duration}ms, avg freq: ${avgFrequency.toFixed(1)}Hz)`);
  }
  
  // Filter out very short notes (likely artifacts)
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

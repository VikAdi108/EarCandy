/**
 * Matching Engine
 * Implements Dynamic Time Warping (DTW) for fuzzy melody matching
 * Handles transposition and tempo variations
 */

/**
 * Dynamic Time Warping Distance
 * Compares two sequences allowing for timing variations
 * Returns distance (lower = better match)
 */
function dynamicTimeWarpingDistance(seq1, seq2) {
  if (seq1.length === 0 || seq2.length === 0) return Infinity;
  
  const n = seq1.length;
  const m = seq2.length;
  
  // Create DTW matrix
  const dtw = Array(n + 1).fill(null).map(() => Array(m + 1).fill(Infinity));
  dtw[0][0] = 0;
  
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(seq1[i - 1] - seq2[j - 1]);
      dtw[i][j] = cost + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1]);
    }
  }
  
  return dtw[n][m];
}

/**
 * Normalize DTW distance by sequence length
 * Allows fair comparison of sequences of different lengths
 */
function normalizedDTWDistance(seq1, seq2) {
  const distance = dynamicTimeWarpingDistance(seq1, seq2);
  const maxLen = Math.max(seq1.length, seq2.length);
  return maxLen > 0 ? distance / maxLen : 0;
}

/**
 * Levenshtein distance for comparing interval sequences
 * Allows insertions, deletions, and substitutions
 */
function levenshteinDistance(seq1, seq2) {
  const matrix = Array(seq1.length + 1).fill(null).map(() => Array(seq2.length + 1).fill(0));
  
  for (let i = 0; i <= seq1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= seq2.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= seq1.length; i++) {
    for (let j = 1; j <= seq2.length; j++) {
      const cost = Math.abs(seq1[i - 1] - seq2[j - 1]) > 1 ? 1 : 0;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[seq1.length][seq2.length];
}

/**
 * Find best matching substring of song in humming
 * Handles case where user hums only part of the song
 */
function findBestSubstringMatch(hummingIntervals, songIntervals) {
  let bestScore = Infinity;
  
  // Try all substrings of the song
  for (let i = 0; i <= songIntervals.length - hummingIntervals.length; i++) {
    const substring = songIntervals.slice(i, i + hummingIntervals.length);
    const distance = levenshteinDistance(hummingIntervals, substring);
    bestScore = Math.min(bestScore, distance);
  }
  
  // Also try sliding window matches
  if (hummingIntervals.length > songIntervals.length) {
    for (let i = 0; i <= hummingIntervals.length - songIntervals.length; i++) {
      const substring = hummingIntervals.slice(i, i + songIntervals.length);
      const distance = levenshteinDistance(substring, songIntervals);
      bestScore = Math.min(bestScore, distance);
    }
  }
  
  return bestScore;
}

/**
 * Transpose semitone sequence by a given amount
 */
function transposeSequence(semitones, shift) {
  return semitones.map(s => s + shift);
}

/**
 * Extract semitone sequence from note strings
 * Example: ['C4', 'D4', 'E4'] -> [24, 26, 28]
 */
function notesToSemitones(notes) {
  const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11
  };
  
  return notes.map(noteStr => {
    // Parse note string like "C4" or "C#5"
    const match = noteStr.match(/([A-G][#b]?)(\d)/);
    if (!match) return null;
    
    const noteName = match[1];
    const octave = parseInt(match[2]);
    const semitoneInOctave = NOTE_TO_SEMITONE[noteName];
    
    return octave * 12 + semitoneInOctave;
  });
}

/**
 * Get interval sequence from semitones
 */
function getIntervals(semitones) {
  const intervals = [];
  for (let i = 1; i < semitones.length; i++) {
    intervals.push(semitones[i] - semitones[i - 1]);
  }
  return intervals;
}

/**
 * Match a hummed melody against the song database
 * Returns ranked list of matches with scores
 */
function matchMelody(hummingNotes, songDatabase, options = {}) {
  const {
    maxResults = 5,
    useTransposition = true,
  } = options;
  
  if (!hummingNotes || hummingNotes.length < 3) {
    console.warn('⚠️ Need at least 3 notes for matching');
    return [];
  }
  
  const hummingSemitones = notesToSemitones(hummingNotes);
  const hummingIntervals = getIntervals(hummingSemitones);
  
  console.log('🎵 Humming semitones:', hummingSemitones);
  console.log('📐 Humming intervals:', hummingIntervals);
  console.log(`📊 Matching against ${songDatabase.length} songs...\n`);
  
  const results = [];
  
  for (const song of songDatabase) {
    const songSemitones = notesToSemitones(song.notes);
    const songIntervals = getIntervals(songSemitones);
    
    let bestScore = 0;
    let bestTransposition = 0;
    
    // Try different transpositions
    const transpositions = useTransposition 
      ? Array.from({ length: 12 }, (_, i) => i) // Try all 12 semitones
      : [0];
    
    for (const shift of transpositions) {
      // Score based on interval matching (transposition invariant)
      // Intervals are immune to key transposition
      let intervalScore = 0;
      
      if (hummingIntervals.length >= 2 && songIntervals.length >= 2) {
        // Try substring matching - user might hum only part of the song
        const distance = findBestSubstringMatch(hummingIntervals, songIntervals);

        // ─── NOTE (2026-05-30): Score-spread fix ──────────────────────────
        // OLD: const normalizedDistance = distance / (Math.max(humming, song) * 2);
        // The old denominator used the LONGER sequence × 2, which was 4-5×
        // larger than the actual maximum possible distance. This compressed
        // every match — even terrible ones — into the ~75-85% range.
        //
        // FIX: Since findBestSubstringMatch compares a window the size of the
        // humming, the max possible Levenshtein distance equals the humming
        // length. Dividing by that gives the true normalized error (0=perfect,
        // 1=worst-case), restoring the full 0-100% spread between matches.
        //
        // Revisit if: scores feel too harsh, or we want to weight by song
        // length again (e.g. to prefer matching against shorter melodies).
        // ──────────────────────────────────────────────────────────────────
        const normalizedDistance = distance / hummingIntervals.length;
        intervalScore = Math.max(0, 1 - normalizedDistance);
      }
      
      // Also score direct semitone matching (for same key songs)
      let semitoneScore = 0;
      const transposedSemitones = transposeSequence(songSemitones, shift);
      const semitoneDist = normalizedDTWDistance(hummingSemitones, transposedSemitones);
      semitoneScore = Math.max(0, 1 - (semitoneDist * 0.5));
      
      // Combined score: 80% intervals (transposition-invariant), 20% semitones (key-sensitive)
      const score = (intervalScore * 0.8) + (semitoneScore * 0.2);
      
      if (score > bestScore) {
        bestScore = score;
        bestTransposition = shift;
      }
    }
    
    // Always include all matches (no threshold) - let user see all results
    if (bestScore > 0) {
      results.push({
        songId: song.id,
        title: song.title,
        artist: song.artist,
        confidence: Math.round(bestScore * 100),
        transposition: bestTransposition,
        originalKey: song.key,
      });
    }
    
    if (bestScore >= 0.3) {
      console.log(`✓ ${song.title}: ${bestScore.toFixed(3)} (${Math.round(bestScore * 100)}%)`);
    }
  }
  
  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);
  
  console.log(`\n🏆 Top ${Math.min(maxResults, results.length)} matches found`);
  
  return results.slice(0, maxResults);
}

/**
 * Get confidence percentage (0-100)
 */
function getConfidencePercentage(score) {
  return Math.round(Math.max(0, Math.min(100, score * 100)));
}

export {
  dynamicTimeWarpingDistance,
  normalizedDTWDistance,
  levenshteinDistance,
  findBestSubstringMatch,
  transposeSequence,
  notesToSemitones,
  getIntervals,
  matchMelody,
  getConfidencePercentage
};

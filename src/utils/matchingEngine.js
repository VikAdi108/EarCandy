/**
 * Matching Engine
 * Implements Dynamic Time Warping (DTW) for fuzzy melody matching
 * Handles transposition and tempo variations
 */

// Steepness of the interval-score curve. intervalScore = 1 - (avgErrorPerInterval / SCALE).
// Lower = stricter (scores separate faster). Tuned empirically against known melodies.
const INTERVAL_ERROR_SCALE = 1.5;

// Coverage weighting: a song the hum matches IN FULL should outrank one where the
// hum is only a short fragment. coverageFactor ranges COVERAGE_FLOOR..1; lower floor
// = coverage matters more. 0.4 means a fragment match keeps at most 40% of its score.
const COVERAGE_FLOOR = 0.4;

// Minimum distinct notes required to attempt a confident match. Short hums share
// interval patterns with too many songs to be identifiable (see findings).
const MIN_DISTINCT_NOTES = 6;

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
      // Graded substitution cost: exact interval = 0, off-by-1 = 1, off-by-2+ = 2
      // (capped so a single octave error can't dominate the whole alignment).
      const cost = Math.min(Math.abs(seq1[i - 1] - seq2[j - 1]), 2);
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
 * Collapse consecutive identical semitones into one.
 * The hum can't reliably capture re-articulated same-pitch notes (there's no onset
 * detection — two same-pitch notes merge into one held note), so we normalize BOTH
 * hum and song to a repeat-free contour before comparing intervals. Otherwise a
 * melody like Happy Birthday (which opens on a repeated note) never lines up.
 */
function collapseRepeats(semitones) {
  return semitones.filter((s, i) => i === 0 || s !== semitones[i - 1]);
}

/**
 * Match a hummed melody against the song database
 * Returns ranked list of matches with scores
 *
 * KNOWN LIMITATION (future work): interval matching can't distinguish melodies that share
 * a short contour, so short hums / short stored templates aren't uniquely identifiable.
 * See PRESENTATION_QA.md "how is recognition practical?". To improve later:
 *   1. Use note durations (rhythm) as a tiebreaker between same-contour melodies.
 *   2. Store full/longer melodies in the DB instead of ~12-note openings (root-cause fix).
 */
function matchMelody(hummingNotes, songDatabase, options = {}) {
  const {
    maxResults = 5,
    useTransposition = true,
  } = options;
  
  const hummingSemitones = notesToSemitones(hummingNotes);
  // Compare repeat-free contours (see collapseRepeats). Full semitones are kept for
  // the absolute-pitch DTW term, which tolerates repeats on its own.
  const hummingCollapsed = collapseRepeats(hummingSemitones);
  const hummingIntervals = getIntervals(hummingCollapsed);

  // Gate on DISTINCT notes, not raw count: repeated notes carry no extra melodic
  // information, and short hums collide with too many songs to identify reliably.
  if (hummingCollapsed.length < MIN_DISTINCT_NOTES) {
    console.warn(`⚠️ Need at least ${MIN_DISTINCT_NOTES} distinct notes (got ${hummingCollapsed.length})`);
    return [];
  }
  
  console.log('🎵 Humming semitones:', hummingSemitones);
  console.log('📐 Humming intervals:', hummingIntervals);
  console.log(`📊 Matching against ${songDatabase.length} songs...\n`);
  
  const results = [];
  
  for (const song of songDatabase) {
    const songSemitones = notesToSemitones(song.notes);
    const songIntervals = getIntervals(collapseRepeats(songSemitones));
    
    // Interval score is transposition-invariant (intervals don't change with key),
    // so compute it ONCE per song rather than redundantly inside the shift loop.
    let intervalScore = 0;
    if (hummingIntervals.length >= 1 && songIntervals.length >= 1) {
      // Try substring matching - user might hum only part of the song
      const distance = findBestSubstringMatch(hummingIntervals, songIntervals);
      // Normalize by the HUM's length (not the song's) so a short query matched into
      // a long song isn't over-rewarded, then map through a steep curve so good
      // matches separate sharply from coincidental partial ones.
      const avgError = distance / Math.max(1, hummingIntervals.length);
      const matchQuality = Math.max(0, 1 - avgError / INTERVAL_ERROR_SCALE);
      // Coverage: how much of the song the hum actually spans. A full-melody match
      // outranks a long song where the hum is only a short coincidental fragment.
      const coverage = Math.min(hummingIntervals.length, songIntervals.length) / songIntervals.length;
      const coverageFactor = COVERAGE_FLOOR + (1 - COVERAGE_FLOOR) * coverage;
      intervalScore = matchQuality * coverageFactor;
    }

    // Semitone (absolute-pitch) score IS key-sensitive — try each transposition and
    // keep the best. Since intervalScore is constant across shifts, maximizing the
    // combined score is equivalent to maximizing this semitone score.
    const transpositions = useTransposition
      ? Array.from({ length: 12 }, (_, i) => i) // Try all 12 semitones
      : [0];

    let bestSemitoneScore = 0;
    let bestTransposition = 0;
    for (const shift of transpositions) {
      const transposedSemitones = transposeSequence(songSemitones, shift);
      const semitoneDist = normalizedDTWDistance(hummingSemitones, transposedSemitones);
      const semitoneScore = Math.max(0, 1 - (semitoneDist * 0.5));
      if (semitoneScore > bestSemitoneScore) {
        bestSemitoneScore = semitoneScore;
        bestTransposition = shift;
      }
    }

    // Combined score: 90% intervals (transposition-invariant), 10% semitones (key-sensitive).
    // Intervals carry the melody; the absolute-pitch term is a light tie-breaker.
    const bestScore = (intervalScore * 0.9) + (bestSemitoneScore * 0.1);
    
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
  getConfidencePercentage,
  MIN_DISTINCT_NOTES
};

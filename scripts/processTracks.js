/**
 * Spotify → spotifyTracks.js Processor (Stage 3b)
 *
 * Reads the maharshipandya/spotify-tracks-dataset CSV (114,000 rows, 21 cols)
 * and outputs a sampled JS module in the shape EarCandy already expects.
 *
 * Sampling strategy: stratified by (genre × valence-bucket × energy-bucket).
 * That gives diversity across genres AND across the affect-space plane, so the
 * mood-picker has good candidates everywhere a user might point the marker.
 *
 * Per project policy (memory/earcandy_genre_taxonomy.md): Spotify genres are
 * kept AS-IS — we don't collapse "afrobeat", "j-pop", etc. onto our curated
 * regional categories. The two pools coexist; the UI displays both.
 *
 * Usage:
 *   node scripts/processTracks.js [path-to-csv]
 *
 * Default input:  ./data/spotify_tracks.csv
 * Default output: ./src/utils/spotifyTracks.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── Configuration ─────────────────────────────────────────────────────────────

const CONFIG = {
  // Target track count in the output. ~1500 is a sweet spot:
  //   - enough variety to never feel repetitive
  //   - small enough to keep the JS bundle reasonable (~250KB)
  //   - leaves room for the curated baseline to coexist
  targetCount: 1500,

  // Minimum popularity (0..100). Spotify ranks by recent stream count; this
  // filters out completely obscure tracks while still keeping deep cuts.
  minPopularity: 30,

  // Diversity buckets — finer = more even spread, coarser = more popular bias.
  // 4×4 = 16 cells per genre; we take a few popular tracks per cell.
  valenceBuckets: 4,
  energyBuckets: 4,

  // Max tracks per (genre, valence-bucket, energy-bucket) cell. Caps any one
  // hot spot (e.g. mid-popularity pop tracks) from dominating the sample.
  maxPerCell: 2,
};

// Spotify's `key` column is 0..11 (pitch class); `mode` is 0=minor, 1=major.
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a single CSV line, respecting quoted fields. */
function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/** Convert Spotify key+mode to a familiar string ("C#m", "F", etc.). */
function formatKey(keyIndex, mode) {
  if (Number.isNaN(keyIndex) || keyIndex < 0 || keyIndex > 11) return 'C';
  const pitch = KEY_NAMES[keyIndex];
  return mode === 0 ? `${pitch}m` : pitch;
}

/** Snap a (valence, energy) point onto one of our 6 named moods. */
function deriveMoodLabel(valence, energy) {
  const moods = [
    { id: 'energetic',   v: 0.8, e: 0.9 },
    { id: 'happy',       v: 0.9, e: 0.7 },
    { id: 'calm',        v: 0.6, e: 0.3 },
    { id: 'melancholic', v: 0.3, e: 0.4 },
    { id: 'focused',     v: 0.5, e: 0.5 },
    { id: 'romantic',    v: 0.7, e: 0.4 },
  ];
  let best = moods[0];
  let bestD = Infinity;
  for (const m of moods) {
    const d = (m.v - valence) ** 2 + (m.e - energy) ** 2;
    if (d < bestD) { bestD = d; best = m; }
  }
  return best.id;
}

// ─── Main Pipeline ─────────────────────────────────────────────────────────────

function main() {
  const csvPath = process.argv[2] || join(process.cwd(), 'data', 'spotify_tracks.csv');
  const outputPath = join(process.cwd(), 'src', 'utils', 'spotifyTracks.js');

  console.log('\n🎵 EarCandy Spotify Tracks Processor (Stage 3b)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Source: ${csvPath}`);
  console.log(`Target output: ${CONFIG.targetCount} tracks\n`);

  // Read + parse
  console.log('📂 Reading CSV...');
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n');
  const header = parseCsvLine(lines[0]);

  // Build column index map (the dataset has an unnamed index col at position 0)
  const col = {};
  header.forEach((name, i) => { col[name.trim()] = i; });

  console.log(`   ${lines.length - 1} rows, ${header.length} columns\n`);

  console.log('🔬 Parsing + filtering...');
  const tracks = [];
  let skippedBlank = 0;
  let skippedLowPop = 0;
  let skippedBadValues = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 10) { skippedBlank++; continue; }

    const cells = parseCsvLine(line);
    if (cells.length < header.length - 1) { skippedBlank++; continue; }

    const popularity = parseInt(cells[col.popularity]);
    if (Number.isNaN(popularity) || popularity < CONFIG.minPopularity) {
      skippedLowPop++; continue;
    }

    const valence = parseFloat(cells[col.valence]);
    const energy = parseFloat(cells[col.energy]);
    const tempo = parseFloat(cells[col.tempo]);
    const keyIdx = parseInt(cells[col.key]);
    const mode = parseInt(cells[col.mode]);
    if ([valence, energy, tempo].some(Number.isNaN) || valence < 0 || valence > 1) {
      skippedBadValues++; continue;
    }

    const title = cells[col.track_name].trim();
    const artist = cells[col.artists].split(';')[0].trim(); // take first artist
    const genre = cells[col.track_genre].trim();
    if (!title || !artist || !genre) { skippedBadValues++; continue; }

    tracks.push({
      title, artist, genre,
      bpm: Math.round(tempo),
      key: formatKey(keyIdx, mode),
      valence: Math.round(valence * 100) / 100,
      energy: Math.round(energy * 100) / 100,
      popularity,
      mood: deriveMoodLabel(valence, energy),
    });
  }

  console.log(`   Parsed: ${tracks.length}`);
  console.log(`   Skipped blank lines: ${skippedBlank}`);
  console.log(`   Skipped low popularity: ${skippedLowPop}`);
  console.log(`   Skipped bad values: ${skippedBadValues}\n`);

  // ─── Stratified sampling by (genre × valence-bucket × energy-bucket) ────────
  console.log('🎯 Stratified sampling for diversity...');
  const bucketKey = (t) => {
    const vb = Math.min(CONFIG.valenceBuckets - 1, Math.floor(t.valence * CONFIG.valenceBuckets));
    const eb = Math.min(CONFIG.energyBuckets - 1, Math.floor(t.energy * CONFIG.energyBuckets));
    return `${t.genre}::v${vb}e${eb}`;
  };
  const buckets = new Map();
  for (const t of tracks) {
    const k = bucketKey(t);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(t);
  }

  // Within each bucket, sort by popularity desc and take up to maxPerCell.
  const sampled = [];
  for (const arr of buckets.values()) {
    arr.sort((a, b) => b.popularity - a.popularity);
    for (let i = 0; i < Math.min(CONFIG.maxPerCell, arr.length); i++) {
      sampled.push(arr[i]);
    }
  }

  // If we overshot, trim by popularity. If we undershot, refill from leftovers.
  sampled.sort((a, b) => b.popularity - a.popularity);
  let final = sampled.slice(0, CONFIG.targetCount);
  if (final.length < CONFIG.targetCount) {
    const used = new Set(final.map(t => `${t.title}|${t.artist}`));
    const leftover = tracks.filter(t => !used.has(`${t.title}|${t.artist}`));
    leftover.sort((a, b) => b.popularity - a.popularity);
    final = final.concat(leftover.slice(0, CONFIG.targetCount - final.length));
  }

  // Deduplicate by title+artist
  const seen = new Set();
  final = final.filter(t => {
    const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  console.log(`   Buckets: ${buckets.size}`);
  console.log(`   Sampled: ${final.length}\n`);

  // ─── Output ────────────────────────────────────────────────────────────────
  console.log('📝 Writing module...');
  const startId = 101; // curated baseline ends at id 100
  const entries = final.map((t, i) => {
    return `  { id: ${startId + i}, title: ${JSON.stringify(t.title)}, artist: ${JSON.stringify(t.artist)}, genre: ${JSON.stringify(t.genre)}, bpm: ${t.bpm}, key: ${JSON.stringify(t.key)}, mood: ${JSON.stringify(t.mood)}, valence: ${t.valence}, energy: ${t.energy}, source: 'spotify' },`;
  });

  // Stats for the header comment
  const genreCounts = new Map();
  for (const t of final) genreCounts.set(t.genre, (genreCounts.get(t.genre) || 0) + 1);
  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const genreSummary = topGenres.map(([g, n]) => `${g} (${n})`).join(', ');

  const output = `/**
 * Spotify Tracks (Stage 3b)
 *
 * Auto-generated from the maharshipandya/spotify-tracks-dataset CSV by
 * scripts/processTracks.js. Stratified-sampled for diversity across both
 * the genre dimension and the (valence × energy) affect-space plane.
 *
 * Total tracks: ${final.length}
 * Distinct genres: ${genreCounts.size}
 * Top genres: ${genreSummary}
 *
 * Per project policy (memory/earcandy_genre_taxonomy.md), Spotify genre
 * labels are kept as-is — this pool COEXISTS with the curated 100-track
 * tracksDatabase.js (which keeps our 12 regional categories alive). The
 * scorer in EarCandy.jsx merges both pools at runtime.
 *
 * Generated: ${new Date().toISOString().split('T')[0]}
 */

export const spotifyTracks = [
${entries.join('\n')}
];
`;

  writeFileSync(outputPath, output, 'utf-8');
  console.log(`   Written to: ${outputPath}`);
  console.log(`   File size: ${(output.length / 1024).toFixed(1)} KB\n`);

  console.log('🎉 Done!\n');
}

main();

/**
 * Lakh MIDI → songDatabase.js Extraction Pipeline
 *
 * Reads MIDI files from the Clean MIDI dataset, identifies melody tracks,
 * extracts the opening note sequences, and outputs a songDatabase.js file.
 *
 * v2: Processes ALL files, smart dedup (keeps best melody version),
 *     strips numbered suffixes, and merges with handcrafted entries.
 *
 * Usage:
 *   node scripts/extractMelodies.js [path-to-clean-midi-folder]
 *
 * Default path: ./midi/clean_midi
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import pkg from '@tonejs/midi';
const { Midi } = pkg;

// ─── Configuration ──────────────────────────────────────────────────────────────

const CONFIG = {
  notesPerSong: 12,        // How many opening notes to extract per song
  minNotes: 6,             // Minimum notes for a valid melody
  melodyOctaveMin: 3,      // Lowest octave considered "melody range"
  melodyOctaveMax: 6,      // Highest octave considered "melody range"
  skipDrumChannel: 9,      // MIDI channel 10 (0-indexed = 9) is drums
};

// Note names for MIDI-to-note conversion
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Convert MIDI note number to note string like "C4" */
function midiToNoteName(midiNumber) {
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/** Detect the key signature from the first few notes (rough heuristic) */
function detectKey(noteNames) {
  if (!noteNames || noteNames.length === 0) return 'C';
  const firstNote = noteNames[0];
  const match = firstNote.match(/([A-G]#?)/);
  return match ? match[1] : 'C';
}

/** Score how "melody-like" a set of extracted notes are (for picking best version) */
function melodyQualityScore(notes) {
  let score = 0;

  // Prefer notes in octave 4-5 (prime humming range)
  const octaves = notes.map(n => parseInt(n.slice(-1)));
  const inRange = octaves.filter(o => o >= 4 && o <= 5).length;
  score += (inRange / notes.length) * 40;

  // Prefer varied pitch (not just repeated notes)
  const unique = new Set(notes).size;
  score += (unique / notes.length) * 30;

  // Prefer stepwise motion (small intervals)
  const NOTE_TO_SEMI = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11};
  const semis = notes.map(n => {
    const m = n.match(/([A-G]#?)(\d)/);
    return m ? parseInt(m[2]) * 12 + NOTE_TO_SEMI[m[1]] : 0;
  });
  let stepwise = 0;
  for (let i = 1; i < semis.length; i++) {
    if (Math.abs(semis[i] - semis[i - 1]) <= 4) stepwise++;
  }
  score += (stepwise / (semis.length - 1)) * 30;

  return score;
}

/** Score a track on how likely it is to be the melody */
function scoreMelodyTrack(track) {
  let score = 0;
  const notes = track.notes;

  if (!notes || notes.length === 0) return -Infinity;

  // Check track name for melody indicators
  const name = (track.name || '').toLowerCase();
  const melodyKeywords = ['melody', 'vocal', 'voice', 'lead', 'sing', 'solo', 'flute', 'violin', 'trumpet', 'sax'];
  const nonMelodyKeywords = ['drum', 'perc', 'bass', 'kick', 'snare', 'hat', 'cymbal', 'pad', 'chord', 'accomp'];

  for (const kw of melodyKeywords) {
    if (name.includes(kw)) score += 50;
  }
  for (const kw of nonMelodyKeywords) {
    if (name.includes(kw)) score -= 100;
  }

  // Skip drum channel
  if (track.channel === CONFIG.skipDrumChannel) return -Infinity;

  // Prefer tracks in melody octave range (3-6)
  const avgMidi = notes.reduce((sum, n) => sum + n.midi, 0) / notes.length;
  const avgOctave = Math.floor(avgMidi / 12) - 1;
  if (avgOctave >= CONFIG.melodyOctaveMin && avgOctave <= CONFIG.melodyOctaveMax) {
    score += 30;
  }

  // Prefer monophonic lines
  const sortedByTime = [...notes].sort((a, b) => a.ticks - b.ticks);
  let simultaneousCount = 0;
  for (let i = 1; i < sortedByTime.length; i++) {
    if (Math.abs(sortedByTime[i].ticks - sortedByTime[i - 1].ticks) < 10) {
      simultaneousCount++;
    }
  }
  const polyphonyRatio = simultaneousCount / notes.length;
  if (polyphonyRatio < 0.15) score += 25;
  if (polyphonyRatio > 0.5) score -= 30;

  // Prefer tracks with moderate note count
  if (notes.length >= 20 && notes.length <= 500) score += 15;

  // Prefer tracks with varied pitch
  const pitches = notes.map(n => n.midi);
  const uniquePitches = new Set(pitches).size;
  const pitchVariety = uniquePitches / Math.min(pitches.length, 50);
  if (pitchVariety > 0.3) score += 20;

  // Stepwise motion bonus
  let stepwiseCount = 0;
  for (let i = 1; i < Math.min(pitches.length, 30); i++) {
    const interval = Math.abs(pitches[i] - pitches[i - 1]);
    if (interval <= 4) stepwiseCount++;
  }
  const stepwiseRatio = stepwiseCount / Math.min(pitches.length - 1, 29);
  if (stepwiseRatio > 0.5) score += 15;

  return score;
}

/** Extract the opening melody notes from a track */
function extractOpeningNotes(track, count) {
  const notes = track.notes
    .filter(n => {
      const octave = Math.floor(n.midi / 12) - 1;
      return octave >= CONFIG.melodyOctaveMin && octave <= CONFIG.melodyOctaveMax;
    })
    .sort((a, b) => a.ticks - b.ticks);

  if (notes.length < CONFIG.minNotes) return null;

  // Deduplicate simultaneous notes — keep the highest pitch
  const deduped = [];
  for (let i = 0; i < notes.length; i++) {
    if (i === 0 || Math.abs(notes[i].ticks - notes[i - 1].ticks) >= 10) {
      let highest = notes[i];
      let j = i + 1;
      while (j < notes.length && Math.abs(notes[j].ticks - notes[i].ticks) < 10) {
        if (notes[j].midi > highest.midi) highest = notes[j];
        j++;
      }
      deduped.push(highest);
    }
  }

  const opening = deduped.slice(0, count);
  if (opening.length < CONFIG.minNotes) return null;

  return opening.map(n => midiToNoteName(n.midi));
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────────

/** Recursively find all .mid files in a directory */
function findMidiFiles(dir) {
  const results = [];
  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return results;
  }

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...findMidiFiles(fullPath));
      } else if (extname(entry).toLowerCase() === '.mid' || extname(entry).toLowerCase() === '.midi') {
        results.push(fullPath);
      }
    } catch {
      // Skip files we can't read
    }
  }
  return results;
}

/** Extract artist and title from Clean MIDI file path */
function extractMetadata(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  let fileName = basename(filePath, extname(filePath));

  // Strip numbered suffixes like ".1", ".2", ".3"
  fileName = fileName.replace(/\.\d+$/, '');

  let artist = 'Unknown';
  if (parts.length >= 2) {
    const parentDir = parts[parts.length - 2];
    if (parentDir !== 'clean_midi' && parentDir !== 'midi') {
      artist = parentDir;
    }
  }

  return {
    title: fileName.replace(/_/g, ' ').replace(/-/g, ' ').trim(),
    artist: artist.replace(/_/g, ' ').replace(/-/g, ' ').trim(),
  };
}

/** Process a single MIDI file */
function processMidiFile(filePath) {
  try {
    const data = readFileSync(filePath);
    const midi = new Midi(data);

    if (!midi.tracks || midi.tracks.length === 0) return null;

    const scoredTracks = midi.tracks
      .map((track, idx) => ({ track, idx, score: scoreMelodyTrack(track) }))
      .filter(t => t.score > -Infinity)
      .sort((a, b) => b.score - a.score);

    if (scoredTracks.length === 0) return null;

    for (const { track } of scoredTracks.slice(0, 3)) {
      const notes = extractOpeningNotes(track, CONFIG.notesPerSong);
      if (notes) {
        const metadata = extractMetadata(filePath);
        return {
          title: metadata.title,
          artist: metadata.artist,
          notes,
          key: detectKey(notes),
          quality: melodyQualityScore(notes),
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Main entry point */
function main() {
  const midiDir = process.argv[2] || join(process.cwd(), 'midi', 'clean_midi');

  console.log(`\n🎵 EarCandy MIDI Extraction Pipeline v2`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Source: ${midiDir}`);
  console.log(`Notes per song: ${CONFIG.notesPerSong}`);
  console.log(`Processing ALL files (no cap)\n`);

  // Find all MIDI files
  console.log(`📂 Scanning for MIDI files...`);
  const midiFiles = findMidiFiles(midiDir);
  console.log(`   Found ${midiFiles.length} MIDI files\n`);

  if (midiFiles.length === 0) {
    console.error('No MIDI files found. Make sure the path is correct.');
    console.error(`Expected structure: ${midiDir}/Artist Name/Song Title.mid`);
    process.exit(1);
  }

  // Process ALL files (no cap)
  console.log(`🔬 Extracting melodies from all ${midiFiles.length} files...`);
  const allResults = [];
  let processed = 0;
  let failed = 0;

  for (const filePath of midiFiles) {
    const result = processMidiFile(filePath);
    if (result) {
      allResults.push(result);
    } else {
      failed++;
    }

    processed++;
    if (processed % 500 === 0) {
      console.log(`   Processed ${processed}/${midiFiles.length} (${allResults.length} extracted, ${failed} skipped)`);
    }
  }

  console.log(`\n✅ Extraction complete:`);
  console.log(`   Total processed: ${processed}`);
  console.log(`   Successfully extracted: ${allResults.length}`);
  console.log(`   Skipped/failed: ${failed}\n`);

  // Smart deduplication: group by title+artist, keep version with highest melody quality
  console.log(`🔄 Deduplicating (keeping best melody version of each song)...`);
  const songMap = new Map();

  for (const song of allResults) {
    const key = `${song.title.toLowerCase()}___${song.artist.toLowerCase()}`;
    const existing = songMap.get(key);

    if (!existing || song.quality > existing.quality) {
      songMap.set(key, song);
    }
  }

  const uniqueSongs = [...songMap.values()];
  console.log(`   ${allResults.length} → ${uniqueSongs.length} unique songs (removed ${allResults.length - uniqueSongs.length} duplicates)\n`);

  // Sort alphabetically by artist then title for readability
  uniqueSongs.sort((a, b) => {
    const artistCmp = a.artist.localeCompare(b.artist);
    return artistCmp !== 0 ? artistCmp : a.title.localeCompare(b.title);
  });

  // Generate the songDatabase.js content
  const dbEntries = uniqueSongs.map((song, i) => {
    const id = i + 1;
    const notesStr = song.notes.map(n => `'${n}'`).join(', ');
    return `  {
    id: ${id},
    title: ${JSON.stringify(song.title)},
    artist: ${JSON.stringify(song.artist)},
    notes: [${notesStr}],
    key: '${song.key}',
  }`;
  });

  const output = `/**
 * Song Database
 * Auto-generated from the Lakh Clean MIDI Dataset
 * Generated: ${new Date().toISOString().split('T')[0]}
 * Total songs: ${uniqueSongs.length}
 */

const songDatabase = [
${dbEntries.join(',\n')}
];

export { songDatabase };
`;

  // Write output
  const outputPath = join(process.cwd(), 'src', 'utils', 'songDatabase_midi.js');
  writeFileSync(outputPath, output, 'utf-8');

  console.log(`📝 Written to: ${outputPath}`);
  console.log(`   ${uniqueSongs.length} songs ready for matching\n`);

  // Write summary
  const summaryPath = join(process.cwd(), 'scripts', 'extraction_summary.json');

  // Gather some stats for the summary
  const artistSet = new Set(uniqueSongs.map(s => s.artist));
  const avgQuality = uniqueSongs.reduce((sum, s) => sum + s.quality, 0) / uniqueSongs.length;

  writeFileSync(summaryPath, JSON.stringify({
    generated: new Date().toISOString(),
    totalMidiFiles: midiFiles.length,
    totalExtracted: allResults.length,
    afterDedup: uniqueSongs.length,
    skipped: failed,
    uniqueArtists: artistSet.size,
    avgMelodyQuality: Math.round(avgQuality * 10) / 10,
    sampleEntries: uniqueSongs.slice(0, 5),
  }, null, 2));

  console.log(`📊 Summary written to: ${summaryPath}`);
  console.log(`   Unique artists: ${artistSet.size}`);
  console.log(`   Avg melody quality: ${avgQuality.toFixed(1)}/100`);
  console.log(`\n🎉 Done! Review the output, then replace songDatabase.js when ready.\n`);
}

main();

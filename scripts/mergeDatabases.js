/**
 * Merge Script: Combines handcrafted songDatabase.js with MIDI-extracted songDatabase_midi.js
 *
 * Priority: handcrafted entries win over MIDI entries for the same song.
 * Also fixes known wrong-artist attributions from the MIDI dataset.
 *
 * Usage:
 *   node scripts/mergeDatabases.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── Known artist corrections for MIDI dataset ─────────────────────────────────
// The MIDI dataset often has cover versions attributed to the wrong artist.

const ARTIST_FIXES = {
  'stairway to heaven': { artist: 'Led Zeppelin' },
  'yesterday': { artist: 'The Beatles' },
  'smells like teen spirit': { artist: 'Nirvana' },
  'billie jean': { artist: 'Michael Jackson' },
  'thriller': { artist: 'Michael Jackson' },
  'beat it': { artist: 'Michael Jackson' },
  'bad': { artist: 'Michael Jackson' },
  'black or white': { artist: 'Michael Jackson' },
  'smooth criminal': { artist: 'Michael Jackson' },
  'wanna be startin somethin': { artist: 'Michael Jackson' },
  "rock with you": { artist: 'Michael Jackson' },
  "don't stop 'til you get enough": { artist: 'Michael Jackson' },
};

// ─── Parse a songDatabase file and extract entries ──────────────────────────────

function parseSongDatabase(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  const songs = [];
  // Match each song object block
  const regex = /\{\s*\n\s*id:\s*(\d+),\s*\n\s*title:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),\s*\n\s*artist:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),\s*\n\s*notes:\s*\[([^\]]+)\],/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const title = match[2].slice(1, -1); // Remove quotes
    const artist = match[3].slice(1, -1);
    const notesStr = match[4];
    const notes = notesStr.match(/'([^']+)'/g)?.map(n => n.slice(1, -1)) || [];

    // Extract key if present
    const keyMatch = content.slice(match.index).match(/key:\s*'([^']+)'/);
    const key = keyMatch ? keyMatch[1] : 'C';

    if (notes.length >= 3) {
      songs.push({ title, artist, notes, key });
    }
  }

  return songs;
}

function main() {
  const handcraftedPath = join(process.cwd(), 'src', 'utils', 'songDatabase.js');
  const midiPath = join(process.cwd(), 'src', 'utils', 'songDatabase_midi.js');
  const outputPath = join(process.cwd(), 'src', 'utils', 'songDatabase_merged.js');

  console.log('\n🔀 EarCandy Database Merge');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Parse both databases
  console.log('📖 Reading handcrafted database...');
  const handcrafted = parseSongDatabase(handcraftedPath);
  console.log(`   ${handcrafted.length} songs\n`);

  console.log('📖 Reading MIDI-extracted database...');
  const midi = parseSongDatabase(midiPath);
  console.log(`   ${midi.length} songs\n`);

  // Apply artist fixes to MIDI entries
  let fixCount = 0;
  for (const song of midi) {
    const fix = ARTIST_FIXES[song.title.toLowerCase()];
    if (fix) {
      song.artist = fix.artist;
      fixCount++;
    }
  }
  console.log(`🔧 Applied ${fixCount} artist corrections to MIDI entries\n`);

  // Merge: handcrafted entries take priority
  const merged = new Map();

  // Add handcrafted first (these always win)
  for (const song of handcrafted) {
    const key = song.title.toLowerCase();
    merged.set(key, { ...song, source: 'handcrafted' });
  }
  console.log(`✅ Added ${handcrafted.length} handcrafted entries (priority)\n`);

  // Add MIDI entries that don't collide with handcrafted
  let midiAdded = 0;
  let midiSkipped = 0;
  for (const song of midi) {
    const key = song.title.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, { ...song, source: 'midi' });
      midiAdded++;
    } else {
      midiSkipped++;
    }
  }
  console.log(`✅ Added ${midiAdded} MIDI entries`);
  console.log(`⏭️  Skipped ${midiSkipped} MIDI entries (handcrafted version exists)\n`);

  // Convert to sorted array
  const allSongs = [...merged.values()];
  allSongs.sort((a, b) => {
    // Handcrafted first, then MIDI alphabetically
    if (a.source !== b.source) return a.source === 'handcrafted' ? -1 : 1;
    const artistCmp = a.artist.localeCompare(b.artist);
    return artistCmp !== 0 ? artistCmp : a.title.localeCompare(b.title);
  });

  // Generate output
  const dbEntries = allSongs.map((song, i) => {
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

  const handcraftedCount = allSongs.filter(s => s.source === 'handcrafted').length;
  const midiCount = allSongs.filter(s => s.source === 'midi').length;

  const output = `/**
 * Song Database — Merged
 * Handcrafted entries (verified): ${handcraftedCount}
 * MIDI-extracted entries (Lakh Clean MIDI Dataset): ${midiCount}
 * Total: ${allSongs.length}
 * Generated: ${new Date().toISOString().split('T')[0]}
 */

const songDatabase = [
${dbEntries.join(',\n')}
];

export { songDatabase };
`;

  writeFileSync(outputPath, output, 'utf-8');

  console.log(`📝 Merged database written to: ${outputPath}`);
  console.log(`   Handcrafted: ${handcraftedCount}`);
  console.log(`   MIDI: ${midiCount}`);
  console.log(`   Total: ${allSongs.length} songs\n`);
  console.log('🎉 Done! To activate, rename songDatabase_merged.js → songDatabase.js\n');
}

main();

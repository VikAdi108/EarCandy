import React, { useState, useRef, useEffect, useCallback } from 'react';
import { quantizePitchData, noteSequenceToString } from './utils/melodyQuantizer';
import { matchMelody, getThresholdsForDB } from './utils/matchingEngine';
import { songDatabase } from './utils/songDatabase';
import { detectPitch, frequencyToNote, calculateRMS } from './utils/pitchDetection';
import { recognizeWithAudD, shouldUseFallback, isSandboxToken } from './utils/auddFallback';
import { tracksDatabase } from './utils/tracksDatabase';
import { spotifyTracks } from './utils/spotifyTracks';

// Stage 3b merge: curated 100-track baseline + Spotify-derived pool.
// The curated tracks come first so their hand-tagged metadata (regional
// categories like Carnatic, Qawwali) takes precedence in any ID-based lookups.
// Both pools share the same schema; the scorer treats them identically.
// Spotify-origin tracks carry source: 'spotify' for UI/debug purposes.
const sampleTracks = [...tracksDatabase, ...spotifyTracks];
import HowItWorks from './components/HowItWorks';

// ============================================
// EARCANDY - Music Recognition & Recommendation
// Bridging Physics of Sound + Psychology
// ============================================

// Color palette - warm, inviting, candy-inspired but sophisticated
const colors = {
  bg: '#0a0a0f',
  bgGradient: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)',
  primary: '#ff6b6b',
  secondary: '#4ecdc4',
  accent: '#ffe66d',
  purple: '#a855f7',
  text: '#f8f8f2',
  textMuted: '#8892b0',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBorder: 'rgba(255,255,255,0.08)',
};

// Mood configurations with psychological associations
const moods = [
  { id: 'energetic', emoji: '⚡', label: 'Energetic', color: '#ff6b6b', valence: 0.8, energy: 0.9 },
  { id: 'happy', emoji: '☀️', label: 'Happy', color: '#ffe66d', valence: 0.9, energy: 0.7 },
  { id: 'calm', emoji: '🌊', label: 'Calm', color: '#4ecdc4', valence: 0.6, energy: 0.3 },
  { id: 'melancholic', emoji: '🌙', label: 'Melancholic', color: '#a855f7', valence: 0.3, energy: 0.4 },
  { id: 'focused', emoji: '🎯', label: 'Focused', color: '#60a5fa', valence: 0.5, energy: 0.5 },
  { id: 'romantic', emoji: '💫', label: 'Romantic', color: '#f472b6', valence: 0.7, energy: 0.4 },
];

// Time-of-day default mood: rough psychological priors based on diurnal rhythm.
// Cortisol peaks in the morning (high energy), tapers through the day, and
// reflection/melancholy tend to land in the late hours. We use these as a
// starting marker position — the user can still drag anywhere.
function getDefaultMoodForHour(hour) {
  if (hour >= 5 && hour < 10)  return { valence: 0.70, energy: 0.65, label: 'Morning' };
  if (hour >= 10 && hour < 14) return { valence: 0.60, energy: 0.55, label: 'Midday' };
  if (hour >= 14 && hour < 17) return { valence: 0.60, energy: 0.40, label: 'Afternoon' };
  if (hour >= 17 && hour < 21) return { valence: 0.65, energy: 0.45, label: 'Evening' };
  if (hour >= 21 || hour < 1)  return { valence: 0.50, energy: 0.30, label: 'Night' };
  return { valence: 0.35, energy: 0.30, label: 'Late Night' }; // 1-5
}

// Pretty-print a raw genre id like "psych-rock" or "alt-rock" into "Psych Rock"
// for tracks whose genre we don't have nice display info for in globalGenres.
function formatGenreId(id) {
  if (!id) return 'Global';
  return id
    .split('-')
    .map(w => w[0] ? w[0].toUpperCase() + w.slice(1) : w)
    .join(' ');
}

// Find the closest named mood for a given (v, e) point — used to label
// arbitrary positions on the grid with a friendly name.
function nearestNamedMood(valence, energy) {
  let best = moods[0];
  let bestDist = Infinity;
  for (const m of moods) {
    const dv = m.valence - valence;
    const de = m.energy - energy;
    const d = Math.sqrt(dv * dv + de * de);
    if (d < bestDist) { bestDist = d; best = m; }
  }
  return { mood: best, distance: bestDist };
}

// Global genre database — display info (region label + color) per genre id.
// Two-tier taxonomy per memory/earcandy_genre_taxonomy.md:
//   Tier 1 (CURATED) — our 12 hand-picked regional categories. These are the
//     identity of the global recommendation pitch; they appear first and never
//     get collapsed onto Spotify equivalents.
//   Tier 2 (SPOTIFY) — common Spotify genre labels we want to display nicely.
//     Tracks with genres NOT in either tier still render via a default
//     ("Global" region, primary color) so no track is ever hidden.
const globalGenres = [
  // ── Tier 1: Curated regional categories ───────────────────────────────────
  { id: 'carnatic',      name: 'Carnatic Classical',   region: 'South India',     color: '#ff9f43' },
  { id: 'hindustani',    name: 'Hindustani Classical', region: 'North India',     color: '#ee5a24' },
  { id: 'finnish_metal', name: 'Finnish Death Metal',  region: 'Finland',         color: '#2d3436' },
  { id: 'reggaeton',     name: 'Reggaetón',            region: 'Puerto Rico',     color: '#00b894' },
  { id: 'gospel',        name: 'Gospel',               region: 'USA',             color: '#fdcb6e' },
  { id: 'kpop',          name: 'K-Pop',                region: 'South Korea',     color: '#fd79a8' },
  { id: 'afrobeat',      name: 'Afrobeat',             region: 'West Africa',     color: '#e17055' },
  { id: 'bossa_nova',    name: 'Bossa Nova',           region: 'Brazil',          color: '#74b9ff' },
  { id: 'flamenco',      name: 'Flamenco',             region: 'Spain',           color: '#d63031' },
  { id: 'jpop',          name: 'J-Pop',                region: 'Japan',           color: '#ff7675' },
  { id: 'qawwali',       name: 'Qawwali',              region: 'Pakistan',        color: '#a29bfe' },
  { id: 'american_rock', name: 'American Rock',        region: 'USA',             color: '#636e72' },

  // ── Tier 2: Common Spotify genre labels (display polish for the 1097-track Spotify pool) ──
  // Spotify uses its own id for k-pop ('k-pop' with hyphen), j-pop ('j-pop'), etc.
  // We add aliases here rather than rewriting the data so both spellings work.
  { id: 'k-pop',         name: 'K-Pop',                region: 'South Korea',     color: '#fd79a8' },
  { id: 'j-pop',         name: 'J-Pop',                region: 'Japan',           color: '#ff7675' },
  { id: 'j-rock',        name: 'J-Rock',               region: 'Japan',           color: '#ff6b6b' },
  { id: 'j-dance',       name: 'J-Dance',              region: 'Japan',           color: '#fb6f92' },
  { id: 'j-idol',        name: 'J-Idol',               region: 'Japan',           color: '#ffafcc' },
  { id: 'mandopop',      name: 'Mandopop',             region: 'Greater China',   color: '#f48fb1' },
  { id: 'cantopop',      name: 'Cantopop',             region: 'Hong Kong',       color: '#f06292' },
  { id: 'indian',        name: 'Indian',               region: 'India',           color: '#ff9f43' },
  { id: 'iranian',       name: 'Persian',              region: 'Iran',            color: '#06d6a0' },
  { id: 'malay',         name: 'Malay',                region: 'Malaysia',        color: '#4ecdc4' },
  { id: 'turkish',       name: 'Turkish',              region: 'Türkiye',         color: '#ef476f' },
  { id: 'spanish',       name: 'Spanish',              region: 'Spain',           color: '#e63946' },
  { id: 'french',        name: 'French',               region: 'France',          color: '#a8dadc' },
  { id: 'german',        name: 'German',               region: 'Germany',         color: '#fcbf49' },
  { id: 'swedish',       name: 'Swedish',              region: 'Sweden',          color: '#457b9d' },
  { id: 'british',       name: 'British',              region: 'UK',              color: '#1d3557' },
  { id: 'latin',         name: 'Latin',                region: 'Latin America',   color: '#f4a261' },
  { id: 'latino',        name: 'Latino',               region: 'Latin America',   color: '#e76f51' },
  { id: 'samba',         name: 'Samba',                region: 'Brazil',          color: '#06aed5' },
  { id: 'pagode',        name: 'Pagode',               region: 'Brazil',          color: '#0096c7' },
  { id: 'forro',         name: 'Forró',                region: 'Brazil',          color: '#0077b6' },
  { id: 'mpb',           name: 'MPB',                  region: 'Brazil',          color: '#48cae4' },
  { id: 'sertanejo',     name: 'Sertanejo',            region: 'Brazil',          color: '#90e0ef' },
  { id: 'brazil',        name: 'Brazilian',            region: 'Brazil',          color: '#74b9ff' },
  { id: 'salsa',         name: 'Salsa',                region: 'Caribbean',       color: '#f72585' },
  { id: 'tango',         name: 'Tango',                region: 'Argentina',       color: '#b5179e' },
  { id: 'reggae',        name: 'Reggae',               region: 'Jamaica',         color: '#7209b7' },
  { id: 'dancehall',     name: 'Dancehall',            region: 'Jamaica',         color: '#560bad' },
  { id: 'opera',         name: 'Opera',                region: 'Europe',          color: '#9d4edd' },
  { id: 'classical',     name: 'Classical',            region: 'Global',          color: '#c77dff' },
  { id: 'jazz',          name: 'Jazz',                 region: 'USA',             color: '#5e548e' },
  { id: 'blues',         name: 'Blues',                region: 'USA',             color: '#22577a' },
  { id: 'soul',          name: 'Soul',                 region: 'USA',             color: '#38a3a5' },
  { id: 'r-n-b',         name: 'R&B',                  region: 'USA',             color: '#57cc99',},
  { id: 'hip-hop',       name: 'Hip-Hop',              region: 'USA',             color: '#80ed99' },
  { id: 'country',       name: 'Country',              region: 'USA',             color: '#c9ada7' },
  { id: 'bluegrass',     name: 'Bluegrass',            region: 'USA',             color: '#9a8c98' },
  { id: 'honky-tonk',    name: 'Honky-Tonk',           region: 'USA',             color: '#8d6e63' },
  { id: 'rockabilly',    name: 'Rockabilly',           region: 'USA',             color: '#795548' },
  { id: 'gospel',        name: 'Gospel',               region: 'USA',             color: '#fdcb6e' }, // alias OK
  { id: 'disco',         name: 'Disco',                region: 'USA',             color: '#f4845f' },
  { id: 'funk',          name: 'Funk',                 region: 'USA',             color: '#f48c06' },
  { id: 'pop',           name: 'Pop',                  region: 'Global',          color: '#ff7d00' },
  { id: 'rock',          name: 'Rock',                 region: 'Global',          color: '#6c757d' },
  { id: 'hard-rock',     name: 'Hard Rock',            region: 'Global',          color: '#495057' },
  { id: 'alt-rock',      name: 'Alt-Rock',             region: 'Global',          color: '#343a40' },
  { id: 'indie',         name: 'Indie',                region: 'Global',          color: '#ced4da' },
  { id: 'indie-pop',     name: 'Indie Pop',            region: 'Global',          color: '#dee2e6' },
  { id: 'singer-songwriter', name: 'Singer-Songwriter',region: 'Global',          color: '#adb5bd' },
  { id: 'folk',          name: 'Folk',                 region: 'Global',          color: '#b08968' },
  { id: 'edm',           name: 'EDM',                  region: 'Global',          color: '#00f5ff' },
  { id: 'electronic',    name: 'Electronic',           region: 'Global',          color: '#00bfff' },
  { id: 'electro',       name: 'Electro',              region: 'Global',          color: '#00aaff' },
  { id: 'house',         name: 'House',                region: 'Global',          color: '#0095ff' },
  { id: 'deep-house',    name: 'Deep House',           region: 'Global',          color: '#0077b6' },
  { id: 'techno',        name: 'Techno',               region: 'Germany',         color: '#003566' },
  { id: 'trance',        name: 'Trance',               region: 'Global',          color: '#001d3d' },
  { id: 'dubstep',       name: 'Dubstep',              region: 'UK',              color: '#000814' },
  { id: 'drum-and-bass', name: 'Drum & Bass',          region: 'UK',              color: '#3a0ca3' },
  { id: 'ambient',       name: 'Ambient',              region: 'Global',          color: '#d8e2dc' },
  { id: 'chill',         name: 'Chill',                region: 'Global',          color: '#cdb4db' },
  { id: 'piano',         name: 'Piano',                region: 'Global',          color: '#e0aaff' },
  { id: 'metal',         name: 'Metal',                region: 'Global',          color: '#212529' },
  { id: 'heavy-metal',   name: 'Heavy Metal',          region: 'Global',          color: '#1a1d20' },
  { id: 'death-metal',   name: 'Death Metal',          region: 'Global',          color: '#0d1117' },
  { id: 'black-metal',   name: 'Black Metal',          region: 'Norway',          color: '#161b22' },
  { id: 'metalcore',     name: 'Metalcore',            region: 'Global',          color: '#21262d' },
  { id: 'grunge',        name: 'Grunge',               region: 'USA',             color: '#30363d' },
  { id: 'punk',          name: 'Punk',                 region: 'UK',              color: '#bc3908' },
  { id: 'punk-rock',     name: 'Punk Rock',            region: 'UK',              color: '#9e2a0f' },
  { id: 'emo',           name: 'Emo',                  region: 'Global',          color: '#7b2cbf' },
  { id: 'world-music',   name: 'World Music',          region: 'Global',          color: '#f9c74f' },
];

// Track pool now lives in ./utils/tracksDatabase.js (curated 100-track baseline,
// each placed in Russell's circumplex with hand-set valence/energy). Imported
// as `sampleTracks` at the top of this file. Stage 3b will add a Spotify-features
// layer on top while keeping our 12 regional categories alive (see
// memory/earcandy_genre_taxonomy.md).

// Audio analysis utilities (the "physics layer" — autocorrelation pitch detection,
// frequency->note conversion, RMS loudness) live in ./utils/pitchDetection and are
// shared with the "How it works" visualizer so both show the same data.

// ============================================
// MAIN COMPONENT
// ============================================

export default function EarCandy() {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  // Refs for the 2D mood-grid drag interaction
  const moodGridRef = useRef(null);
  const [draggingMarker, setDraggingMarker] = useState(null); // 'current' | 'desired' | null

  const [audioBlob, setAudioBlob] = useState(null);
  const [pitchData, setPitchData] = useState([]);
  const [currentPitch, setCurrentPitch] = useState(null);
  const [currentNote, setCurrentNote] = useState(null);
  // Note: removed `selectedMood` label state — the affect-space marker
  // (moodPosition) is now the single source of truth. Preset buttons compute
  // their active style from nearestNamedMood(moodPosition).
  // 2D affect-space picker state. Default to a time-of-day-appropriate point so
  // the grid isn't blank on first visit. valence/energy both 0..1.
  const [moodPosition, setMoodPosition] = useState(() => {
    const hour = new Date().getHours();
    const d = getDefaultMoodForHour(hour);
    return { valence: d.valence, energy: d.energy };
  });
  // Journey mode: when on, recommendations interpolate from current → desired
  // mood across the playlist (mood-regulation arc, à la mood-repair theory).
  const [useJourney, setUseJourney] = useState(false);
  const [desiredMood, setDesiredMood] = useState({ valence: 0.8, energy: 0.7 });
  const [recommendations, setRecommendations] = useState([]);
  // Tracks the user has marked "less like this" / "skip" — excluded from future
  // picks until reset. Set, not array, for O(1) membership checks in the scorer.
  const [skippedTrackIds, setSkippedTrackIds] = useState(() => new Set());
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [activeTab, setActiveTab] = useState('record'); // record, mood, results, recognition
  const [detectedFeatures, setDetectedFeatures] = useState(null);
  const [quantizedNotes, setQuantizedNotes] = useState(null);
  const [songMatches, setSongMatches] = useState([]);
  const [isMatching, setIsMatching] = useState(false);
  const [auddMatches, setAuddMatches] = useState([]);
  const [isAuddSearching, setIsAuddSearching] = useState(false);
  const [auddError, setAuddError] = useState(null);

  // Refs for audio processing
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const chunksRef = useRef([]);
  const pitchDataRef = useRef([]);
  const isRecordingRef = useRef(false);
  const liveWaveCanvasRef = useRef(null);

  // Start recording
  const startRecording = async () => {
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      console.log('Microphone access granted, stream:', stream);
      streamRef.current = stream;
      
      // Set up audio context for real-time analysis
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      
      console.log('Audio context created, sample rate:', audioContextRef.current.sampleRate);
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Set up media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        console.log('MediaRecorder stopped');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        // Use ref data for analysis to avoid state timing issues
        // Small delay to ensure all pitch data is collected
        setTimeout(() => {
          analyzeRecording(blob, pitchDataRef.current);
        }, 100);
      };
      
      mediaRecorderRef.current.start(100);
      console.log('Recording started');
      setIsRecording(true);
      isRecordingRef.current = true;
      setPitchData([]);
      pitchDataRef.current = []; // Clear ref for new recording
      setAnalysisComplete(false);
      
      // Start real-time pitch detection
      detectPitchRealtime();
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please ensure you have granted permission.');
    }
  };

  // Real-time pitch detection during recording
  const detectPitchRealtime = () => {
    if (!analyserRef.current) {
      console.error('Analyser not initialized');
      return;
    }
    
    console.log('🎙️ Starting real-time pitch detection');
    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Float32Array(bufferLength);
    let pitchCount = 0;
    let lowSignalCount = 0;
    
    const detect = () => {
      // Continue detection while recording is active
      if (!isRecordingRef.current) {
        console.log(`🛑 Recording stopped. Pitch detections: ${pitchCount}, Low signal events: ${lowSignalCount}`);
        return;
      }
      
      try {
        analyserRef.current.getFloatTimeDomainData(dataArray);

        const rms = calculateRMS(dataArray);

        // Draw the real waveform (the actual signal, not a decorative animation)
        const waveCanvas = liveWaveCanvasRef.current;
        if (waveCanvas) {
          const ctx = waveCanvas.getContext('2d');
          const w = waveCanvas.width;
          const h = waveCanvas.height;
          const mid = h / 2;
          ctx.clearRect(0, 0, w, h);
          ctx.strokeStyle = colors.primary;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < dataArray.length; i++) {
            const x = (i / (dataArray.length - 1)) * w;
            const y = mid - dataArray[i] * mid * 0.92;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        
        // Log RMS periodically to debug signal levels
        if (pitchDataRef.current.length % 30 === 0) {
          console.log(`📊 RMS level: ${rms.toFixed(6)}, Pitch points so far: ${pitchDataRef.current.length}`);
        }
        
        // Try to detect pitch regardless of volume - let the algorithm decide if it's valid
        const pitch = detectPitch(dataArray, audioContextRef.current.sampleRate);
        if (pitch) {
          pitchCount++;
          setCurrentPitch(pitch);
          const note = frequencyToNote(pitch);
          setCurrentNote(note);
          const newPitchData = { time: Date.now(), pitch, note };
          pitchDataRef.current.push(newPitchData);
          setPitchData(prev => [...prev.slice(-100), newPitchData]);
          
          if (pitchCount <= 5) {
            console.log(`🎵 Pitch #${pitchCount}: ${pitch.toFixed(1)}Hz (${note.note}${note.octave}), RMS: ${rms.toFixed(6)}`);
          }
        } else {
          if (pitchDataRef.current.length > 0 && pitchDataRef.current.length % 30 === 0) {
            console.log(`  (no valid pitch detected in this frame, RMS: ${rms.toFixed(6)})`);
          }
        }
      } catch (e) {
        console.error('Error in pitch detection:', e);
      }
      
      animationRef.current = requestAnimationFrame(detect);
    };
    
    detect();
  };

  // Stop recording
  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  // Analyze the complete recording
  const analyzeRecording = async (blob, collectedPitchData) => {
    console.log('=== ANALYZE RECORDING START ===');
    console.log('Pitch data points collected:', collectedPitchData.length);
    console.log('First few pitch data points:', collectedPitchData.slice(0, 5));
    
    // Extract features from recorded pitch data
    if (collectedPitchData.length === 0) {
      console.warn('⚠️ No pitch data collected during recording!');
      setDetectedFeatures({
        avgPitch: 0,
        pitchRange: 0,
        dominantNote: 'N/A',
        estimatedTempo: 0,
        stability: 0
      });
      setAnalysisComplete(true);
      console.log('=== ANALYZE RECORDING END (NO DATA) ===');
      return;
    }
    
    const pitches = collectedPitchData.map(d => d.pitch).filter(p => p);
    console.log('Valid pitches extracted:', pitches.length);
    console.log('Pitch values range:', Math.min(...pitches), '-', Math.max(...pitches));
    
    const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const minPitch = Math.min(...pitches);
    const maxPitch = Math.max(...pitches);
    const pitchRange = maxPitch - minPitch;
    
    // Find most common note
    const noteCounts = {};
    collectedPitchData.forEach(d => {
      if (d.note) {
        const key = d.note.note;
        noteCounts[key] = (noteCounts[key] || 0) + 1;
      }
    });
    const dominantNote = Object.entries(noteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    
    // Estimate tempo from pitch changes (simplified)
    let changes = 0;
    for (let i = 1; i < collectedPitchData.length; i++) {
      if (Math.abs(collectedPitchData[i].pitch - collectedPitchData[i-1].pitch) > 20) {
        changes++;
      }
    }
    const durationSec = (collectedPitchData[collectedPitchData.length-1]?.time - collectedPitchData[0]?.time) / 1000 || 1;
    const estimatedTempo = Math.round((changes / durationSec) * 15); // Rough BPM estimate
    
    // Pitch stability (lower variance = more stable)
    const variance = pitches.reduce((sum, p) => sum + Math.pow(p - avgPitch, 2), 0) / pitches.length;
    const stability = Math.max(0, 100 - Math.sqrt(variance));
    
    const features = {
      avgPitch: Math.round(avgPitch),
      pitchRange: Math.round(pitchRange),
      dominantNote,
      estimatedTempo: Math.min(Math.max(estimatedTempo, 60), 200),
      stability: Math.round(stability)
    };
    
    console.log('✅ Analysis complete:', features);
    setDetectedFeatures(features);
    
    // Quantize pitch data into discrete notes. Thresholds auto-tune to the
    // active database: smaller DB -> longer min duration to suppress blips;
    // bigger DB -> shorter min duration to preserve discriminating detail.
    const { minNoteDurationMs, mode } = getThresholdsForDB(songDatabase);
    console.log(`⚙️  DB mode: ${mode} (${songDatabase.length} songs, ${minNoteDurationMs}ms min note)`);
    const notes = quantizePitchData(collectedPitchData, { windowMs: 150, minNoteDurationMs });
    console.log('📝 Quantized notes:', notes.map(n => n.note + n.octave));
    setQuantizedNotes(notes);
    
    setAnalysisComplete(true);
    console.log('=== ANALYZE RECORDING END (SUCCESS) ===');
  };

  // Recognize songs from hummed melody
  const recognizeSongs = useCallback(async () => {
    // Gate on DISTINCT notes — repeated same-pitch notes add no melodic information,
    // and short hums match too many songs to identify reliably.
    const distinctNotes = (quantizedNotes || []).filter(
      (n, i, arr) => i === 0 || `${n.note}${n.octave}` !== `${arr[i - 1].note}${arr[i - 1].octave}`
    ).length;
    const { minDistinctNotes } = getThresholdsForDB(songDatabase);
    if (distinctNotes < minDistinctNotes) {
      console.warn(`⚠️ Need at least ${minDistinctNotes} distinct notes (got ${distinctNotes})`);
      alert(`Please hum a longer phrase — at least ${minDistinctNotes} distinct notes. Short hums match too many songs to identify reliably.`);
      return;
    }

    setIsMatching(true);
    setAuddMatches([]);
    setAuddError(null);
    console.log('🔍 Starting song recognition...');
    console.log('Quantized notes:', quantizedNotes.map(n => `${n.note}${n.octave}(${n.duration}ms)`).join(' '));

    // Convert quantized notes to string format
    const noteStrings = quantizedNotes.map(n => n.note + n.octave);
    console.log('Notes to match:', noteStrings);

    // Match against the active database (demo OR full — same code path either way).
    const matches = matchMelody(noteStrings, songDatabase, {
      maxResults: 5,
      useTransposition: true,
    });

    console.log('🎵 Local matches:', matches);
    setSongMatches(matches);
    setActiveTab('recognition');
    setIsMatching(false);

    // Cloud fallback: when local matcher is uncertain (low top score or no clear
    // winner), send the recorded audio to AudD for a neural-fingerprint match
    // against ~80M songs. Runs the same way regardless of which local DB is loaded.
    if (audioBlob && shouldUseFallback(matches)) {
      setIsAuddSearching(true);
      try {
        const auddResults = await recognizeWithAudD(audioBlob);
        console.log('☁️  AudD matches:', auddResults);
        setAuddMatches(auddResults);
      } catch (err) {
        console.warn('AudD fallback failed:', err);
        setAuddError(err.message || 'Cloud search unavailable');
      } finally {
        setIsAuddSearching(false);
      }
    }
  }, [quantizedNotes, audioBlob]);

  // Score a single track against a (valence, energy) target. Pure, reusable —
  // called once for single-mood mode, six times (one per waypoint) for journey
  // mode. Returns the track decorated with score, proximity, and a reason string.
  const scoreTrackAgainstTarget = useCallback((track, tv, te, namedMatchId) => {
    const SQRT2 = Math.SQRT2;
    const dv = track.valence - tv;
    const den = track.energy - te;
    const distance = Math.sqrt(dv * dv + den * den);
    const proximity = 1 - distance / SQRT2;

    const proximityScore = proximity * 70;
    const labelMatch = namedMatchId && track.mood === namedMatchId ? 15 : 0;
    const variety = Math.random() * 15;
    const score = proximityScore + labelMatch + variety;

    // Build a human-readable reason — calibrated for the ~1,200-track dense pool.
    // Finer proximity tiers (5 instead of 3) and tighter delta thresholds (0.07
    // vs 0.15) so the descriptors stay varied even when the pool is rich enough
    // that most surfaced tracks have proximity > 0.85.
    const reasons = [];
    if (proximity > 0.97) reasons.push('almost exact match');
    else if (proximity > 0.93) reasons.push('strong mood fit');
    else if (proximity > 0.85) reasons.push('close to your mood');
    else if (proximity > 0.70) reasons.push('in the neighborhood');
    else reasons.push('related mood');

    if (labelMatch) reasons.push(`tagged ${namedMatchId}`);

    // Per-axis leans — tighter threshold so subtle leans get described.
    // Magnitude tiers ("nudges" vs "much" vs "noticeably") give richer wording.
    const dvAbs = Math.abs(dv);
    if (dvAbs > 0.20) reasons.push(dv > 0 ? 'much brighter' : 'much darker');
    else if (dvAbs > 0.10) reasons.push(dv > 0 ? 'a bit brighter' : 'a bit darker');
    else if (dvAbs > 0.05) reasons.push(dv > 0 ? 'nudges brighter' : 'nudges darker');

    const deAbs = Math.abs(den);
    if (deAbs > 0.20) reasons.push(den > 0 ? 'noticeably higher energy' : 'noticeably lower energy');
    else if (deAbs > 0.10) reasons.push(den > 0 ? 'higher energy' : 'lower energy');
    else if (deAbs > 0.05) reasons.push(den > 0 ? 'a touch livelier' : 'a touch mellower');

    // Quadrant flavour — describes the *kind* of affect when notable.
    // The four Russell quadrants each suggest a distinct feel.
    if (track.valence > 0.7 && track.energy > 0.7) reasons.push('upbeat / euphoric');
    else if (track.valence > 0.7 && track.energy < 0.4) reasons.push('peaceful / content');
    else if (track.valence < 0.4 && track.energy > 0.7) reasons.push('tense / anxious');
    else if (track.valence < 0.4 && track.energy < 0.4) reasons.push('reflective / wistful');

    return { ...track, score, distance, proximity, reason: reasons.join(' • ') };
  }, []);

  // Generate recommendations using affect-space proximity (Russell's circumplex).
  //
  // Single-mood mode: the marker is one point; score every track against it,
  //   pick the top 6 with light genre diversity.
  //
  // Journey mode: a path from currentMarker → desiredMarker. We sample 6
  //   waypoints along that path and pick the closest unused track to each.
  //   The playlist becomes a mood-regulation arc (Knobloch 2003, mood repair).
  const generateRecommendations = useCallback(() => {
    const tv = moodPosition.valence;
    const te = moodPosition.energy;
    const matchedNamed = nearestNamedMood(tv, te);
    const namedMatchId = matchedNamed.distance < 0.12 ? matchedNamed.mood.id : null;

    let selected;

    if (useJourney) {
      // Sample 6 waypoints along the (current → desired) line in affect-space.
      const playlistLen = 6;
      const usedIds = new Set();
      selected = [];
      for (let i = 0; i < playlistLen; i++) {
        const t = i / (playlistLen - 1);
        const wv = tv + (desiredMood.valence - tv) * t;
        const we = te + (desiredMood.energy - te) * t;
        // Score every remaining track against this waypoint, take the best.
        // Exclude both within-playlist duplicates AND tracks the user has skipped.
        const candidates = sampleTracks
          .filter(track => !usedIds.has(track.id) && !skippedTrackIds.has(track.id))
          .map(track => scoreTrackAgainstTarget(track, wv, we, namedMatchId))
          .sort((a, b) => b.score - a.score);
        if (candidates.length === 0) break;
        const pick = candidates[0];
        usedIds.add(pick.id);
        // Annotate the journey position so the UI can show 'step 1 of 6 →' etc.
        pick.journeyStep = i + 1;
        pick.journeyTotal = playlistLen;
        selected.push(pick);
      }
      console.log(`💭 Journey: (v=${tv.toFixed(2)},e=${te.toFixed(2)}) → (v=${desiredMood.valence.toFixed(2)},e=${desiredMood.energy.toFixed(2)})`);
    } else {
      // Single-mood mode: score all tracks against the one marker, take top 6
      // with light genre diversity. Skipped tracks are filtered out upstream.
      const scored = sampleTracks
        .filter(track => !skippedTrackIds.has(track.id))
        .map(track => scoreTrackAgainstTarget(track, tv, te, namedMatchId))
        .sort((a, b) => b.score - a.score);

      selected = [];
      const genreCounts = new Map();
      for (const track of scored) {
        if (selected.length >= 6) break;
        const count = genreCounts.get(track.genre) || 0;
        const enoughDiversity = genreCounts.size >= 4;
        if (count < 2 || enoughDiversity) {
          selected.push(track);
          genreCounts.set(track.genre, count + 1);
        }
      }
      console.log(`💭 Mood: (v=${tv.toFixed(2)}, e=${te.toFixed(2)}) ≈ ${matchedNamed.mood.label}`);
    }

    console.log('🎶 Recommendations:', selected.map(t => `${t.title} [prox=${t.proximity.toFixed(2)}]`));
    setRecommendations(selected);
    setActiveTab('results');
  }, [moodPosition, desiredMood, useJourney, skippedTrackIds, scoreTrackAgainstTarget]);

  // ─── Refinement controls (Stage 3c) ──────────────────────────────────────
  //
  // "More like this" pulls the marker 30% of the way toward the track's
  //   position in (valence, energy) space — partial nudge so a single click
  //   doesn't overshoot, and repeated clicks converge.
  // "Less like this" pushes the marker 20% in the opposite direction AND adds
  //   the track to the skip set so it can't resurface.
  // "Skip" just adds to the skip set without nudging the marker (useful when
  //   the marker is right but this specific track isn't).
  // After any of these, recommendations are regenerated automatically so the
  //   user sees the effect immediately.
  const nudgeMarkerToward = useCallback((track) => {
    setMoodPosition(prev => ({
      valence: Math.max(0, Math.min(1, prev.valence + (track.valence - prev.valence) * 0.30)),
      energy:  Math.max(0, Math.min(1, prev.energy  + (track.energy  - prev.energy)  * 0.30)),
    }));
  }, []);

  const nudgeMarkerAway = useCallback((track) => {
    setMoodPosition(prev => ({
      valence: Math.max(0, Math.min(1, prev.valence + (prev.valence - track.valence) * 0.20)),
      energy:  Math.max(0, Math.min(1, prev.energy  + (prev.energy  - track.energy)  * 0.20)),
    }));
    setSkippedTrackIds(prev => new Set(prev).add(track.id));
  }, []);

  const skipTrack = useCallback((track) => {
    setSkippedTrackIds(prev => new Set(prev).add(track.id));
  }, []);

  const clearSkipped = useCallback(() => setSkippedTrackIds(new Set()), []);

  // Auto-regenerate when the marker moves OR the skip set changes — but ONLY
  // if the user is already on the results tab (i.e. they've already discovered
  // once). This way nudge buttons feel instantaneous; first-time discover still
  // requires the explicit "Discover" click.
  useEffect(() => {
    if (activeTab !== 'results') return;
    generateRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moodPosition, desiredMood, skippedTrackIds]);

  // While a marker is being dragged, listen to window-level pointer events so
  // the drag keeps working even if the cursor briefly leaves the grid bounds.
  // Maps cursor position to (valence, energy) by reading the grid's rect.
  useEffect(() => {
    if (!draggingMarker) return;

    const handleMove = (e) => {
      if (!moodGridRef.current) return;
      const rect = moodGridRef.current.getBoundingClientRect();
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      if (cx == null) return;
      const valence = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
      const energy = Math.max(0, Math.min(1, 1 - (cy - rect.top) / rect.height));
      if (draggingMarker === 'current') setMoodPosition({ valence, energy });
      else if (draggingMarker === 'desired') setDesiredMood({ valence, energy });
    };
    const handleUp = () => setDraggingMarker(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggingMarker]);

  // Reset everything
  const reset = () => {
    setAudioBlob(null);
    setPitchData([]);
    pitchDataRef.current = [];
    setCurrentPitch(null);
    setCurrentNote(null);
    setRecommendations([]);
    setUseJourney(false);
    setSkippedTrackIds(new Set());
    setAnalysisComplete(false);
    setDetectedFeatures(null);
    setQuantizedNotes(null);
    setSongMatches([]);
    setActiveTab('record');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bgGradient,
      color: colors.text,
      fontFamily: "'Outfit', 'SF Pro Display', -apple-system, sans-serif",
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0
      }}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${300 + i * 100}px`,
              height: `${300 + i * 100}px`,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${colors.primary}10 0%, transparent 70%)`,
              top: `${20 + i * 15}%`,
              left: `${10 + i * 20}%`,
              animation: `float ${10 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Space+Mono&display=swap');
        
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        @keyframes recording {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.7); }
          50% { box-shadow: 0 0 0 20px rgba(255, 107, 107, 0); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes waveform {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
      `}</style>

      {/* Main content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '900px',
        margin: '0 auto',
        padding: '40px 20px'
      }}>
        {/* Header */}
        <header style={{
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: 700,
            margin: 0,
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent}, ${colors.secondary})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em'
          }}>
            🎵 EarCandy
          </h1>
          <p style={{
            color: colors.textMuted,
            fontSize: '1.1rem',
            marginTop: '8px',
            fontWeight: 300
          }}>
            Hear it. Hum it. Find it.
          </p>
          <p style={{
            color: colors.textMuted,
            fontSize: '0.85rem',
            marginTop: '4px',
            opacity: 0.7
          }}>
            Physics of Sound × Psychology • Global Music Discovery
          </p>
        </header>

        {/* Tab Navigation */}
        <nav style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '30px',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'record', label: '1. Record', icon: '🎤' },
            { id: 'recognition', label: '2. Recognize', icon: '🔍' },
            { id: 'mood', label: '3. Mood', icon: '💭' },
            { id: 'results', label: '4. Discover', icon: '🌍' },
            { id: 'howitworks', label: 'How it works', icon: '🔬' }
          ].map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'record' || (tab.id === 'recognition' && analysisComplete) || tab.id === 'mood' || (tab.id === 'results' && recommendations.length > 0) || tab.id === 'howitworks') {
                  setActiveTab(tab.id);
                }
              }}
              style={{
                padding: '12px 24px',
                borderRadius: '30px',
                border: 'none',
                background: activeTab === tab.id 
                  ? `linear-gradient(135deg, ${colors.primary}, ${colors.purple})` 
                  : colors.cardBg,
                color: activeTab === tab.id ? colors.text : colors.textMuted,
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: (tab.id === 'record' || tab.id === 'howitworks' || (tab.id === 'recognition' && analysisComplete) || (tab.id === 'mood' && analysisComplete) || (tab.id === 'results' && recommendations.length > 0)) ? 'pointer' : 'not-allowed',
                opacity: (tab.id === 'record' || tab.id === 'howitworks' || (tab.id === 'recognition' && analysisComplete) || (tab.id === 'mood' && analysisComplete) || (tab.id === 'results' && recommendations.length > 0)) ? 1 : 0.5,
                transition: 'all 0.3s ease',
                fontFamily: 'inherit'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>

        {/* Record Tab */}
        {activeTab === 'record' && (
          <div style={{ animation: 'slideUp 0.5s ease' }}>
            {/* Recording visualization */}
            <div style={{
              background: colors.cardBg,
              borderRadius: '24px',
              border: `1px solid ${colors.cardBorder}`,
              padding: '40px',
              marginBottom: '30px',
              textAlign: 'center'
            }}>
              {/* Pitch visualization */}
              <div style={{
                height: '200px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '16px',
                marginBottom: '30px',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: '2px',
                padding: '20px'
              }}>
                {isRecording ? (
                  <>
                    {/* Live waveform — the real time-domain signal from the mic */}
                    <canvas
                      ref={liveWaveCanvasRef}
                      width={600}
                      height={160}
                      style={{ width: '100%', height: '100%' }}
                    />
                    {/* Current note display */}
                    {currentNote && (
                      <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.7)',
                        padding: '10px 20px',
                        borderRadius: '10px'
                      }}>
                        <span style={{ fontSize: '2rem', fontWeight: 700 }}>{currentNote.note}</span>
                        <span style={{ fontSize: '1rem', color: colors.textMuted }}>{currentNote.octave}</span>
                        <div style={{ fontSize: '0.8rem', color: colors.textMuted }}>{currentNote.frequency} Hz</div>
                      </div>
                    )}
                  </>
                ) : pitchData.length > 0 ? (
                  // Show recorded pitch contour
                  <svg viewBox="0 0 400 160" style={{ width: '100%', height: '100%' }}>
                    <path
                      d={pitchData.slice(-100).map((d, i, arr) => {
                        const x = (i / arr.length) * 400;
                        const y = 160 - ((d.pitch - 100) / 400) * 160;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${Math.max(10, Math.min(150, y))}`;
                      }).join(' ')}
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: colors.textMuted
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎤</div>
                    <div>Hum, sing, or tap a rhythm</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '5px', opacity: 0.7 }}>
                      We'll analyze the physics of your sound
                    </div>
                  </div>
                )}
              </div>

              {/* Record button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  border: 'none',
                  background: isRecording 
                    ? `linear-gradient(135deg, ${colors.primary}, #ff4444)` 
                    : `linear-gradient(135deg, ${colors.primary}, ${colors.purple})`,
                  color: 'white',
                  fontSize: '2.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  animation: isRecording ? 'recording 1.5s ease-in-out infinite' : 'none',
                  boxShadow: isRecording 
                    ? `0 0 40px ${colors.primary}50` 
                    : `0 10px 40px rgba(0,0,0,0.3)`
                }}
              >
                {isRecording ? '⏹' : '🎙'}
              </button>
              
              <p style={{
                marginTop: '20px',
                color: colors.textMuted,
                fontSize: '0.9rem'
              }}>
                {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
              </p>
            </div>

            {/* Analysis results (shown after recording) */}
            {analysisComplete && detectedFeatures && (
              <div style={{
                background: colors.cardBg,
                borderRadius: '24px',
                border: `1px solid ${colors.cardBorder}`,
                padding: '30px',
                animation: 'slideUp 0.5s ease'
              }}>
                <h3 style={{ 
                  margin: '0 0 20px 0', 
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span>🔬</span> Physics Analysis
                </h3>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '15px'
                }}>
                  {[
                    { label: 'Avg. Frequency', value: `${detectedFeatures.avgPitch} Hz`, color: colors.primary },
                    { label: 'Pitch Range', value: `${detectedFeatures.pitchRange} Hz`, color: colors.secondary },
                    { label: 'Dominant Note', value: detectedFeatures.dominantNote, color: colors.accent },
                    { label: 'Est. Tempo', value: `~${detectedFeatures.estimatedTempo} BPM`, color: colors.purple },
                    { label: 'Pitch Stability', value: `${detectedFeatures.stability}%`, color: '#60a5fa' }
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '12px',
                      padding: '15px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '5px' }}>
                        {item.label}
                      </div>
                      <div style={{ 
                        color: item.color, 
                        fontSize: '1.3rem', 
                        fontWeight: 600,
                        fontFamily: "'Space Mono', monospace"
                      }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
                
                <p style={{
                  marginTop: '20px',
                  padding: '15px',
                  background: 'rgba(78, 205, 196, 0.1)',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  color: colors.textMuted,
                  lineHeight: 1.6
                }}>
                  <strong style={{ color: colors.secondary }}>Physics of Sound:</strong> We used Fourier analysis to decompose your audio into 
                  constituent frequencies, detected the fundamental pitch through autocorrelation, and mapped frequency patterns to 
                  musical notes using the equal temperament scale (A4 = 440 Hz).
                </p>
              </div>
            )}
          </div>
        )}

        {/* How It Works Tab */}
        {activeTab === 'howitworks' && (
          <HowItWorks colors={colors} />
        )}

        {/* Recognition Tab */}
        {activeTab === 'recognition' && (
          <div style={{ animation: 'slideUp 0.5s ease' }}>
            <div style={{
              background: colors.cardBg,
              borderRadius: '24px',
              border: `1px solid ${colors.cardBorder}`,
              padding: '40px',
              textAlign: 'center'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.5rem' }}>
                🔍 Recognize Your Melody
              </h3>
              <p style={{ color: colors.textMuted, marginBottom: '30px' }}>
                We'll search our database for songs matching your hummed melody
              </p>
              
              {quantizedNotes && (
                <div style={{
                  padding: '20px',
                  background: 'rgba(78, 205, 196, 0.1)',
                  borderRadius: '12px',
                  marginBottom: '30px'
                }}>
                  <div style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: '10px' }}>
                    <strong>Your melody:</strong>
                  </div>
                  <div style={{
                    fontFamily: "'Space Mono', monospace",
                    color: colors.secondary,
                    fontSize: '1.1rem',
                    wordBreak: 'break-word'
                  }}>
                    {quantizedNotes.map((n, i) => (
                      <span key={i} style={{ marginRight: '8px' }}>
                        {n.note}{n.octave}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <button
                onClick={recognizeSongs}
                disabled={!quantizedNotes || quantizedNotes.length === 0 || isMatching}
                style={{
                  padding: '15px 40px',
                  borderRadius: '30px',
                  border: 'none',
                  background: quantizedNotes && quantizedNotes.length > 0
                    ? `linear-gradient(135deg, ${colors.primary}, ${colors.purple})` 
                    : colors.cardBg,
                  color: quantizedNotes && quantizedNotes.length > 0 ? 'white' : colors.textMuted,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  cursor: quantizedNotes && quantizedNotes.length > 0 ? 'pointer' : 'not-allowed',
                  opacity: quantizedNotes && quantizedNotes.length > 0 ? 1 : 0.5,
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
              >
                {isMatching ? '🔄 Searching...' : '🎵 Find Matches'}
              </button>
            </div>

            {/* Matches Results */}
            {songMatches && songMatches.length > 0 && (
              <div style={{
                background: colors.cardBg,
                borderRadius: '24px',
                border: `1px solid ${colors.cardBorder}`,
                padding: '30px',
                marginTop: '20px',
                animation: 'slideUp 0.5s ease'
              }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', textAlign: 'center' }}>
                  🎵 Possible Matches
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {songMatches.map((match, i) => (
                    <div
                      key={match.songId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '15px 20px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '12px',
                        gap: '15px',
                        animation: 'slideUp 0.5s ease',
                        animationDelay: `${i * 0.1}s`,
                        animationFillMode: 'both'
                      }}
                    >
                      {/* Confidence indicator */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '60px'
                      }}>
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: match.confidence >= 70 ? colors.primary : match.confidence >= 40 ? colors.accent : colors.secondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '1.2rem',
                          fontWeight: 700
                        }}>
                          {match.confidence}%
                        </div>
                      </div>
                      
                      {/* Song info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: 600, 
                          marginBottom: '4px',
                          fontSize: '1.05rem'
                        }}>
                          {match.title}
                        </div>
                        <div style={{ 
                          color: colors.textMuted, 
                          fontSize: '0.85rem'
                        }}>
                          {match.artist}
                        </div>
                      </div>
                      
                      {/* Key info */}
                      {match.transposition !== 0 && (
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          background: `${colors.purple}30`,
                          color: colors.purple,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          whiteSpace: 'nowrap'
                        }}>
                          Key: {match.originalKey} {match.transposition > 0 ? '+' : ''}{match.transposition}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <p style={{
                  marginTop: '20px',
                  padding: '15px',
                  background: 'rgba(255,107,107,0.1)',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  color: colors.textMuted,
                  lineHeight: 1.6
                }}>
                  <strong style={{ color: colors.primary }}>How it works:</strong> We quantized your hummed melody into discrete notes, then compared it against a database using Dynamic Time Warping (DTW) to find the best matches. The algorithm is transposition-invariant, meaning it can recognize the same song even if you hum it in a different key.
                </p>
              </div>
            )}

            {/* AudD Cloud Fallback Results */}
            {(isAuddSearching || auddMatches.length > 0 || auddError) && (
              <div style={{
                background: colors.cardBg,
                borderRadius: '24px',
                border: `1px solid ${colors.cardBorder}`,
                padding: '30px',
                marginTop: '20px',
                animation: 'slideUp 0.5s ease'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', textAlign: 'center' }}>
                  ☁️ Cloud Backup Search (AudD)
                </h3>
                <p style={{
                  margin: '0 0 20px 0',
                  fontSize: '0.8rem',
                  color: colors.textMuted,
                  textAlign: 'center'
                }}>
                  Local match was uncertain — searched AudD's ~80M-song neural fingerprint database
                  {isSandboxToken() && ' (sandbox token — limited)'}
                </p>

                {isAuddSearching && (
                  <p style={{ textAlign: 'center', color: colors.textMuted }}>
                    🔄 Searching cloud database...
                  </p>
                )}

                {auddError && (
                  <p style={{
                    padding: '15px',
                    background: 'rgba(255,107,107,0.1)',
                    borderRadius: '12px',
                    color: colors.textMuted,
                    fontSize: '0.9rem'
                  }}>
                    ⚠️ {auddError}
                    {isSandboxToken() && (
                      <span> — set <code>VITE_AUDD_API_TOKEN</code> in <code>.env</code> for a real key.</span>
                    )}
                  </p>
                )}

                {auddMatches.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {auddMatches.map((match, i) => (
                      <div
                        key={`audd-${i}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '15px 20px',
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: '12px',
                          gap: '15px'
                        }}
                      >
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: colors.purple,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '1.0rem',
                          fontWeight: 700
                        }}>
                          {match.confidence}%
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '1.05rem' }}>
                            {match.title}
                          </div>
                          <div style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
                            {match.artist}
                          </div>
                        </div>
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          background: `${colors.purple}30`,
                          color: colors.purple,
                          fontSize: '0.7rem',
                          whiteSpace: 'nowrap'
                        }}>
                          ☁️ AudD
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isAuddSearching && auddMatches.length === 0 && !auddError && (
                  <p style={{ textAlign: 'center', color: colors.textMuted, fontSize: '0.9rem' }}>
                    No cloud matches found either.
                  </p>
                )}
              </div>
            )}

            {songMatches && songMatches.length === 0 && !isMatching && (
              <div style={{
                background: colors.cardBg,
                borderRadius: '24px',
                border: `1px solid ${colors.cardBorder}`,
                padding: '30px',
                marginTop: '20px',
                textAlign: 'center'
              }}>
                <p style={{ color: colors.textMuted }}>
                  No matches found. Try humming a more popular song, or check the database!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Mood Tab */}
        {activeTab === 'mood' && (() => {
          const hour = new Date().getHours();
          const timeDefault = getDefaultMoodForHour(hour);
          const closest = nearestNamedMood(moodPosition.valence, moodPosition.energy);
          const closestDesired = nearestNamedMood(desiredMood.valence, desiredMood.energy);
          return (
          <div style={{ animation: 'slideUp 0.5s ease' }}>
            <div style={{
              background: colors.cardBg,
              borderRadius: '24px',
              border: `1px solid ${colors.cardBorder}`,
              padding: '40px',
              textAlign: 'center'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.5rem' }}>
                How are you feeling?
              </h3>
              <p style={{ color: colors.textMuted, marginBottom: '20px' }}>
                Place yourself in affect-space — valence (sad ↔ happy) and energy (calm ↔ intense).
              </p>

              {/* Time-of-day banner */}
              <div style={{
                display: 'inline-block',
                padding: '8px 16px',
                borderRadius: '20px',
                background: 'rgba(96,165,250,0.12)',
                color: colors.accent,
                fontSize: '0.8rem',
                marginBottom: '24px'
              }}>
                🕐 {timeDefault.label} — defaulted you near “{nearestNamedMood(timeDefault.valence, timeDefault.energy).mood.label}”
              </div>

              {/* Mood preset row — clicking sets the current marker position */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                {moods.map(mood => {
                  const active = closest.mood.id === mood.id && closest.distance < 0.08;
                  return (
                    <button
                      key={mood.id}
                      onClick={() => setMoodPosition({ valence: mood.valence, energy: mood.energy })}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '20px',
                        border: active ? `2px solid ${mood.color}` : `1px solid ${colors.cardBorder}`,
                        background: active ? `${mood.color}22` : colors.cardBg,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: active ? mood.color : colors.text,
                        fontFamily: 'inherit'
                      }}
                    >
                      {mood.emoji} {mood.label}
                    </button>
                  );
                })}
              </div>

              {/* Journey-mode toggle */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: useJourney ? `${colors.purple}22` : colors.cardBg,
                  border: `1px solid ${useJourney ? colors.purple : colors.cardBorder}`,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}>
                  <input
                    type="checkbox"
                    checked={useJourney}
                    onChange={(e) => setUseJourney(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Journey mode — playlist as a path from where you are to where you want to be
                </label>
              </div>

              {/* The 2D affect-space grid */}
              <div
                ref={moodGridRef}
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '420px',
                  aspectRatio: '1 / 1',
                  margin: '0 auto 20px',
                  borderRadius: '16px',
                  background: `linear-gradient(135deg,
                    rgba(168,85,247,0.18) 0%,
                    rgba(255,107,107,0.18) 50%,
                    rgba(255,230,109,0.18) 100%)`,
                  border: `1px solid ${colors.cardBorder}`,
                  touchAction: 'none',
                  userSelect: 'none'
                }}
              >
                {/* Axis labels */}
                <div style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: colors.textMuted, writingMode: 'vertical-rl' }}>← calm    energy    intense →</div>
                <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', color: colors.textMuted }}>← sad    valence    happy →</div>

                {/* Named mood anchors */}
                {moods.map(mood => (
                  <div
                    key={mood.id}
                    style={{
                      position: 'absolute',
                      left: `${mood.valence * 100}%`,
                      bottom: `${mood.energy * 100}%`,
                      transform: 'translate(-50%, 50%)',
                      pointerEvents: 'none',
                      fontSize: '0.7rem',
                      color: mood.color,
                      opacity: 0.7,
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '1.1rem' }}>{mood.emoji}</div>
                    <div>{mood.label}</div>
                  </div>
                ))}

                {/* Path line for journey mode */}
                {useJourney && (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    <line
                      x1={`${moodPosition.valence * 100}%`}
                      y1={`${(1 - moodPosition.energy) * 100}%`}
                      x2={`${desiredMood.valence * 100}%`}
                      y2={`${(1 - desiredMood.energy) * 100}%`}
                      stroke={colors.purple}
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  </svg>
                )}

                {/* Current-mood marker (draggable) */}
                <div
                  onPointerDown={(e) => { e.preventDefault(); setDraggingMarker('current'); }}
                  style={{
                    position: 'absolute',
                    left: `${moodPosition.valence * 100}%`,
                    bottom: `${moodPosition.energy * 100}%`,
                    transform: 'translate(-50%, 50%)',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: colors.primary,
                    border: `3px solid white`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    cursor: draggingMarker === 'current' ? 'grabbing' : 'grab',
                    touchAction: 'none'
                  }}
                  title="Drag — this is where you are now"
                />

                {/* Desired-mood marker (only in journey mode, also draggable) */}
                {useJourney && (
                  <div
                    onPointerDown={(e) => { e.preventDefault(); setDraggingMarker('desired'); }}
                    style={{
                      position: 'absolute',
                      left: `${desiredMood.valence * 100}%`,
                      bottom: `${desiredMood.energy * 100}%`,
                      transform: 'translate(-50%, 50%)',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: colors.purple,
                      border: `3px solid white`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      cursor: draggingMarker === 'desired' ? 'grabbing' : 'grab',
                      touchAction: 'none'
                    }}
                    title="Drag — this is where you want to go"
                  />
                )}
              </div>

              {/* Live coordinate readout */}
              <div style={{
                padding: '14px',
                background: 'rgba(168,85,247,0.08)',
                borderRadius: '12px',
                marginBottom: '20px',
                fontSize: '0.85rem',
                color: colors.textMuted,
                lineHeight: 1.6
              }}>
                <strong style={{ color: colors.primary }}>You are here:</strong>
                {' '}{closest.mood.label.toLowerCase()} (v={moodPosition.valence.toFixed(2)}, e={moodPosition.energy.toFixed(2)})
                {useJourney && (
                  <>
                    {' → '}
                    <strong style={{ color: colors.purple }}>heading toward:</strong>
                    {' '}{closestDesired.mood.label.toLowerCase()} (v={desiredMood.valence.toFixed(2)}, e={desiredMood.energy.toFixed(2)})
                  </>
                )}
              </div>

              <button
                onClick={generateRecommendations}
                style={{
                  padding: '15px 40px',
                  borderRadius: '30px',
                  border: 'none',
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.purple})`,
                  color: 'white',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
              >
                🌍 Discover Global Music
              </button>

              {/* Mood-repair theory footnote — explains why "journey mode" exists */}
              <div style={{
                marginTop: '28px',
                padding: '18px 22px',
                background: 'rgba(168, 85, 247, 0.10)',
                borderLeft: `3px solid ${colors.purple}`,
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: colors.textMuted,
                lineHeight: 1.6,
                textAlign: 'left'
              }}>
                <strong style={{ color: colors.purple }}>Why "journey mode"?</strong>{' '}
                This is based on <em>mood-repair theory</em> (Knobloch 2003) — people
                don't just want music that <em>matches</em> their current mood, they
                want music that <em>moves them toward</em> a target mood.
              </div>
            </div>
          </div>
          );
        })()}

        {/* Results Tab */}
        {activeTab === 'results' && recommendations.length > 0 && (
          <div style={{ animation: 'slideUp 0.5s ease' }}>
            <div style={{
              background: colors.cardBg,
              borderRadius: '24px',
              border: `1px solid ${colors.cardBorder}`,
              padding: '30px',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', textAlign: 'center' }}>
                🎧 Your Global Playlist
              </h3>
              <p style={{ 
                textAlign: 'center', 
                color: colors.textMuted, 
                marginBottom: '25px',
                fontSize: '0.9rem'
              }}>
                {useJourney
                  ? `Journey: ${nearestNamedMood(moodPosition.valence, moodPosition.energy).mood.label.toLowerCase()} → ${nearestNamedMood(desiredMood.valence, desiredMood.energy).mood.label.toLowerCase()}`
                  : `Matched to your ${nearestNamedMood(moodPosition.valence, moodPosition.energy).mood.label.toLowerCase()} mood`}
              </p>

              {/* Skip-history indicator (Stage 3c). Only renders when at least
                  one track has been hidden; lets the user reset and refresh. */}
              {skippedTrackIds.size > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '8px 16px',
                  marginBottom: '20px',
                  borderRadius: '20px',
                  background: 'rgba(168,85,247,0.08)',
                  border: `1px solid ${colors.cardBorder}`,
                  fontSize: '0.8rem',
                  color: colors.textMuted
                }}>
                  ⊘ {skippedTrackIds.size} track{skippedTrackIds.size === 1 ? '' : 's'} hidden
                  <button
                    onClick={clearSkipped}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: colors.purple,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      textDecoration: 'underline',
                      padding: 0,
                      fontFamily: 'inherit'
                    }}
                  >
                    bring them back
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recommendations.map((track, i) => {
                  const genre = globalGenres.find(g => g.id === track.genre);
                  return (
                    <div
                      key={track.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '15px 20px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '12px',
                        gap: '15px',
                        animation: 'slideUp 0.5s ease',
                        animationDelay: `${i * 0.1}s`,
                        animationFillMode: 'both'
                      }}
                    >
                      {/* Genre color indicator with mood-match rating */}
                      <div style={{
                        position: 'relative',
                        width: '50px',
                        height: '50px',
                        borderRadius: '10px',
                        background: `linear-gradient(135deg, ${genre?.color || colors.primary}, ${genre?.color || colors.primary}80)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        flexShrink: 0
                      }}>
                        🎵
                        {/* Match-rating badge — % proximity in valence-energy space */}
                        {typeof track.proximity === 'number' && (
                          <div style={{
                            position: 'absolute',
                            bottom: '-6px',
                            right: '-6px',
                            minWidth: '28px',
                            height: '20px',
                            padding: '0 6px',
                            borderRadius: '10px',
                            background:
                              track.proximity > 0.85 ? colors.primary
                              : track.proximity > 0.65 ? colors.accent
                              : colors.purple,
                            color: 'white',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `2px solid ${colors.bg}`,
                            lineHeight: 1
                          }}>
                            {Math.round(track.proximity * 100)}
                          </div>
                        )}
                      </div>
                      
                      {/* Track info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600,
                          marginBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {track.title}
                        </div>
                        <div style={{
                          color: colors.textMuted,
                          fontSize: '0.85rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {track.artist}
                        </div>
                        {track.reason && (
                          <div style={{
                            color: colors.purple,
                            fontSize: '0.72rem',
                            marginTop: '4px',
                            fontStyle: 'italic',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {track.reason}
                          </div>
                        )}
                      </div>
                      
                      {/* Genre tag */}
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: `${genre?.color || colors.primary}30`,
                        color: genre?.color || colors.primary,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        whiteSpace: 'nowrap'
                      }}>
                        {/* Genre + Region. Genre name is always shown so tracks
                            like Pink Floyd read "Psych Rock" instead of just
                            "Global"; region is appended only when we have it. */}
                        {genre
                          ? `${genre.name} • ${genre.region}`
                          : formatGenreId(track.genre)}
                      </div>

                      {/* BPM */}
                      <div style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: '0.8rem',
                        color: colors.textMuted,
                        whiteSpace: 'nowrap'
                      }}>
                        {track.bpm} BPM
                      </div>

                      {/* Refinement controls (Stage 3c) — three small icon
                          buttons. Hovering each one explains what it does. */}
                      <div style={{ display: 'flex', gap: '6px', marginLeft: '6px' }}>
                        <button
                          onClick={() => nudgeMarkerToward(track)}
                          title="More like this — pull mood toward this track"
                          style={{
                            width: '32px', height: '32px',
                            borderRadius: '50%',
                            border: `1px solid ${colors.cardBorder}`,
                            background: 'rgba(255,107,107,0.08)',
                            color: colors.primary,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >❤</button>
                        <button
                          onClick={() => nudgeMarkerAway(track)}
                          title="Less like this — push mood away and hide this track"
                          style={{
                            width: '32px', height: '32px',
                            borderRadius: '50%',
                            border: `1px solid ${colors.cardBorder}`,
                            background: 'rgba(168,85,247,0.08)',
                            color: colors.purple,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >👎</button>
                        <button
                          onClick={() => skipTrack(track)}
                          title="Skip — hide this track without moving your mood"
                          style={{
                            width: '32px', height: '32px',
                            borderRadius: '50%',
                            border: `1px solid ${colors.cardBorder}`,
                            background: 'rgba(120,120,120,0.08)',
                            color: colors.textMuted,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >⊘</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explanation card */}
            <div style={{
              background: colors.cardBg,
              borderRadius: '24px',
              border: `1px solid ${colors.cardBorder}`,
              padding: '25px'
            }}>
              <h4 style={{ margin: '0 0 15px 0', fontSize: '1rem' }}>
                🔍 Why These Recommendations?
              </h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '15px',
                fontSize: '0.85rem',
                color: colors.textMuted,
                lineHeight: 1.6
              }}>
                <div style={{ 
                  padding: '15px', 
                  background: 'rgba(255,107,107,0.1)', 
                  borderRadius: '12px' 
                }}>
                  <strong style={{ color: colors.primary }}>How these are picked:</strong><br/>
                  Tracks are selected to match the mood you chose. Your melody's detected
                  features (shown on the Record tab) aren't used for these picks yet.
                </div>
                <div style={{ 
                  padding: '15px', 
                  background: 'rgba(168,85,247,0.1)', 
                  borderRadius: '12px' 
                }}>
                  <strong style={{ color: colors.purple }}>Psychology Match:</strong><br/>
                  Scored by Euclidean proximity in Russell's circumplex —
                  your point ({moodPosition.valence.toFixed(2)}, {moodPosition.energy.toFixed(2)})
                  {useJourney && (
                    <> → ({desiredMood.valence.toFixed(2)}, {desiredMood.energy.toFixed(2)})</>
                  )}
                  {' '}in (valence, energy) space.
                </div>
              </div>
              <div style={{ 
                marginTop: '15px',
                padding: '15px', 
                background: 'rgba(78,205,196,0.1)', 
                borderRadius: '12px',
                fontSize: '0.85rem',
                color: colors.textMuted
              }}>
                <strong style={{ color: colors.secondary }}>Global Diversity:</strong> Recommendations 
                span {new Set(recommendations.map(r => globalGenres.find(g => g.id === r.genre)?.region)).size} regions 
                to expose you to musical traditions beyond typical Western-centric algorithms.
              </div>
            </div>

            {/* Reset button */}
            <div style={{ textAlign: 'center', marginTop: '30px' }}>
              <button
                onClick={reset}
                style={{
                  padding: '12px 30px',
                  borderRadius: '30px',
                  border: `1px solid ${colors.cardBorder}`,
                  background: 'transparent',
                  color: colors.textMuted,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
              >
                ↺ Start Over
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={{
          textAlign: 'center',
          marginTop: '50px',
          padding: '20px',
          color: colors.textMuted,
          fontSize: '0.8rem'
        }}>
          <div style={{ marginBottom: '10px' }}>
            <strong>EarCandy</strong> • A Vikram Project
          </div>
          <div style={{ opacity: 0.7 }}>
            Bridging Physics of Sound & Psychology through Music Technology
          </div>
          <div style={{ 
            marginTop: '15px', 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '20px',
            flexWrap: 'wrap'
          }}>
            {globalGenres.slice(0, 6).map(genre => (
              <span key={genre.id} style={{ 
                color: genre.color,
                fontSize: '0.7rem'
              }}>
                {genre.name}
              </span>
            ))}
            <span style={{ opacity: 0.5 }}>+{globalGenres.length - 6} more</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

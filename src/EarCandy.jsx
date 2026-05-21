import React, { useState, useRef, useEffect, useCallback } from 'react';
import { quantizePitchData, noteSequenceToString } from './utils/melodyQuantizer';
import { matchMelody } from './utils/matchingEngine';
import { songDatabase } from './utils/songDatabase';

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

// Global genre database representing diverse musical traditions
const globalGenres = [
  { id: 'carnatic', name: 'Carnatic Classical', region: 'South India', color: '#ff9f43' },
  { id: 'hindustani', name: 'Hindustani Classical', region: 'North India', color: '#ee5a24' },
  { id: 'finnish_metal', name: 'Finnish Death Metal', region: 'Finland', color: '#2d3436' },
  { id: 'reggaeton', name: 'Reggaetón', region: 'Puerto Rico', color: '#00b894' },
  { id: 'gospel', name: 'Gospel', region: 'USA', color: '#fdcb6e' },
  { id: 'kpop', name: 'K-Pop', region: 'South Korea', color: '#fd79a8' },
  { id: 'afrobeat', name: 'Afrobeat', region: 'West Africa', color: '#e17055' },
  { id: 'bossa_nova', name: 'Bossa Nova', region: 'Brazil', color: '#74b9ff' },
  { id: 'flamenco', name: 'Flamenco', region: 'Spain', color: '#d63031' },
  { id: 'jpop', name: 'J-Pop', region: 'Japan', color: '#ff7675' },
  { id: 'qawwali', name: 'Qawwali', region: 'Pakistan', color: '#a29bfe' },
  { id: 'american_rock', name: 'American Rock', region: 'USA', color: '#636e72' },
];

// Sample recommendation database (in production, this would be much larger)
const sampleTracks = [
  { id: 1, title: 'Thillana in Dhanashree', artist: 'Balamuralikrishna', genre: 'carnatic', bpm: 120, key: 'D', mood: 'energetic' },
  { id: 2, title: 'Raag Yaman Alap', artist: 'Hariprasad Chaurasia', genre: 'hindustani', bpm: 60, key: 'E', mood: 'calm' },
  { id: 3, title: 'Children of Bodom', artist: 'Hate Crew Deathroll', genre: 'finnish_metal', bpm: 180, key: 'Em', mood: 'energetic' },
  { id: 4, title: 'Despacito', artist: 'Luis Fonsi', genre: 'reggaeton', bpm: 89, key: 'Bm', mood: 'happy' },
  { id: 5, title: 'Oh Happy Day', artist: 'Edwin Hawkins', genre: 'gospel', bpm: 115, key: 'F', mood: 'happy' },
  { id: 6, title: 'Dynamite', artist: 'BTS', genre: 'kpop', bpm: 114, key: 'C#m', mood: 'energetic' },
  { id: 7, title: 'Water No Get Enemy', artist: 'Fela Kuti', genre: 'afrobeat', bpm: 105, key: 'Em', mood: 'energetic' },
  { id: 8, title: 'The Girl from Ipanema', artist: 'João Gilberto', genre: 'bossa_nova', bpm: 72, key: 'F', mood: 'calm' },
  { id: 9, title: 'Entre dos Aguas', artist: 'Paco de Lucía', genre: 'flamenco', bpm: 95, key: 'Am', mood: 'romantic' },
  { id: 10, title: 'First Love', artist: 'Hikaru Utada', genre: 'jpop', bpm: 78, key: 'Db', mood: 'melancholic' },
  { id: 11, title: 'Tumhe Dillagi', artist: 'Nusrat Fateh Ali Khan', genre: 'qawwali', bpm: 85, key: 'Gm', mood: 'romantic' },
  { id: 12, title: 'Hotel California', artist: 'Eagles', genre: 'american_rock', bpm: 75, key: 'Bm', mood: 'melancholic' },
];

// ============================================
// AUDIO ANALYSIS UTILITIES (Physics Layer)
// ============================================

// Attempt to detect fundamental pitch from audio data using FFT-based detection
function detectPitch(audioData, sampleRate) {
  // Simple FFT-like approach: find dominant frequency using power spectrum
  const bufferSize = audioData.length;
  
  // Find peak amplitude
  let max = 0;
  for (let i = 0; i < bufferSize; i++) {
    max = Math.max(max, Math.abs(audioData[i]));
  }
  
  if (max < 0.001) return null; // Too silent
  
  // Apply Hamming window to reduce spectral leakage
  const windowed = new Float32Array(bufferSize);
  for (let i = 0; i < bufferSize; i++) {
    const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (bufferSize - 1));
    windowed[i] = audioData[i] * window;
  }
  
  // Simple energy-based pitch detection using autocorrelation
  // but with better normalization
  const correlations = new Float32Array(bufferSize);
  
  for (let lag = 1; lag < bufferSize; lag++) {
    let sum = 0;
    let sum1 = 0;
    let sum2 = 0;
    
    for (let i = 0; i < bufferSize - lag; i++) {
      sum += windowed[i] * windowed[i + lag];
      sum1 += windowed[i] * windowed[i];
      sum2 += windowed[i + lag] * windowed[i + lag];
    }
    
    // Normalized cross-correlation
    if (sum1 * sum2 > 0) {
      correlations[lag] = sum / Math.sqrt(sum1 * sum2);
    }
  }
  
  // Find the best period (lag with highest correlation after first dip)
  // Range 80-400 Hz: rejects AC mains hum (60 Hz) and sub-bass noise,
  // while still covering every realistic human humming voice (bass-baritone to soprano)
  let minLag = Math.floor(sampleRate / 400);  // Max freq ~400Hz
  let maxLag = Math.floor(sampleRate / 80);   // Min freq ~80Hz
  
  let bestLag = 0;
  let bestValue = -1;
  
  for (let lag = minLag; lag < Math.min(maxLag, bufferSize); lag++) {
    if (correlations[lag] > bestValue) {
      bestValue = correlations[lag];
      bestLag = lag;
    }
  }
  
  // Only accept if correlation is strong enough
  if (bestLag > 0 && bestValue > 0.5) {
    const frequency = sampleRate / bestLag;
    
    if (frequency >= 80 && frequency <= 400) {
      return frequency;
    }
  }
  
  return null;
}

// Convert frequency to musical note
function frequencyToNote(frequency) {
  if (!frequency || frequency <= 0) return null;
  
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const A4 = 440;
  const semitones = 12 * Math.log2(frequency / A4);
  const semitonesFromC0 = Math.round(semitones) + 57; // A4 is 57 semitones above C0
  const octave = Math.floor(semitonesFromC0 / 12);
  const noteName = noteNames[((semitonesFromC0 % 12) + 12) % 12];
  
  return { note: noteName, octave, frequency: Math.round(frequency) };
}

// Calculate RMS amplitude (volume level)
function calculateRMS(audioData) {
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  return Math.sqrt(sum / audioData.length);
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function EarCandy() {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [pitchData, setPitchData] = useState([]);
  const [currentPitch, setCurrentPitch] = useState(null);
  const [currentNote, setCurrentNote] = useState(null);
  const [selectedMood, setSelectedMood] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [activeTab, setActiveTab] = useState('record'); // record, mood, results, recognition
  const [detectedFeatures, setDetectedFeatures] = useState(null);
  const [quantizedNotes, setQuantizedNotes] = useState(null);
  const [songMatches, setSongMatches] = useState([]);
  const [isMatching, setIsMatching] = useState(false);

  // Refs for audio processing
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const chunksRef = useRef([]);
  const pitchDataRef = useRef([]);
  const isRecordingRef = useRef(false);

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
        setVolumeLevel(Math.min(rms * 10, 1));
        
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
    
    // Quantize pitch data into discrete notes
    const notes = quantizePitchData(collectedPitchData, { windowMs: 150, minNoteDurationMs: 80 });
    console.log('📝 Quantized notes:', notes.map(n => n.note + n.octave));
    setQuantizedNotes(notes);
    
    setAnalysisComplete(true);
    console.log('=== ANALYZE RECORDING END (SUCCESS) ===');
  };

  // Recognize songs from hummed melody
  const recognizeSongs = useCallback(() => {
    if (!quantizedNotes || quantizedNotes.length < 3) {
      console.warn('⚠️ Need at least 3 notes for recognition');
      alert('Please hum at least 3-4 notes for better recognition');
      return;
    }
    
    setIsMatching(true);
    console.log('🔍 Starting song recognition...');
    console.log('Quantized notes:', quantizedNotes.map(n => `${n.note}${n.octave}(${n.duration}ms)`).join(' '));
    
    // Convert quantized notes to string format
    const noteStrings = quantizedNotes.map(n => n.note + n.octave);
    console.log('Notes to match:', noteStrings);
    
    // Match against database with very lenient settings
    const matches = matchMelody(noteStrings, songDatabase, {
      maxResults: 5,
      useTransposition: true,
    });
    
    console.log('🎵 Found matches:', matches);
    setSongMatches(matches);
    setActiveTab('recognition');
    setIsMatching(false);
  }, [quantizedNotes]);

  // Generate recommendations based on analysis and mood
  const generateRecommendations = useCallback(() => {
    if (!selectedMood) return;

    // Score each track based purely on mood
    const scored = sampleTracks.map(track => {
      let score = 0;

      if (track.mood === selectedMood) score += 50;

      // Add some randomness for variety
      score += Math.random() * 20;

      return { ...track, score };
    });
    
    // Sort by score and take top results, ensuring genre diversity
    scored.sort((a, b) => b.score - a.score);
    
    // Select diverse recommendations
    const selected = [];
    const usedGenres = new Set();
    
    for (const track of scored) {
      if (selected.length >= 6) break;
      if (!usedGenres.has(track.genre) || selected.length >= 4) {
        selected.push(track);
        usedGenres.add(track.genre);
      }
    }
    
    setRecommendations(selected);
    setActiveTab('results');
  }, [selectedMood]);

  // Reset everything
  const reset = () => {
    setAudioBlob(null);
    setPitchData([]);
    pitchDataRef.current = [];
    setCurrentPitch(null);
    setCurrentNote(null);
    setSelectedMood(null);
    setRecommendations([]);
    setAnalysisComplete(false);
    setVolumeLevel(0);
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
            { id: 'results', label: '4. Discover', icon: '🌍' }
          ].map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'record' || (tab.id === 'recognition' && analysisComplete) || tab.id === 'mood' || (tab.id === 'results' && recommendations.length > 0)) {
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
                cursor: (tab.id === 'record' || (tab.id === 'recognition' && analysisComplete) || (tab.id === 'mood' && analysisComplete) || (tab.id === 'results' && recommendations.length > 0)) ? 'pointer' : 'not-allowed',
                opacity: (tab.id === 'record' || (tab.id === 'recognition' && analysisComplete) || (tab.id === 'mood' && analysisComplete) || (tab.id === 'results' && recommendations.length > 0)) ? 1 : 0.5,
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
                    {/* Live waveform visualization */}
                    {[...Array(40)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: '6px',
                          height: `${20 + Math.random() * volumeLevel * 150}px`,
                          background: `linear-gradient(to top, ${colors.primary}, ${colors.accent})`,
                          borderRadius: '3px',
                          animation: `waveform ${0.3 + Math.random() * 0.3}s ease-in-out infinite`,
                          animationDelay: `${i * 0.02}s`
                        }}
                      />
                    ))}
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
        {activeTab === 'mood' && (
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
              <p style={{ color: colors.textMuted, marginBottom: '30px' }}>
                Your mood helps us understand what music might resonate with you
              </p>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '15px',
                maxWidth: '500px',
                margin: '0 auto 30px'
              }}>
                {moods.map(mood => (
                  <button
                    key={mood.id}
                    onClick={() => setSelectedMood(mood.id)}
                    style={{
                      padding: '20px 15px',
                      borderRadius: '16px',
                      border: selectedMood === mood.id 
                        ? `2px solid ${mood.color}` 
                        : `1px solid ${colors.cardBorder}`,
                      background: selectedMood === mood.id 
                        ? `${mood.color}20` 
                        : colors.cardBg,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      transform: selectedMood === mood.id ? 'scale(1.05)' : 'scale(1)'
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{mood.emoji}</div>
                    <div style={{ 
                      color: selectedMood === mood.id ? mood.color : colors.text,
                      fontWeight: 500
                    }}>
                      {mood.label}
                    </div>
                  </button>
                ))}
              </div>

              {selectedMood && (
                <div style={{
                  padding: '20px',
                  background: 'rgba(168, 85, 247, 0.1)',
                  borderRadius: '12px',
                  marginBottom: '30px',
                  fontSize: '0.85rem',
                  color: colors.textMuted,
                  lineHeight: 1.6
                }}>
                  <strong style={{ color: colors.purple }}>Psychology Layer:</strong> Mood affects music perception through 
                  the dimensional model of affect (valence × arousal). Your "{moods.find(m => m.id === selectedMood)?.label}" mood 
                  suggests preferences for music with {moods.find(m => m.id === selectedMood)?.energy > 0.5 ? 'higher' : 'lower'} energy 
                  and {moods.find(m => m.id === selectedMood)?.valence > 0.5 ? 'positive' : 'introspective'} emotional tone.
                </div>
              )}
              
              <button
                onClick={generateRecommendations}
                disabled={!selectedMood}
                style={{
                  padding: '15px 40px',
                  borderRadius: '30px',
                  border: 'none',
                  background: selectedMood 
                    ? `linear-gradient(135deg, ${colors.primary}, ${colors.purple})` 
                    : colors.cardBg,
                  color: selectedMood ? 'white' : colors.textMuted,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  cursor: selectedMood ? 'pointer' : 'not-allowed',
                  opacity: selectedMood ? 1 : 0.5,
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
              >
                🌍 Discover Global Music
              </button>
            </div>
          </div>
        )}

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
                Based on your melody ({detectedFeatures?.dominantNote} @ ~{detectedFeatures?.estimatedTempo} BPM) 
                and {moods.find(m => m.id === selectedMood)?.label.toLowerCase()} mood
              </p>
              
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
                      {/* Genre color indicator */}
                      <div style={{
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
                        {genre?.region || 'Global'}
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
                  <strong style={{ color: colors.primary }}>Physics Match:</strong><br/>
                  Tracks selected based on tempo similarity (~{detectedFeatures?.estimatedTempo} BPM) 
                  and compatible key signatures with your {detectedFeatures?.dominantNote} melody.
                </div>
                <div style={{ 
                  padding: '15px', 
                  background: 'rgba(168,85,247,0.1)', 
                  borderRadius: '12px' 
                }}>
                  <strong style={{ color: colors.purple }}>Psychology Match:</strong><br/>
                  Filtered for {moods.find(m => m.id === selectedMood)?.label.toLowerCase()} mood 
                  using valence ({moods.find(m => m.id === selectedMood)?.valence}) and 
                  energy ({moods.find(m => m.id === selectedMood)?.energy}) dimensions.
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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  analyzePitchFrame,
  frequencyToNote,
  centsFromNearestNote,
  MIN_FREQ,
  MAX_FREQ,
} from '../utils/pitchDetection';

/**
 * "How it works" — a live, interactive view of the real signal-processing pipeline.
 *
 * It renders the SAME data the matcher uses (via analyzePitchFrame), in four linked
 * panels, so the audience sees the physics happen instead of hearing it described:
 *   1. Waveform   (time domain)      — amplitude vs frequency, made visually distinct
 *   2. Spectrum   (frequency domain) — the fundamental and its overtones
 *   3. Autocorrelation               — how the fundamental period is actually found
 *   4. Note + ±50-cent window        — how a frequency becomes a quantized note
 *
 * Source can be the live microphone OR a built-in test tone (so the demo works even
 * with no mic / denied permission). Freeze holds a frame so you can narrate it.
 */

const FFT_SIZE = 2048;
const SPECTRUM_MAX_HZ = 2200; // how far up the spectrum panel plots
const CANVAS_W = 1000;
const CANVAS_H = 170;

// ---- pure canvas drawing helpers -------------------------------------------

function clear(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawWaveform(canvas, timeData, frame, colors) {
  const ctx = canvas.getContext('2d');
  clear(ctx);
  const mid = CANVAS_H / 2;

  // center line
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(CANVAS_W, mid);
  ctx.stroke();

  // the waveform itself
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const n = timeData.length;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * CANVAS_W;
    const y = mid - timeData[i] * mid * 0.92;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // overlay: one period (only when we detected a pitch)
  if (frame && frame.bestLag > 0 && frame.frequency) {
    const periodPx = (frame.bestLag / n) * CANVAS_W;
    const x0 = 24;
    const x1 = x0 + periodPx;
    const yb = 22;
    ctx.strokeStyle = colors.accent;
    ctx.fillStyle = colors.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, yb - 6);
    ctx.lineTo(x0, yb + 6);
    ctx.moveTo(x0, yb);
    ctx.lineTo(x1, yb);
    ctx.moveTo(x1, yb - 6);
    ctx.lineTo(x1, yb + 6);
    ctx.stroke();
    const periodMs = (frame.bestLag / frame.sampleRate) * 1000;
    ctx.font = '12px monospace';
    ctx.fillText(`1 cycle = ${periodMs.toFixed(1)} ms  →  ${Math.round(frame.frequency)} Hz`, x1 + 8, yb + 4);
  }

  // amplitude readout (top-right) — explicitly labelled as amplitude, not frequency
  if (frame) {
    ctx.fillStyle = colors.textMuted;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`peak amplitude ${frame.peakAmplitude.toFixed(2)}`, CANVAS_W - 12, 18);
    ctx.textAlign = 'left';
  }
}

function drawSpectrum(canvas, freqData, sampleRate, fundamental, colors) {
  const ctx = canvas.getContext('2d');
  clear(ctx);
  const binHz = sampleRate / (freqData.length * 2);
  const binsToShow = Math.min(freqData.length, Math.ceil(SPECTRUM_MAX_HZ / binHz));
  const barW = CANVAS_W / binsToShow;

  // bars
  for (let i = 0; i < binsToShow; i++) {
    const h = (freqData[i] / 255) * (CANVAS_H - 24);
    const x = i * barW;
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(x, CANVAS_H - h, Math.max(1, barW - 0.5), h);
  }

  const hzToX = (hz) => (hz / SPECTRUM_MAX_HZ) * CANVAS_W;

  // frequency ticks
  ctx.fillStyle = colors.textMuted;
  ctx.font = '10px monospace';
  for (let hz = 0; hz <= SPECTRUM_MAX_HZ; hz += 500) {
    const x = hzToX(hz);
    ctx.fillText(`${hz}`, x + 2, CANVAS_H - 4);
  }

  // mark fundamental + harmonics (overtones)
  if (fundamental) {
    for (let k = 1; k * fundamental <= SPECTRUM_MAX_HZ && k <= 8; k++) {
      const x = hzToX(k * fundamental);
      ctx.strokeStyle = k === 1 ? colors.accent : colors.purple;
      ctx.lineWidth = k === 1 ? 2 : 1;
      ctx.setLineDash(k === 1 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x, CANVAS_H - 16);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = k === 1 ? colors.accent : colors.purple;
      ctx.font = '11px monospace';
      ctx.fillText(k === 1 ? 'fundamental' : `×${k}`, x + 3, 16);
    }
  }
}

function drawAutocorrelation(canvas, frame, colors) {
  const ctx = canvas.getContext('2d');
  clear(ctx);
  const mid = CANVAS_H / 2;

  if (!frame) return;
  const { correlations, minLag, maxLag, bestLag, sampleRate, frequency } = frame;
  const span = Math.max(1, maxLag - minLag);
  const lagToX = (lag) => ((lag - minLag) / span) * CANVAS_W;

  // zero line
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(CANVAS_W, mid);
  ctx.stroke();

  // correlation curve across the human-humming lag range
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let lag = minLag; lag <= maxLag && lag < correlations.length; lag++) {
    const x = lagToX(lag);
    const y = mid - correlations[lag] * mid * 0.9;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // mark the winning lag (the detected period)
  if (bestLag > 0 && frequency) {
    const x = lagToX(bestLag);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, CANVAS_H - 8);
    ctx.stroke();
    ctx.fillStyle = colors.accent;
    ctx.font = '12px monospace';
    const periodMs = (bestLag / sampleRate) * 1000;
    const label = `best lag ${bestLag} (${periodMs.toFixed(1)} ms → ${Math.round(frequency)} Hz)`;
    const tx = Math.min(x + 8, CANVAS_W - 250);
    ctx.fillText(label, tx, 18);
  }

  // axis labels
  ctx.fillStyle = colors.textMuted;
  ctx.font = '10px monospace';
  ctx.fillText(`${MAX_FREQ} Hz`, 2, CANVAS_H - 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${MIN_FREQ} Hz`, CANVAS_W - 2, CANVAS_H - 4);
  ctx.textAlign = 'left';
}

// ---- panel wrapper ----------------------------------------------------------

function Panel({ title, caption, colors, children }) {
  return (
    <div
      style={{
        background: colors.cardBg,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: '16px',
        padding: '16px 18px',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '6px', color: colors.text }}>{title}</div>
      {children}
      <div style={{ fontSize: '0.78rem', color: colors.textMuted, marginTop: '8px', lineHeight: 1.4 }}>
        {caption}
      </div>
    </div>
  );
}

// ---- main component ---------------------------------------------------------

export default function HowItWorks({ colors }) {
  const [mode, setMode] = useState(null); // null | 'mic' | 'tone'
  const [frozen, setFrozen] = useState(false);
  const [toneFreq, setToneFreq] = useState(220);
  const [toneGain, setToneGain] = useState(0.3);
  const [error, setError] = useState(null);
  const [readout, setReadout] = useState(null); // { note, octave, freq, cents, strength, amplitude }

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const oscRef = useRef(null);
  const gainRef = useRef(null);
  const rafRef = useRef(null);
  const runningRef = useRef(false);
  const frozenRef = useRef(false);
  const timeDataRef = useRef(null);
  const freqDataRef = useRef(null);
  const frameRef = useRef(null);
  const frameCountRef = useRef(0);

  const waveCanvasRef = useRef(null);
  const spectrumCanvasRef = useRef(null);
  const autocorrCanvasRef = useRef(null);

  const stopSource = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (oscRef.current) {
      try { oscRef.current.stop(); } catch { /* already stopped */ }
      oscRef.current.disconnect();
      oscRef.current = null;
    }
    if (gainRef.current) { gainRef.current.disconnect(); gainRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const loopRef = useRef(null);

  const loop = useCallback(() => {
    if (!runningRef.current || !analyserRef.current) return;
    const analyser = analyserRef.current;
    const sampleRate = audioCtxRef.current.sampleRate;

    if (!frozenRef.current) {
      analyser.getFloatTimeDomainData(timeDataRef.current);
      analyser.getByteFrequencyData(freqDataRef.current);
      frameRef.current = analyzePitchFrame(timeDataRef.current, sampleRate);
    }

    const frame = frameRef.current;
    if (waveCanvasRef.current) drawWaveform(waveCanvasRef.current, timeDataRef.current, frame, colors);
    if (spectrumCanvasRef.current)
      drawSpectrum(spectrumCanvasRef.current, freqDataRef.current, sampleRate, frame?.frequency, colors);
    if (autocorrCanvasRef.current) drawAutocorrelation(autocorrCanvasRef.current, frame, colors);

    // throttle the text readout to ~12 fps
    frameCountRef.current = (frameCountRef.current + 1) % 5;
    if (frameCountRef.current === 0 && frame) {
      if (frame.frequency) {
        const note = frequencyToNote(frame.frequency);
        setReadout({
          note: note.note,
          octave: note.octave,
          freq: Math.round(frame.frequency),
          cents: centsFromNearestNote(frame.frequency),
          strength: frame.bestValue,
          amplitude: frame.peakAmplitude,
        });
      } else {
        setReadout({ note: null, freq: null, amplitude: frame.peakAmplitude, strength: frame.bestValue });
      }
    }

    rafRef.current = requestAnimationFrame(() => loopRef.current && loopRef.current());
  }, [colors]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const startCommon = useCallback(() => {
    timeDataRef.current = new Float32Array(FFT_SIZE);
    freqDataRef.current = new Uint8Array(FFT_SIZE / 2);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    return { ctx, analyser };
  }, []);

  const startMic = useCallback(async () => {
    stopSource();
    setError(null);
    try {
      const { ctx, analyser } = startCommon();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser); // NOT to destination — avoids feedback
      runningRef.current = true;
      frozenRef.current = false;
      setFrozen(false);
      setMode('mic');
      rafRef.current = requestAnimationFrame(() => loopRef.current && loopRef.current());
    } catch {
      stopSource();
      setError('Microphone unavailable or permission denied. Try the test tone instead.');
    }
  }, [startCommon, stopSource]);

  const startTone = useCallback(() => {
    stopSource();
    setError(null);
    const { ctx, analyser } = startCommon();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = toneFreq;
    const gain = ctx.createGain();
    gain.gain.value = toneGain;
    osc.connect(gain);
    gain.connect(analyser);
    gain.connect(ctx.destination); // audible, so you can hear the pitch change
    osc.start();
    oscRef.current = osc;
    gainRef.current = gain;
    runningRef.current = true;
    frozenRef.current = false;
    setFrozen(false);
    setMode('tone');
    rafRef.current = requestAnimationFrame(() => loopRef.current && loopRef.current());
  }, [startCommon, stopSource, toneFreq, toneGain]);

  const stop = useCallback(() => {
    stopSource();
    setMode(null);
    setReadout(null);
    setFrozen(false);
    frozenRef.current = false;
  }, [stopSource]);

  const toggleFreeze = useCallback(() => {
    setFrozen((f) => {
      frozenRef.current = !f;
      return !f;
    });
  }, []);

  // live-update the test tone from the sliders
  useEffect(() => {
    if (oscRef.current) oscRef.current.frequency.value = toneFreq;
  }, [toneFreq]);
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = toneGain;
  }, [toneGain]);

  // cleanup on unmount (e.g. switching tabs)
  useEffect(() => stopSource, [stopSource]);

  const canvasStyle = {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: '10px',
  };
  const btn = (active) => ({
    padding: '10px 18px',
    borderRadius: '24px',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    background: active ? `linear-gradient(135deg, ${colors.primary}, ${colors.purple})` : colors.cardBg,
    color: active ? colors.text : colors.textMuted,
    border: `1px solid ${colors.cardBorder}`,
    opacity: 1,
  });

  return (
    <div style={{ animation: 'slideUp 0.5s ease' }}>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ color: colors.text, margin: '0 0 6px' }}>How it works — live</h2>
        <p style={{ color: colors.textMuted, fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
          Every panel below shows the <em>actual</em> data the recognizer uses. Hum into the mic,
          or drive it with a clean test tone and watch the pitch (frequency) and loudness (amplitude)
          change independently.
        </p>
      </div>

      {/* controls */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        <button style={btn(mode === 'mic')} onClick={startMic}>🎤 Microphone</button>
        <button style={btn(mode === 'tone')} onClick={startTone}>🎹 Test tone</button>
        <button style={btn(false)} onClick={toggleFreeze} disabled={!mode}>
          {frozen ? '▶ Live' : '⏸ Freeze'}
        </button>
        <button style={btn(false)} onClick={stop} disabled={!mode}>⏹ Stop</button>
      </div>

      {error && (
        <div style={{ color: colors.primary, fontSize: '0.85rem', marginBottom: '12px' }}>{error}</div>
      )}

      {mode === 'tone' && (
        <div
          style={{
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap',
            marginBottom: '16px',
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '12px',
            padding: '14px 18px',
          }}
        >
          <label style={{ color: colors.text, fontSize: '0.85rem' }}>
            Frequency (pitch): <strong>{toneFreq} Hz</strong>
            <br />
            <input
              type="range"
              min={MIN_FREQ}
              max={MAX_FREQ}
              value={toneFreq}
              onChange={(e) => setToneFreq(Number(e.target.value))}
              style={{ width: '220px', marginTop: '6px' }}
            />
          </label>
          <label style={{ color: colors.text, fontSize: '0.85rem' }}>
            Amplitude (loudness): <strong>{toneGain.toFixed(2)}</strong>
            <br />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={toneGain}
              onChange={(e) => setToneGain(Number(e.target.value))}
              style={{ width: '220px', marginTop: '6px' }}
            />
          </label>
          <div style={{ color: colors.textMuted, fontSize: '0.78rem', maxWidth: '260px', lineHeight: 1.4 }}>
            Move the two sliders separately: frequency changes the <em>note</em>; amplitude changes only the
            wave's <em>height</em>. They are independent — that's the amplitude-vs-frequency distinction.
          </div>
        </div>
      )}

      {!mode && (
        <div style={{ color: colors.textMuted, fontSize: '0.9rem', marginBottom: '16px' }}>
          Pick a source above to begin. The test tone needs no microphone, so it always works for a demo.
        </div>
      )}

      {/* live readout */}
      {readout && (
        <div
          style={{
            display: 'flex',
            gap: '28px',
            flexWrap: 'wrap',
            alignItems: 'center',
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '16px',
          }}
        >
          <div style={{ textAlign: 'center', minWidth: '90px' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 700, color: colors.text, lineHeight: 1 }}>
              {readout.note ? `${readout.note}${readout.octave}` : '—'}
            </div>
            <div style={{ fontSize: '0.8rem', color: colors.textMuted }}>nearest note</div>
          </div>
          <div>
            <div style={{ color: colors.text }}>{readout.freq ? `${readout.freq} Hz` : 'no pitch'}</div>
            <div style={{ fontSize: '0.8rem', color: colors.textMuted }}>frequency</div>
          </div>
          {readout.note && (
            <div style={{ minWidth: '180px' }}>
              <div style={{ color: colors.text }}>
                {readout.cents > 0 ? '+' : ''}
                {readout.cents} cents
              </div>
              {/* ±50 cent window */}
              <div
                style={{
                  position: 'relative',
                  height: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '5px',
                  marginTop: '4px',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '25%',
                    width: '50%',
                    top: 0,
                    bottom: 0,
                    background: 'rgba(78,205,196,0.18)',
                    borderRadius: '5px',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${50 + (readout.cents / 100) * 100}%`,
                    top: '-2px',
                    width: '3px',
                    height: '14px',
                    background: colors.accent,
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: colors.textMuted, marginTop: '2px' }}>
                shaded = ±50¢ "same note" window
              </div>
            </div>
          )}
          <div>
            <div style={{ color: colors.text }}>{readout.amplitude?.toFixed(2)}</div>
            <div style={{ fontSize: '0.8rem', color: colors.textMuted }}>amplitude (loudness)</div>
          </div>
          <div>
            <div style={{ color: colors.text }}>{readout.strength >= 0 ? readout.strength.toFixed(2) : '—'}</div>
            <div style={{ fontSize: '0.8rem', color: colors.textMuted }}>match strength</div>
          </div>
        </div>
      )}

      <Panel
        title="1 · Waveform (time domain)"
        colors={colors}
        caption="The raw air-pressure signal over time. Its HEIGHT is amplitude (loudness); how often it REPEATS is frequency (pitch). The yellow bracket marks one full cycle — that repeat rate is the pitch."
      >
        <canvas ref={waveCanvasRef} width={CANVAS_W} height={CANVAS_H} style={canvasStyle} />
      </Panel>

      <Panel
        title="2 · Spectrum (frequency domain)"
        colors={colors}
        caption="A frequency spectrum from the browser's built-in FFT — used here only to illustrate. The tall yellow peak is the fundamental (the pitch); the dashed lines (×2, ×3 …) are its overtones/harmonics. Note: the actual pitch detection does NOT use this FFT — it uses autocorrelation (Panel 3). The FFT's ~21 Hz-per-bin resolution is too coarse to pin the fundamental precisely, which is exactly why we detect with autocorrelation instead."
      >
        <canvas ref={spectrumCanvasRef} width={CANVAS_W} height={CANVAS_H} style={canvasStyle} />
      </Panel>

      <Panel
        title="3 · Autocorrelation (how the pitch is found)"
        colors={colors}
        caption="We slide the waveform against a delayed copy of itself. The curve is how well it matches at each delay (lag). The first strong peak — marked in yellow — is the fundamental period. Frequency = sample rate ÷ that lag. This is the actual algorithm, not an FFT."
      >
        <canvas ref={autocorrCanvasRef} width={CANVAS_W} height={CANVAS_H} style={canvasStyle} />
      </Panel>

      <Panel
        title="4 · Quantize to a note (±50 cents)"
        colors={colors}
        caption="The detected frequency is rounded to the nearest of the 12 Western notes. The shaded band is ±50 cents (half a semitone) — the rounding boundary. Readings inside it count as the same note; beyond it, the pitch is closer to the neighbouring note and starts a new one."
      >
        <div style={{ fontSize: '0.85rem', color: colors.textMuted, lineHeight: 1.5 }}>
          The big note, cents meter, and "match strength" in the readout bar above update live from this
          step. Hum a slow glide and watch the marker cross the edge of the shaded window exactly as the
          note name changes.
        </div>
      </Panel>
    </div>
  );
}

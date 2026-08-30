import React, { useRef, useState } from 'react';
import { tracksDatabase } from '../utils/tracksDatabase';

/**
 * Affect-Space Explorer — a live, interactive view of the Part-2 recommendation
 * engine. Every curated track is plotted by (valence, energy) in Russell's
 * circumplex; drag the marker to watch nearest-neighbour recommendation, the
 * genre-diversity cap, journey mode, and Stage-3e like-expansion happen in real
 * time on the SAME data the recommender uses.
 *
 * The scoring here mirrors EarCandy.jsx exactly (proximity = 1 − dist/√2, top-6
 * with a ≤2-per-genre cap until ≥4 genres, journey = 6 waypoints along the line,
 * cluster = +0.06 same-genre affinity). It is a visualiser, not a second source
 * of truth — kept deliberately small so it can't drift from the engine.
 */

// ── Geometry (viewBox units) ───────────────────────────────────────────────
const VB = 600;
const M = { l: 54, r: 24, t: 24, b: 54 };
const PW = VB - M.l - M.r;
const PH = VB - M.t - M.b;
const X = (v) => M.l + v * PW;
const Y = (e) => M.t + (1 - e) * PH;
const SQRT2 = Math.SQRT2;
const clamp = (x) => Math.max(0, Math.min(1, x));
const prox = (t, tv, te) => 1 - Math.hypot(t.valence - tv, t.energy - te) / SQRT2;

// ── Genre colours (tuned for legibility on the dark plot) ──────────────────
const GENRES = {
  carnatic:      { c: '#ff9f43', n: 'Carnatic' },
  hindustani:    { c: '#f2724b', n: 'Hindustani' },
  finnish_metal: { c: '#9aa7b8', n: 'Finnish Metal' },
  reggaeton:     { c: '#12c99b', n: 'Reggaetón' },
  gospel:        { c: '#fdcb6e', n: 'Gospel' },
  kpop:          { c: '#fd79a8', n: 'K-Pop' },
  afrobeat:      { c: '#e8836a', n: 'Afrobeat' },
  bossa_nova:    { c: '#74b9ff', n: 'Bossa Nova' },
  flamenco:      { c: '#ff5d62', n: 'Flamenco' },
  jpop:          { c: '#ff8f8f', n: 'J-Pop' },
  qawwali:       { c: '#b3a7ff', n: 'Qawwali' },
  american_rock: { c: '#b0b8c4', n: 'American Rock' },
};
const gcolor = (g) => (GENRES[g] ? GENRES[g].c : '#8892b0');

const MOODS = [
  { id: 'energetic',  label: 'Energetic',  emoji: '⚡', valence: 0.8, energy: 0.9 },
  { id: 'happy',      label: 'Happy',      emoji: '☀️', valence: 0.9, energy: 0.7 },
  { id: 'calm',       label: 'Calm',       emoji: '🌊', valence: 0.6, energy: 0.3 },
  { id: 'melancholic',label: 'Melancholic',emoji: '🌙', valence: 0.3, energy: 0.4 },
  { id: 'focused',    label: 'Focused',    emoji: '🎯', valence: 0.5, energy: 0.5 },
  { id: 'romantic',   label: 'Romantic',   emoji: '💫', valence: 0.7, energy: 0.4 },
];
const nearestMood = (v, e) => {
  let best = MOODS[0], bd = Infinity;
  for (const m of MOODS) { const d = Math.hypot(m.valence - v, m.energy - e); if (d < bd) { bd = d; best = m; } }
  return best;
};

// ── Engine (mirrors EarCandy.jsx) ──────────────────────────────────────────
function recommendSingle(tv, te) {
  const scored = tracksDatabase.map((t) => ({ ...t, p: prox(t, tv, te) })).sort((a, b) => b.p - a.p);
  const sel = [], gc = new Map();
  for (const t of scored) {
    if (sel.length >= 6) break;
    const c = gc.get(t.genre) || 0, enoughDiversity = gc.size >= 4;
    if (c < 2 || enoughDiversity) { sel.push(t); gc.set(t.genre, c + 1); }
  }
  return sel;
}
function journeyPicks(a, b) {
  const sel = [], used = new Set(), N = 6;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const wv = a.v + (b.v - a.v) * t, we = a.e + (b.e - a.e) * t;
    const cand = tracksDatabase.filter((x) => !used.has(x.id))
      .map((x) => ({ ...x, p: prox(x, wv, we) })).sort((p, q) => q.p - p.p)[0];
    if (cand) { used.add(cand.id); sel.push({ ...cand, wv, we, step: i + 1 }); }
  }
  return sel;
}
function clusterFrom(seed, exclude) {
  const AFF = 0.06;
  return tracksDatabase
    .filter((x) => x.id !== seed.id && !exclude.has(x.id))
    .map((x) => ({ ...x, p: prox(x, seed.valence, seed.energy) }))
    .sort((a, b) => (b.p + (b.genre === seed.genre ? AFF : 0)) - (a.p + (a.genre === seed.genre ? AFF : 0)))
    .slice(0, 6);
}

export default function AffectSpaceExplorer({ colors }) {
  const [mode, setMode] = useState('single');
  const [you, setYou] = useState({ v: 0.6, e: 0.45 });
  const [desired, setDesired] = useState({ v: 0.85, e: 0.72 });
  const [expand, setExpand] = useState(false);
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const mono = "'Space Mono', monospace";
  const YOU = colors.accent;      // #ffe66d
  const JOUR = colors.purple;     // #a855f7
  const VAL = colors.primary;     // coral
  const ENE = colors.secondary;   // teal

  const picks = mode === 'single' ? recommendSingle(you.v, you.e) : journeyPicks(you, desired);
  const pickIds = new Set(picks.map((p) => p.id));
  let cluster = [];
  if (expand && mode === 'single' && picks.length) {
    cluster = clusterFrom(picks[0], new Set(pickIds));
  }
  const clIds = new Set(cluster.map((c) => c.id));

  // ── Pointer interaction ──
  const toPoint = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * VB;
    const sy = ((e.clientY - r.top) / r.height) * VB;
    return { v: clamp((sx - M.l) / PW), e: clamp(1 - (sy - M.t) / PH) };
  };
  const onDown = (e) => {
    e.preventDefault();
    const p = toPoint(e);
    let target = 'you';
    if (mode === 'journey') {
      const dY = Math.hypot(p.v - you.v, p.e - you.e);
      const dD = Math.hypot(p.v - desired.v, p.e - desired.e);
      target = dD < dY ? 'desired' : 'you';
    }
    dragRef.current = target;
    (target === 'you' ? setYou : setDesired)(p);
    try { svgRef.current.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onMove = (e) => {
    if (!dragRef.current) return;
    const p = toPoint(e);
    (dragRef.current === 'you' ? setYou : setDesired)(p);
  };
  const onUp = () => { dragRef.current = null; };

  const switchMode = (m) => { setMode(m); setExpand(false); };
  const reset = () => { setYou({ v: 0.6, e: 0.45 }); setDesired({ v: 0.85, e: 0.72 }); setExpand(false); };

  const matchColor = (p) => (p > 0.85 ? colors.secondary : p > 0.65 ? colors.accent : colors.purple);

  // ── Static SVG layers ──
  const quads = [
    { x: X(0.5), y: Y(1),   f: 'rgba(255,107,107,.075)' },
    { x: M.l,    y: Y(1),   f: 'rgba(168,85,247,.075)' },
    { x: X(0.5), y: Y(0.5), f: 'rgba(78,205,196,.06)' },
    { x: M.l,    y: Y(0.5), f: 'rgba(96,120,180,.07)' },
  ];
  const quadLabels = [
    ['upbeat', 0.985, 0.985, 'end'], ['tense', 0.015, 0.985, 'start'],
    ['serene', 0.985, 0.06, 'end'], ['wistful', 0.015, 0.06, 'start'],
  ];
  const gridLines = [];
  for (let i = 0; i <= 10; i++) {
    const strong = i === 0 || i === 5 || i === 10;
    const stroke = strong ? 'rgba(150,162,205,.26)' : 'rgba(150,162,205,.10)';
    gridLines.push(<line key={`gx${i}`} x1={X(i / 10)} y1={M.t} x2={X(i / 10)} y2={M.t + PH} stroke={stroke} />);
    gridLines.push(<line key={`gy${i}`} x1={M.l} y1={Y(i / 10)} x2={M.l + PW} y2={Y(i / 10)} stroke={stroke} />);
  }

  const btn = (active) => ({
    fontFamily: mono, fontSize: '.78rem', letterSpacing: '.03em',
    color: active ? colors.text : colors.textMuted,
    background: active ? 'rgba(255,230,109,.14)' : 'transparent',
    border: 'none', padding: '7px 13px', borderRadius: '7px', cursor: 'pointer',
  });
  const actionBtn = (active) => ({
    fontFamily: mono, fontSize: '.78rem', letterSpacing: '.02em',
    color: active ? colors.primary : colors.text,
    background: active ? 'rgba(255,107,107,.10)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? colors.primary : colors.cardBorder}`,
    padding: '8px 13px', borderRadius: '9px', cursor: 'pointer',
  });

  return (
    <div style={{ animation: 'slideUp 0.5s ease' }}>
      {/* Intro */}
      <div style={{
        background: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
        borderRadius: '20px', padding: '22px 26px', marginBottom: '20px',
      }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 600 }}>🎯 Affect Space</h2>
        <p style={{ margin: 0, color: colors.textMuted, fontSize: '.95rem', lineHeight: 1.6, maxWidth: '68ch' }}>
          Every song is two numbers — <b style={{ color: VAL }}>valence</b> (dark ↔ bright) and{' '}
          <b style={{ color: ENE }}>energy</b> (calm ↔ intense). So is your mood. A recommendation is
          just what sits nearby. Drag the marker to see the engine work on all {tracksDatabase.length} curated tracks.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(230px,.9fr)', gap: '22px', alignItems: 'start' }}>
        {/* Plot */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            background: 'linear-gradient(180deg, rgba(18,23,41,.9), rgba(12,15,26,.95))',
            border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', padding: '12px',
          }}>
            <svg
              ref={svgRef} viewBox={`0 0 ${VB} ${VB}`} role="application"
              aria-label="Interactive valence-energy affect space. Drag a marker to see nearest-neighbour recommendations."
              style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            >
              {/* quadrant washes */}
              {quads.map((q, i) => <rect key={`q${i}`} x={q.x} y={q.y} width={PW / 2} height={PH / 2} fill={q.f} />)}
              {quadLabels.map(([txt, v, e, anchor]) => (
                <text key={txt} x={X(v)} y={Y(e)} textAnchor={anchor} fontFamily={mono} fontSize="12" fill={colors.textMuted} opacity=".7" letterSpacing="1.5">{txt}</text>
              ))}
              {gridLines}
              {/* axis labels */}
              <text x={M.l} y={M.t + PH + 32} fill={VAL} fontFamily={mono} fontSize="12">← darker</text>
              <text x={M.l + PW} y={M.t + PH + 32} textAnchor="end" fill={VAL} fontFamily={mono} fontSize="12">brighter →</text>
              <text x={M.l + PW / 2} y={M.t + PH + 32} textAnchor="middle" fill={colors.textMuted} fontFamily={mono} fontSize="11" letterSpacing="2">VALENCE</text>
              <text transform={`translate(${M.l - 36},${M.t + PH}) rotate(-90)`} fill={ENE} fontFamily={mono} fontSize="12">← calmer</text>
              <text transform={`translate(${M.l - 36},${M.t + 24}) rotate(-90)`} textAnchor="end" fill={ENE} fontFamily={mono} fontSize="12">intense →</text>
              <text transform={`translate(${M.l - 36},${M.t + PH / 2}) rotate(-90)`} textAnchor="middle" fill={colors.textMuted} fontFamily={mono} fontSize="11" letterSpacing="2">ENERGY</text>
              {/* mood anchors */}
              {MOODS.map((m) => (
                <g key={m.id}>
                  <circle cx={X(m.valence)} cy={Y(m.energy)} r="15" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 3" />
                  <text x={X(m.valence)} y={Y(m.energy) + 4.5} textAnchor="middle" fontSize="13">{m.emoji}</text>
                  <text x={X(m.valence)} y={Y(m.energy) + 30} textAnchor="middle" fontFamily={mono} fontSize="10" fill={colors.textMuted} opacity=".8">{m.label}</text>
                </g>
              ))}

              {/* dots */}
              {tracksDatabase.map((t) => {
                const col = gcolor(t.genre), cx = X(t.valence), cy = Y(t.energy);
                if (pickIds.has(t.id)) {
                  return (
                    <g key={t.id}>
                      <circle cx={cx} cy={cy} r="10" fill="none" stroke={col} strokeWidth="1" opacity=".45" />
                      <circle cx={cx} cy={cy} r="6.5" fill={col} stroke={colors.bg} strokeWidth="1.5" />
                    </g>
                  );
                }
                if (clIds.has(t.id)) {
                  return <rect key={t.id} x={cx - 5} y={cy - 5} width="10" height="10" rx="2" fill={col} stroke={colors.bg} strokeWidth="1.3" />;
                }
                return <circle key={t.id} cx={cx} cy={cy} r="3.6" fill={col} opacity=".42" />;
              })}

              {/* overlay: connectors, path, markers */}
              {mode === 'single' && picks.map((p) => (
                <line key={`l${p.id}`} x1={X(you.v)} y1={Y(you.e)} x2={X(p.valence)} y2={Y(p.energy)} stroke={YOU} strokeWidth="1" opacity=".28" />
              ))}
              {mode === 'single' && cluster.map((c) => (
                <line key={`cl${c.id}`} x1={X(picks[0].valence)} y1={Y(picks[0].energy)} x2={X(c.valence)} y2={Y(c.energy)} stroke={VAL} strokeWidth="1" strokeDasharray="2 3" opacity=".5" />
              ))}
              {mode === 'journey' && (
                <line x1={X(you.v)} y1={Y(you.e)} x2={X(desired.v)} y2={Y(desired.e)} stroke={JOUR} strokeWidth="1.6" strokeDasharray="5 4" opacity=".7" />
              )}
              {mode === 'journey' && picks.map((p) => (
                <g key={`j${p.id}`}>
                  <circle cx={X(p.wv)} cy={Y(p.we)} r="4" fill={colors.bg} stroke={JOUR} strokeWidth="1.3" />
                  <line x1={X(p.wv)} y1={Y(p.we)} x2={X(p.valence)} y2={Y(p.energy)} stroke={JOUR} strokeWidth="1" opacity=".35" />
                  <text x={X(p.valence)} y={Y(p.energy) - 11} textAnchor="middle" fontFamily={mono} fontSize="10.5" fill="#cbb7f5">{p.step}</text>
                </g>
              ))}

              {/* markers */}
              <Marker x={X(you.v)} y={Y(you.e)} col={YOU} filled bg={colors.bg} />
              {mode === 'journey' && <Marker x={X(desired.v)} y={Y(desired.e)} col={JOUR} bg={colors.bg} />}
            </svg>
          </div>

          {/* controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.cardBorder}`, borderRadius: '10px', padding: '3px' }}>
              <button style={btn(mode === 'single')} onClick={() => switchMode('single')}>Single mood</button>
              <button style={btn(mode === 'journey')} onClick={() => switchMode('journey')}>Journey</button>
            </div>
            <button
              style={{ ...actionBtn(expand), opacity: mode === 'journey' ? 0.4 : 1, cursor: mode === 'journey' ? 'not-allowed' : 'pointer' }}
              disabled={mode === 'journey'} onClick={() => setExpand((x) => !x)}
            >❤ Expand top pick</button>
            <button style={actionBtn(false)} onClick={reset}>Reset</button>
          </div>

          {/* legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: '14px' }}>
            {Object.values(GENRES).map((g) => (
              <span key={g.n} style={{ display: 'inline-flex', alignItems: 'center', fontFamily: mono, fontSize: '.72rem', color: colors.textMuted }}>
                <i style={{ width: '9px', height: '9px', borderRadius: '2px', marginRight: '6px', background: g.c, display: 'inline-block' }} />{g.n}
              </span>
            ))}
          </div>
          <p style={{ fontFamily: mono, fontSize: '.72rem', color: colors.textMuted, opacity: .7, marginTop: '10px' }}>
            Click to place your mood · in Journey mode, drag the purple marker too.
          </p>
        </div>

        {/* Readout */}
        <aside style={{
          background: 'linear-gradient(180deg, rgba(18,23,41,.9), rgba(12,15,26,.95))',
          border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', padding: '16px 16px 18px', position: 'sticky', top: '18px',
        }} aria-live="polite">
          <h4 style={{ margin: '0 0 3px', fontFamily: mono, fontSize: '.72rem', letterSpacing: '.12em', textTransform: 'uppercase', color: colors.textMuted, fontWeight: 500 }}>
            {mode === 'single' ? 'Your playlist' : 'Your journey'}
          </h4>
          <p style={{ fontFamily: mono, fontSize: '.72rem', color: colors.textMuted, opacity: .8, margin: '0 0 14px' }}>
            {mode === 'single'
              ? <>marker <b style={{ color: YOU }}>v {you.v.toFixed(2)} · e {you.e.toFixed(2)}</b> ≈ {nearestMood(you.v, you.e).label.toLowerCase()}</>
              : <><b style={{ color: YOU }}>{nearestMood(you.v, you.e).label.toLowerCase()}</b> → <b style={{ color: '#c9b6f5' }}>{nearestMood(desired.v, desired.e).label.toLowerCase()}</b></>}
          </p>

          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {picks.map((p, i) => (
              <li key={p.id} style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: '9px', alignItems: 'baseline', padding: '7px 0', borderTop: i === 0 ? 'none' : `1px solid ${colors.cardBorder}` }}>
                <span style={{ fontFamily: mono, fontSize: '.66rem', color: colors.textMuted }}>{mode === 'journey' ? `s${p.step}` : i + 1}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                  <span style={{ display: 'block', color: colors.textMuted, fontSize: '.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <i style={{ width: '8px', height: '8px', borderRadius: '2px', marginRight: '5px', background: gcolor(p.genre), display: 'inline-block' }} />{p.artist}
                  </span>
                </span>
                <span style={{ fontFamily: mono, fontSize: '.78rem', color: matchColor(p.p) }}>{Math.round(p.p * 100)}%</span>
              </li>
            ))}
            {cluster.length > 0 && (
              <>
                <li style={{ borderTop: `1px solid ${colors.cardBorder}`, padding: '9px 0 2px' }}>
                  <span style={{ fontFamily: mono, fontSize: '.64rem', letterSpacing: '.1em', textTransform: 'uppercase', color: VAL }}>Expanded from ❤ {picks[0].title}</span>
                </li>
                {cluster.map((c) => (
                  <li key={`c${c.id}`} style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: '9px', alignItems: 'baseline', padding: '6px 0' }}>
                    <span style={{ fontFamily: mono, fontSize: '.8rem', color: VAL }}>↳</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      <span style={{ display: 'block', color: colors.textMuted, fontSize: '.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <i style={{ width: '8px', height: '8px', borderRadius: '2px', marginRight: '5px', background: gcolor(c.genre), display: 'inline-block' }} />{c.artist}
                      </span>
                    </span>
                    <span style={{ fontFamily: mono, fontSize: '.78rem', color: matchColor(c.p) }}>{Math.round(c.p * 100)}%</span>
                  </li>
                ))}
              </>
            )}
          </ol>

          <p style={{ fontSize: '.72rem', color: colors.textMuted, margin: '12px 0 0', lineHeight: 1.5 }}>
            {mode === 'single'
              ? `${new Set(picks.map((p) => p.genre)).size} genres in 6 — the diversity cap at work. Match % is proximity to your marker.`
              : 'Six waypoints sampled along the line; each takes its nearest unused track. An emotion arc, not a match.'}
          </p>
        </aside>
      </div>
    </div>
  );
}

function Marker({ x, y, col, filled, bg }) {
  return (
    <g>
      <line x1={x - 13} y1={y} x2={x + 13} y2={y} stroke={col} strokeWidth="1" opacity=".6" />
      <line x1={x} y1={y - 13} x2={x} y2={y + 13} stroke={col} strokeWidth="1" opacity=".6" />
      {filled ? (
        <>
          <circle cx={x} cy={y} r="7.5" fill={col} stroke={bg} strokeWidth="2" />
          <circle cx={x} cy={y} r="12" fill="none" stroke={col} strokeWidth="1.4" opacity=".5">
            <animate attributeName="r" values="10;15;10" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values=".5;0;.5" dur="2.6s" repeatCount="indefinite" />
          </circle>
        </>
      ) : (
        <circle cx={x} cy={y} r="7.5" fill={bg} stroke={col} strokeWidth="2.2" />
      )}
    </g>
  );
}

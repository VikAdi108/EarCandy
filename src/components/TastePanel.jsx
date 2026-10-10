import React, { useRef } from 'react';

/**
 * TastePanel — the visible face of live learning. Shows what EarCandy has learned
 * from your ❤ likes and skips (leaned-toward / avoided genres, your mood centre),
 * and lets you export / import / reset the profile. Purely presentational: all
 * state and persistence live in EarCandy via profileStore.
 *
 * Props:
 *   colors, count, centerLabel
 *   topGenres / avoided : [{ name, color, weight }]
 *   onExport()          : parent serializes + downloads the profile
 *   onImport(text)      : parent parses + applies an imported profile JSON
 *   onReset()           : parent clears the profile
 */
export default function TastePanel({ colors, count, centerLabel, topGenres = [], avoided = [], onExport, onImport, onReset }) {
  const fileRef = useRef(null);
  const mono = "'Space Mono', monospace";

  const readFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { onImport(String(reader.result)); } catch { /* parent surfaces errors */ } };
    reader.readAsText(file);
    e.target.value = ''; // allow re-importing the same file
  };

  const bar = (weight, color) => (
    <span style={{ display: 'inline-block', width: '46px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', verticalAlign: 'middle' }}>
      <span style={{ display: 'block', height: '100%', width: `${Math.round(Math.abs(weight) * 100)}%`, background: color }} />
    </span>
  );

  const chipRow = (items, sign) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((it) => (
        <div key={it.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
            <i style={{ width: '9px', height: '9px', borderRadius: '2px', background: it.color, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {bar(it.weight, it.color)}
            <span style={{ fontFamily: mono, fontSize: '.68rem', color: colors.textMuted, width: '30px', textAlign: 'right' }}>
              {sign}{Math.round(Math.abs(it.weight) * 100)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );

  const btn = {
    fontFamily: mono, fontSize: '.72rem', letterSpacing: '.02em', color: colors.text,
    background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.cardBorder}`,
    padding: '7px 12px', borderRadius: '8px', cursor: 'pointer',
  };

  return (
    <div style={{
      background: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
      borderRadius: '18px', padding: '20px 22px', marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>🧠 Your taste</h3>
        <span style={{ fontFamily: mono, fontSize: '.7rem', color: colors.textMuted }}>
          learned from {count} signal{count === 1 ? '' : 's'}
        </span>
      </div>

      {count === 0 ? (
        <p style={{ margin: '8px 0 0', color: colors.textMuted, fontSize: '.85rem', lineHeight: 1.6 }}>
          Nothing learned yet. ❤ songs you like and skip ones you don't — EarCandy will start leaning your
          recommendations toward your taste, within whatever mood you pick. Your profile stays on this device
          (and you can export it below).
        </p>
      ) : (
        <>
          {centerLabel && (
            <p style={{ margin: '6px 0 14px', color: colors.textMuted, fontSize: '.82rem' }}>
              Your likes centre around a <b style={{ color: colors.accent }}>{centerLabel.toLowerCase()}</b> mood.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: avoided.length ? '1fr 1fr' : '1fr', gap: '22px', marginTop: '10px' }}>
            {topGenres.length > 0 && (
              <div>
                <div style={{ fontFamily: mono, fontSize: '.64rem', letterSpacing: '.1em', textTransform: 'uppercase', color: colors.secondary, marginBottom: '8px' }}>Leaning toward</div>
                {chipRow(topGenres, '+')}
              </div>
            )}
            {avoided.length > 0 && (
              <div>
                <div style={{ fontFamily: mono, fontSize: '.64rem', letterSpacing: '.1em', textTransform: 'uppercase', color: colors.purple, marginBottom: '8px' }}>Steering clear of</div>
                {chipRow(avoided, '−')}
              </div>
            )}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '18px', flexWrap: 'wrap' }}>
        <button style={btn} onClick={onExport} disabled={count === 0} title="Download your taste profile as JSON">↓ Export</button>
        <button style={btn} onClick={() => fileRef.current && fileRef.current.click()} title="Load a taste profile JSON">↑ Import</button>
        <button style={{ ...btn, color: colors.primary, borderColor: 'rgba(255,107,107,0.3)' }} onClick={onReset} disabled={count === 0} title="Forget everything learned">Reset</button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={readFile} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

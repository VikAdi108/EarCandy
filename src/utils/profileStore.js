/**
 * ProfileStore — the single seam between EarCandy and *where* a user's listening
 * record lives. Today it's localStorage; tomorrow it can be a backend + accounts
 * WITHOUT touching the learning model or the UI. Everything that reads/writes a
 * profile goes through this interface:
 *
 *     load()            -> Profile            (never throws; empty on miss/corruption; migrates v1→v2)
 *     save(profile)     -> Profile            (stamps updatedAt, persists, returns what was saved)
 *     clear()           -> void
 *     serialize(p)      -> string             (pretty JSON, for export/download)
 *     deserialize(str)  -> Profile            (parse + validate, for import; throws on bad input)
 *
 * To move to a backend later: write createRemoteStore() with the same five
 * methods and swap the `profileStore` export. Nothing else changes.
 *
 * ── Profile shape (v2) ─────────────────────────────────────────────────────
 *   {
 *     version: 2,
 *     events: [ Event, ... ],   // the per-song record — source of truth
 *     updatedAt: number|null
 *   }
 *
 * Event:
 *   { type, id, genre, region, ts, ms? }
 *     type  : 'like' (❤) | 'skip' (👎 remove) | 'never' (⊘ never again) | 'play'
 *     id    : track id
 *     genre : track genre id            (nullable — unknown for migrated v1 rows)
 *     region: world region of the track (nullable — ditto)
 *     ts    : epoch ms when it happened
 *     ms    : for 'play' only — milliseconds actually heard (listening time)
 *
 * This is deliberately a superset of what both the taste model (likes/skips)
 * and the listener-test kit (plays + seconds-heard + region) need, so a single
 * log serves learning now and the Round-2 test export later. The taste *vector*
 * is always derived from this log at read time (see tasteModel.js), never
 * stored — so the model can evolve without migrating anyone's data.
 */

const STORAGE_KEY = 'earcandy_profile_v1'; // storage slot name; internal shape is versioned separately
const PROFILE_VERSION = 2;
const EVENT_TYPES = new Set(['like', 'skip', 'never', 'play']);

export function emptyProfile() {
  return { version: PROFILE_VERSION, events: [], updatedAt: null };
}

function coerceEvent(e) {
  if (!e || !EVENT_TYPES.has(e.type)) return null;
  if (typeof e.id !== 'number' && typeof e.id !== 'string') return null;
  const out = {
    type: e.type,
    id: e.id,
    genre: typeof e.genre === 'string' ? e.genre : null,
    region: typeof e.region === 'string' ? e.region : null,
    ts: typeof e.ts === 'number' ? e.ts : Date.now(),
  };
  if (e.type === 'play' && typeof e.ms === 'number' && e.ms >= 0) out.ms = Math.round(e.ms);
  return out;
}

/** Coerce arbitrary parsed JSON into a well-formed v2 Profile, migrating v1. */
function normalize(obj) {
  const p = emptyProfile();
  if (!obj || typeof obj !== 'object') return p;

  if (Array.isArray(obj.events)) {
    // Already v2-shaped.
    p.events = obj.events.map(coerceEvent).filter(Boolean);
  } else if (obj.signals) {
    // Migrate v1 { signals: { likes:[{id,ts}], skips:[{id,ts}] } } → events.
    // Region/genre are unrecoverable for old rows, so they stay null.
    const migrate = (arr, type) => (Array.isArray(arr) ? arr : []).forEach((s) => {
      const ev = coerceEvent({ type, id: s && s.id, ts: s && s.ts });
      if (ev) p.events.push(ev);
    });
    migrate(obj.signals.likes, 'like');
    migrate(obj.signals.skips, 'skip');
  }
  if (typeof obj.updatedAt === 'number') p.updatedAt = obj.updatedAt;
  return p;
}

function createLocalStore() {
  return {
    load() {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        return raw ? normalize(JSON.parse(raw)) : emptyProfile();
      } catch {
        return emptyProfile();
      }
    },
    save(profile) {
      const toSave = { ...normalize(profile), updatedAt: Date.now() };
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch { /* quota / private mode — degrade to in-memory for this session */ }
      return toSave;
    },
    clear() {
      try { if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY); }
      catch { /* noop */ }
    },
    serialize(profile) {
      return JSON.stringify(normalize(profile), null, 2);
    },
    deserialize(str) {
      const parsed = JSON.parse(str); // throws on invalid JSON — caller handles
      return normalize(parsed);
    },
  };
}

/** The active store. Swap this line for createRemoteStore() to go server-backed. */
export const profileStore = createLocalStore();

/**
 * Append one event to a profile, returning a NEW profile (immutably).
 * @param {object} profile
 * @param {{type:string, id:(number|string), genre?:string, region?:string, ms?:number}} event
 */
export function recordEvent(profile, event) {
  const base = profile && Array.isArray(profile.events) ? profile : emptyProfile();
  const ev = coerceEvent({ ...event, ts: Date.now() });
  if (!ev) return base;
  return { ...base, events: [...base.events, ev] };
}

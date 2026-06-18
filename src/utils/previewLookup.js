/**
 * Audio Preview Lookup
 *
 * For each recommended track, find a 30-second audio preview clip via the
 * iTunes Search API. iTunes was chosen over Deezer because:
 *   - no auth required, CORS-enabled
 *   - broadest catalog (Apple Music index, ~30M+ tracks)
 *   - extremely stable URL pattern (m4a, deliverable directly to <audio>)
 *
 * The lookup is lazy — we only query iTunes when the user actually clicks
 * "play" on a card. Results are cached in localStorage so subsequent plays
 * of the same track are instant and don't hit the network.
 *
 * If iTunes doesn't have the track (foreign-language deep cuts, niche
 * curated tracks like "Anandamruthavarshini"), the lookup returns null and
 * the UI gracefully shows "preview unavailable".
 */

const ITUNES_ENDPOINT = 'https://itunes.apple.com/search';
const CACHE_KEY_PREFIX = 'earcandy_preview_v1::';

// In-memory cache so multiple cards re-rendering the same track don't all
// hit localStorage repeatedly. Acts as L1; localStorage is L2.
const memCache = new Map();

/** localStorage helper that fails open — never throws even in quota/SSR cases. */
function safeStorageGet(key) {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; }
  catch { return null; }
}
function safeStorageSet(key, value) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); }
  catch { /* quota, private mode, etc. — silently skip */ }
}

/** Build the cache key from artist/title (case-insensitive, trimmed). */
function cacheKey(artist, title) {
  return `${(artist || '').trim().toLowerCase()}|${(title || '').trim().toLowerCase()}`;
}

/**
 * Look up a 30-second preview URL for a track.
 *
 * Returns:
 *   { url: string, artworkUrl?: string }   — match found
 *   { url: null }                          — searched, none available
 *   null                                   — caller error (no artist/title)
 *
 * The caller can rely on the cached negative case ({ url: null }) so we
 * don't pound iTunes for tracks it can never find.
 */
export async function findPreview(artist, title) {
  if (!artist || !title) return null;

  const key = cacheKey(artist, title);

  // L1: in-memory
  if (memCache.has(key)) return memCache.get(key);

  // L2: localStorage
  const stored = safeStorageGet(CACHE_KEY_PREFIX + key);
  if (stored !== null) {
    try {
      const parsed = JSON.parse(stored);
      memCache.set(key, parsed);
      return parsed;
    } catch {
      // Corrupt cache entry — fall through to live fetch
    }
  }

  // Live fetch
  try {
    const term = encodeURIComponent(`${artist} ${title}`);
    const url = `${ITUNES_ENDPOINT}?term=${term}&entity=song&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      const miss = { url: null };
      memCache.set(key, miss);
      return miss;
    }
    const json = await res.json();
    const hit = json?.results?.[0];
    const result = hit?.previewUrl
      ? { url: hit.previewUrl, artworkUrl: hit.artworkUrl100 || null }
      : { url: null };

    memCache.set(key, result);
    safeStorageSet(CACHE_KEY_PREFIX + key, JSON.stringify(result));
    return result;
  } catch {
    // Network errors fail closed — return null so UI shows "unavailable"
    const miss = { url: null };
    memCache.set(key, miss);
    return miss;
  }
}

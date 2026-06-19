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
// v2: v1 trusted iTunes' top hit (limit=1), which silently returned the wrong
// recording whenever a track's title was a common word — e.g. Jobim's "Wave"
// resolved to the megahit "The Girl from Ipanema" (whose credits feature Jobim),
// so multiple cards collapsed onto one clip. v2 fetches a candidate list and
// title/artist-matches; bumping the prefix discards the poisoned v1 entries.
const CACHE_KEY_PREFIX = 'earcandy_preview_v2::';

// How many candidates to pull from iTunes before matching. The correct
// recording for a common-word title can sit several rows down (Jobim's "Wave"
// is often index 2–11), so we need a healthy window — but the payload is small.
const ITUNES_LIMIT = 25;

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
 * Normalize a title/artist for comparison: strip diacritics, drop trailing
 * qualifiers like "(feat. …)", "[Single Version]", "(1987 Versão)", fold "&"
 * to "and", and reduce to lowercase alphanumeric tokens. This lets
 * "Antônio Carlos Jobim" match "Antonio Carlos Jobim" and "Wave (1987 Versão)"
 * match "Wave".
 */
function normalize(str) {
  return (str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/\s*[([].*$/g, '')                       // drop "(feat…)", "[…]" tails
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Score how well an iTunes result matches the track we asked for.
 *   title : 3 = exact, 2 = one fully contains the other, 0 = mismatch
 *   artist: 2 = exact, 1 = one contains the other (covers/duets), 0 = mismatch
 * A title mismatch (score 0) disqualifies the candidate entirely — better to
 * report "unavailable" than to play a confidently-wrong clip. Among the rest,
 * higher total wins; iTunes' own relevance order breaks ties (earliest first).
 */
function matchScore(result, wantArtist, wantTitle) {
  const rTitle = normalize(result.trackName);
  const rArtist = normalize(result.artistName);
  const tTitle = normalize(wantTitle);
  const tArtist = normalize(wantArtist);
  if (!rTitle || !tTitle) return -1;

  let titleScore;
  if (rTitle === tTitle) titleScore = 3;
  else if (rTitle.includes(tTitle) || tTitle.includes(rTitle)) titleScore = 2;
  else return -1; // title must match — disqualify otherwise

  let artistScore = 0;
  if (rArtist && tArtist) {
    if (rArtist === tArtist) artistScore = 2;
    else if (rArtist.includes(tArtist) || tArtist.includes(rArtist)) artistScore = 1;
  }
  return titleScore * 2 + artistScore;
}

/** Pick the best-matching result, or null if none clears the title bar. */
function pickBestMatch(results, artist, title) {
  let best = null;
  let bestScore = 0;
  results.forEach((r, i) => {
    if (!r.previewUrl) return;        // no clip to play — skip
    const score = matchScore(r, artist, title);
    if (score > bestScore || (score === bestScore && best && i < best._i)) {
      // strictly-better score wins; equal score keeps the earlier (more
      // relevant) result, which the forEach order already guarantees.
      if (score > bestScore) { best = { ...r, _i: i }; bestScore = score; }
    }
  });
  return best;
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

  // Live fetch — pull a candidate window and match by title/artist rather than
  // trusting iTunes' top keyword hit (which mis-resolves common-word titles).
  try {
    const term = encodeURIComponent(`${artist} ${title}`);
    const url = `${ITUNES_ENDPOINT}?term=${term}&entity=song&limit=${ITUNES_LIMIT}`;
    const res = await fetch(url);
    if (!res.ok) {
      const miss = { url: null };
      memCache.set(key, miss);
      return miss;
    }
    const json = await res.json();
    const hit = pickBestMatch(json?.results || [], artist, title);
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

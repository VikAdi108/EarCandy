/**
 * TasteModel — turns a user's event log into a "taste vector" that gently
 * personalizes recommendations WITHIN whatever mood they pick. It never moves
 * the user's chosen valence/energy marker (their explicit intent stays sacred);
 * it only re-weights ties by learned genre affinity.
 *
 * Derivation is intentionally simple, bounded, and explainable:
 *   - ❤ like = +1 to that track's genre; 👎 skip = −1; ⊘ never-again = −1.5.
 *   - A 'play' event also counts, scaled by how long they listened: finishing
 *     most of the 30-second clip is a mild + ; bailing in the first few seconds
 *     is a mild − . (This is the "listening time per song" the research asks for,
 *     folded straight into taste.)
 *   - Per-genre sums are squashed through tanh so no genre dominates and a
 *     handful of signals already reads as a lean, not a landslide.
 *   - A "taste centre" (weighted mean valence/energy of positively-received
 *     tracks) is computed for display only — not applied to scoring.
 *
 * Nothing here is persisted: the model is recomputed from the event log on load,
 * so it can change shape freely without migrating anyone's stored data.
 */

const EXPLICIT_WEIGHT = { like: 1, skip: -1, never: -1.5 };
const GENRE_SQUASH = 3;   // divide genre sums by this before tanh — ~3 likes ≈ 0.76 lean
const TASTE_WEIGHT = 8;   // max score points a fully-learned genre affinity adds/subtracts

// A play's contribution, by how much of the 30s clip was actually heard.
function playWeight(ms) {
  if (typeof ms !== 'number') return 0;
  if (ms >= 20000) return 0.5;   // listened to most of it → mild positive
  if (ms < 5000) return -0.25;   // bailed almost immediately → mild negative
  return 0;                      // ambiguous middle → no opinion
}

function eventWeight(ev) {
  return ev.type === 'play' ? playWeight(ev.ms) : (EXPLICIT_WEIGHT[ev.type] || 0);
}

/**
 * @param {Array} events  the profile's event log
 * @param {Map<number|string, {genre:string, valence:number, energy:number}>} trackById
 * @returns {{ genreWeights:Object, topGenres:Array, avoided:Array, center:{v,e}|null, count:number, plays:number }}
 */
export function learnTaste(events, trackById) {
  const list = Array.isArray(events) ? events : [];
  const genreSum = {};
  let cv = 0, ce = 0, cw = 0, count = 0, plays = 0;

  for (const ev of list) {
    if (ev.type === 'play') plays += 1;
    else count += 1; // explicit feedback (like / skip / never)

    const w = eventWeight(ev);
    if (w === 0) continue;

    const t = trackById.get(ev.id);
    const genre = t ? t.genre : ev.genre; // fall back to the stamped genre for migrated rows
    if (!genre) continue;

    genreSum[genre] = (genreSum[genre] || 0) + w;
    if (w > 0 && t && typeof t.valence === 'number') { cv += t.valence * w; ce += t.energy * w; cw += w; }
  }

  const genreWeights = {};
  for (const g in genreSum) genreWeights[g] = Math.tanh(genreSum[g] / GENRE_SQUASH);

  const ranked = Object.entries(genreWeights).sort((a, b) => b[1] - a[1]);
  const topGenres = ranked.filter(([, w]) => w > 0.05).slice(0, 3).map(([g, w]) => ({ genre: g, weight: w }));
  const avoided = ranked.filter(([, w]) => w < -0.05).slice(-3).reverse().map(([g, w]) => ({ genre: g, weight: w }));
  const center = cw > 0 ? { v: cv / cw, e: ce / cw } : null;

  return { genreWeights, topGenres, avoided, center, count, plays };
}

/**
 * Score adjustment for a single track given a learned taste. Bounded to
 * ±TASTE_WEIGHT so mood proximity (weighted ~70) always dominates — taste only
 * settles near-ties. Returns 0 when there's no learned opinion on the genre.
 */
export function tasteBonus(taste, track) {
  if (!taste || !taste.genreWeights) return 0;
  return TASTE_WEIGHT * (taste.genreWeights[track.genre] || 0);
}

/** True when the learned lean on this genre is strong enough to surface in the UI. */
export function isFavoredGenre(taste, genre) {
  return !!taste && !!taste.genreWeights && (taste.genreWeights[genre] || 0) > 0.3;
}

/**
 * AudD Cloud Fallback
 *
 * When the local interval-matcher can't confidently identify a hummed melody,
 * we send the recorded audio to AudD's humming-recognition endpoint
 * (recognizeWithOffset). AudD uses neural-network audio fingerprinting against
 * an ~80M-song catalog — a completely different approach from our local
 * interval/DTW matching, so it covers songs the local DB doesn't have.
 *
 * Activation: API token is read from VITE_AUDD_API_TOKEN at build time, or
 * falls back to 'test' (AudD's public sandbox token, rate-limited).
 * Get a free key (300 requests) at: https://dashboard.audd.io
 */

const AUDD_ENDPOINT = 'https://api.audd.io/';

// Confidence threshold below which we automatically reach for the cloud fallback.
// Tunable: lower = AudD called more often; higher = local matches kept more often.
export const LOCAL_CONFIDENCE_FLOOR = 60;

/** Read the AudD token at runtime — Vite injects VITE_* env vars at build. */
export function getAuddToken() {
  // eslint-disable-next-line no-undef
  return import.meta.env.VITE_AUDD_API_TOKEN || 'test';
}

/** Whether the configured token is the public sandbox (very low rate limit). */
export function isSandboxToken() {
  return getAuddToken() === 'test';
}

/**
 * Send a recorded audio blob to AudD's humming-recognition endpoint.
 * Returns a normalized array of matches: [{ title, artist, confidence, source: 'audd' }, ...]
 *
 * Throws on network error so callers can show a clear "fallback failed" UI.
 */
export async function recognizeWithAudD(audioBlob, options = {}) {
  const { token = getAuddToken(), maxResults = 5 } = options;

  if (!audioBlob) {
    throw new Error('No audio recording to send to AudD');
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'humming.webm');
  formData.append('api_token', token);
  formData.append('method', 'recognizeWithOffset');

  console.log('☁️  Calling AudD cloud fallback...');
  const response = await fetch(AUDD_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`AudD HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  console.log('☁️  AudD response:', json);

  if (json.status === 'error') {
    throw new Error(`AudD API error: ${json.error?.error_message || 'unknown'}`);
  }

  if (json.status !== 'success' || !json.result) {
    return []; // success but no match found
  }

  // Two response shapes depending on how AudD classified the audio:
  //   1. Humming: result.list = [{score, artist, title, ...}, ...]
  //   2. Recorded music: result = {title, artist, album, ...} (single)
  const matches = [];

  if (Array.isArray(json.result.list)) {
    for (const item of json.result.list) {
      matches.push({
        title: item.title || 'Unknown',
        artist: item.artist || 'Unknown',
        confidence: typeof item.score === 'number' ? item.score : 50,
        source: 'audd-humming',
      });
    }
  } else if (json.result.title) {
    matches.push({
      title: json.result.title,
      artist: json.result.artist || 'Unknown',
      confidence: 95, // AudD doesn't return a score for recorded-music hits
      source: 'audd-recorded',
    });
  }

  return matches.slice(0, maxResults);
}

/**
 * Decide whether the local matches are confident enough or we should fall back.
 * Logic: if the top local match is below the floor, OR if the top 3 matches are
 * within 5% of each other (no clear winner), trigger the cloud fallback.
 */
export function shouldUseFallback(localMatches) {
  if (!localMatches || localMatches.length === 0) return true;
  const top = localMatches[0]?.confidence ?? 0;
  if (top < LOCAL_CONFIDENCE_FLOOR) return true;

  // No clear winner: top 3 tightly clustered
  if (localMatches.length >= 3) {
    const spread = top - localMatches[2].confidence;
    if (spread < 5) return true;
  }
  return false;
}

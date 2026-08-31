# EarCandy — Competitive Landscape

Where EarCandy sits against existing products, split by the app's two parts:
**Part 1** (hum → identify a song) and **Part 2** (mood / valence–energy →
playlist). Each competitor is matched attribute-by-attribute against EarCandy
(top row, ⭐).

_Merged 2026-08-30 from two independent passes: Bobo's competitor matrix and a
store-level market scan (Google Play install brackets, Apple rating counts,
platform API terms). Where the two disagreed, the disagreement is resolved
inline and logged in [Corrections](#corrections-from-bobos-original). See also
[ROADMAP.md](ROADMAP.md)._

---

## Part 1 — Hum-to-Identify

| Product | Recognition method | Input modes | Catalog scale | Platform | Cost | Closest gap vs. EarCandy |
|---|---|---|---|---|---|---|
| **⭐ EarCandy** | **Classical DSP — autocorrelation + melody quantization, AudD cloud fallback** | **Hum / sing** | **~81-song demo (9,213 merged available)** | **Web (React/Vite)** | **Free / personal** | **— baseline —** |
| Google Hum to Search | Learned melody-embedding neural net (spectrogram → embedding) | Hum / whistle / sing | 500,000+ melody index at launch ¹ | Google app, Assistant, Search, Gemini, YouTube Music | Free | Trained model at massive scale; EarCandy can't match raw accuracy |
| YouTube Music | Same Google melody model | Hum / sing (Android) | Google index | Android (since May 2024) | Free w/ ads | Ships hum inside a 5bn-install app |
| Gemini | Same Google melody model | Hum / sing | Google index | iOS / Android (since Jun 2025) | Free | Hum recognition now inside a general assistant |
| Deezer SongCatcher | Humming added 2022 | Hum / sing / recording | 90M-track library | iOS / Android (100M+ installs) | Freemium | Hum **and** catalog **and** playback in one app |
| SoundHound / Midomi | Proprietary melody matching ("Sound2Sound") | Hum / sing | Millions | iOS / Android / web | Freemium | The OG (~2007) — but retreating, see note ² |
| Shazam | Audio fingerprinting **only — no humming** ³ | Recording | Very large | iOS / Android / web / OS-integrated | Free | Matches recordings, not melodies. The category leader never needed hum |
| AudD | Fingerprinting + humming endpoint (`recognizeWithOffset`) ⁴ | Recording; humming (secondary) | Large | Developer API (B2B) | $5 / 1,000 requests | **This is EarCandy's _dependency_, not a rival UI** |
| ACRCloud | Commercial humming API | Hum / sing / whistle | 1M+ song melody index | Developer API (B2B) | Sales-quoted, 14-day trial | Sells the capability to anyone — proof it's a commodity |
| AHA Music | Wraps ACRCloud fingerprint/humming (no own algo) | Hum / whistle / sing / upload | ACRCloud DB | Web + browser extension (1M users) | Free | Thin wrapper; no post-match mood layer. Lead-gen for ACRCloud |
| Musipedia / Melodyhound | Symbolic melody contour / Parsons code | Contour, keyboard, tapped rhythm, whistle | Curated / academic | Web (some Flash-broken) | Free | Symbolic, not audio ML; dated |
| Tunebot | Academic query-by-humming | Hum / sing / virtual keyboard | Research DB | Web (defunct/dated) | Free | Research precursor, not a consumer product |
| QQ Music | Built-in humming recognition (ACRCloud-class) | Hum / sing | Large (Tencent) | iOS / Android (China) | Freemium | Regional; no affect layer |
| "Song finder" clones | Fingerprinting only, despite ranking for hum queries | Recording | Varies | Android (largest: 10M+ installs) | Sub / ads | Two of the four largest were delisted from Play |

**Count of free hum implementations already on a typical phone: four** — Google
app, YouTube Music, Gemini, Deezer.

## Part 2 — Mood / Valence–Energy Recommendation

| Product | Mood model | 2D affect-map UI? | Journey / mood-arc? | Live consumer product? | Reach | Closest gap vs. EarCandy |
|---|---|---|---|---|---|---|
| **⭐ EarCandy** | **Russell circumplex; per-track valence/energy; Euclidean proximity** | **✅ Yes — draggable marker** | **✅ Yes — current→desired arc** | **Local only** | — | **— baseline —** + genre-weighted like-expand |
| Musicovery | 2D valence × arousal "mood pad" | ✅ Yes (the canonical one) | ❌ No (point → stream) | ❌ **No — consumer shut 2017, now B2B** | — | Closest UI ancestor. Died |
| Music eScape | 2D valence-arousal map, 8 emotion regions | ✅ Yes | ✅ **Yes** (savable, 15–60 min) | ❌ No (broke on iOS updates) | TestFlight | _Closest journey analog_ — validated in a 2019 JMIR RCT, then abandoned |
| MoodDJ | Emotion-regulation playlists (Spotify plugin) | ⚠️ Not documented ⁵ | ✅ Yes | ❌ Research prototype (2026) | — | Academic, unshipped; no hum |
| Moodagent | Proprietary ML emotion tagging; mood/tempo **sliders** | ❌ No (sliders, not a plane) | ❌ No | ❌ **No — delisted Dec 2023** ⁶ | Was 100K+ installs | Sliders ≠ spatial map. Also died |
| Mubert | Mood/activity channels over AI-generated audio | ❌ No | ❌ No | ⚠️ Abandoned — no update since Dec 2023 | 1M+ installs | Pivoted to creator tools + API |
| Aimi Player | Generative, mood/intensity controls | ❌ No | ❌ No | ⚠️ Stalled since Jul 2024 | ~110K installs | Raised $20M Series B and still got no pull |
| CORRD (Volumio) | Mood front-end over Tidal/Qobuz/Apple Music | ⚠️ Partial | ❌ No | ✅ Yes | 10K+ installs | **The ceiling for a mood UI on a licensed catalog** |
| Endel | Context-driven **generative** soundscapes | ❌ No | ❌ No (state modes) | ✅ Yes — #64 top-grossing H&F (US) | 1M+ installs, $22.1M raised | Generates audio, doesn't recommend songs — different category |
| Brain.fm | Functional music (focus/relax/sleep) | ❌ No | ❌ No | ✅ Yes — #76 top-grossing H&F (US) | 1M+ installs | Functional categories; no affect map or catalog recommend |
| Spotify | Valence/energy features + daylist / AI DJ / Prompted Playlists | ❌ No (hidden behind playlists) | ❌ No | ✅ Yes (dominant) | AI DJ has reached 94M Premium users | Has the data + scale, deliberately hides the plane |
| Apple Music | 250+ mood & activity playlists, "Find Your Mood" stations | ❌ No | ❌ No | ✅ Yes | Bundled | Free inside a subscription users already pay for |
| Amazon Maestro | Prompt-based — emotions, emoji, activities | ❌ No | ❌ No | ✅ Yes | Bundled | Same |
| Deezer Flow Moods | Mood buttons on Flow, since 2021 | ❌ No | ❌ No | ✅ Yes | Bundled | Same — and it also does hum |
| Gnoosic | Band similarity (yes/no feedback) | ❌ No | ❌ No | ✅ Yes | Web | Artist-similarity, not a mood model at all |
| 8tracks / stereomood | Mood-**word** tags → curated playlists | ❌ No (word taxonomy) | ❌ No | ⚠️ Mixed (stereomood defunct) | Web | Mood labels, not a spatial plane |
| MoodLogic | Collaborative mood tagging | ❌ No | ❌ No | ❌ No (defunct 2008) | Desktop | Historical precursor only |

---

## The half Bobo's matrix didn't cover: can it ship?

A feature comparison answers "is this novel." It does not answer "can this
reach users." On the second question the picture is harder, and it is the
binding constraint.

### Spotify has closed

| Constraint | Detail |
|---|---|
| Development mode | **5 authenticated users**, allowlisted. App owner must hold Spotify **Premium** (new, Feb 2026) |
| Extended quota | Requires a registered **business entity**, a launched service, **250,000 MAU**, proof of revenue over 12 months. **Individuals cannot apply** (since May 2025) |
| Audio Features endpoint | **Cut off for all new apps on 27 Nov 2024.** Valence, energy, danceability, tempo — gone |
| Audio Analysis, Recommendations, Related Artists | Same date, same status |
| Search | Results capped at **10** (was 50) as of Feb 2026 |
| Spotify's own words | Development mode "should not be relied on as a foundation for building or scaling a business" |

**What this means concretely.** EarCandy's mood engine runs on Spotify valence
and energy values. The 1,097-track Spotify pool in the repo is a static
snapshot, and it is now the *only* way the project will ever hold that data.
There is no endpoint that will tell you the mood of a song you don't already
have.

### There is no "playlist URL"

Spotify playlist creation is bound to an authenticated user. No URI scheme, no
deep link, no client-credentials path. The user-visible outcome is still
reachable — the **Soundiiz Import API** takes a POSTed tracklist (no auth, up
to 200 tracks), returns a share URL, and the user authorizes *Soundiiz* to
write the playlist into their Spotify. EarCandy never touches Spotify OAuth.

### Where a small app can still write playlists

| Platform | Ship to unlimited users? | Real gate |
|---|---|---|
| **Apple Music (MusicKit)** | **Yes** | $99/yr Apple Developer Program. No MAU gate |
| YouTube Data API | Yes, after OAuth verification | 100 users until verified; ~100 searches/day for matching |
| TIDAL | Probably | Thin docs, small audience, undocumented limits |
| Spotify | **No** | 250K MAU + business entity + revenue |
| Deezer | **No** | New API registration disabled since 2025 (abuse) |
| Amazon Music | **No** | Closed beta, partner-only |

---

## Verdict — where the moat is

| Element | Bobo's read | Merged read |
|---|---|---|
| Hum recognition | ❌ Weak — crowded | ❌ Weak — **and now four free implementations ship on a typical phone** |
| Regional 12-genre taxonomy | ⚠️ Weak alone | ⚠️ Weak alone — but see the sharpening move below |
| User-facing 2D affect map | ✅ Strong — niche vacant since 2017 | ⚠️ **Vacant ≠ available.** Four companies tried and failed here |
| Journey mode | ✅ Strong — academically validated, commercially unshipped | ✅ **Agreed — the strongest single element** |
| Hum → mood-journey pipeline | ✅✅ Genuinely novel | ✅ Novel, **unproven** — no one has tested demand |
| Distribution / catalog rights | _(not covered)_ | ❌ **The binding constraint.** Solve before building more features |

**Bottom line.** Both passes independently reached the same conclusion about
novelty: recognition is table stakes, and the *live 2D map + journey mode + hum
input* intersection has no single competitor filling all three. That empty
intersection is real.

The correction is in how to read the emptiness. The 2D affect map isn't vacant
because nobody thought of it — Musicovery shipped exactly this and closed in
2017, Moodagent shipped mood sliders and was delisted, Mubert was abandoned,
Aimi stalled with $20M behind it. None of them lost to a better mood app. They
lost because mood picking became a free feature inside Spotify, Apple Music,
Amazon and Deezer, and because the catalog is the asset and someone else owns
it. A mood front-end over a licensed catalog caps out around CORRD's 10,000
installs.

**The two products that did make money — Endel and Brain.fm — won by not
selling mood at all.** They sell a functional outcome (focus, sleep, calm), on
generative audio they own rather than licence, priced as wellness at $100–180 a
year. Both chart in Health & Fitness top-grossing, neither in Music. That is
the only demonstrated revenue path in this space, and journey mode — mood
*regulation*, not mood matching — is the one EarCandy feature that could
plausibly be framed that way.

**Sharpening move (from Bobo, endorsed).** No major platform fuses a regional
world-genre taxonomy with a spatial affect model. Folding the 12 regional
categories *into* the mood engine — region + mood proximity together in the
like-expand, rather than genre as a separate filter — turns the weakest
differentiator into part of the moat. This is already half-built: 3e's cluster
flavor uses a `+0.06` same-genre affinity term.

---

## Hum recognition at unlimited scale — is there an avenue?

**Yes. Recognition is the least gated part of the whole product.** No platform
owns query-by-humming, no one requires approval to do it, and Spotify was never
in this path — it has never offered song recognition of any kind. The Spotify
lockdown constrains the *mood data* and the *playlist write*, not the hum.

The real constraints are cost per query and melody-index size.

| Route | User cap | Cost | Index | Trade-off |
|---|---|---|---|---|
| **EarCandy's own DSP** | None | Hosting only | Yours — 81 live / 9,213 merged | Free and unlimited; accuracy and index size are the limit |
| **AudD** (current fallback) | None | **$5 / 1,000 requests**, ~$2/1,000 at volume; 300 free | Large | Already wired in. 100K hums/mo ≈ $450–500 |
| **ACRCloud** | None | Sales-quoted; 14-day free trial | **1M+ song melody index** | The most capable hosted hum index available to buy |
| Google / Apple | — | — | — | **No public hum API.** Not purchasable at any price |

**Recommended shape: tiered, with the paid call as the exception.** Run the
local pipeline first, and only fall through to AudD or ACRCloud when local
confidence is low — which is exactly the architecture already in the repo. That
keeps marginal cost near zero for the common case and buys accuracy only where
it's needed. Auto-tuning thresholds by database size (already shipped) is the
lever that controls the spend.

**The bigger lever is the index, not the API.** Local coverage is what decides
how often you pay. Growing the melody index from the merged 9,213-song database
toward a six-figure index — melody contours can be extracted from MIDI corpora
or from audio you already process — cuts fallback rate directly, and unlike
every other part of this product, nobody can revoke it.

**Ceiling to be honest about.** Google's melody model is trained at a scale
EarCandy cannot reach, and Google gives it away free inside four surfaces. Hum
recognition should be treated as a *front door* that must work well enough not
to embarrass the product — not as the thing that wins users.

---

## Corrections from Bobo's original

| Claim | Original | Corrected | Why |
|---|---|---|---|
| Shazam humming | "reportedly added ¹, unconfirmed" | **Does not support humming** | ACRCloud documents it as fingerprint-only; Shazam shows an in-app warning about singing in some markets. Confirmed negative, not ambiguous |
| Moodagent | "✅ Live consumer product (mostly B2B now)" | **❌ Delisted Dec 2023** | Removed from Google Play; Apple lookup returns no result. B2C paused Apr 2022 |
| Spotify audio features | Cited as a live primary source | **Deprecated for new apps 27 Nov 2024** | Directly affects EarCandy's mood engine |
| SoundHound | "more mature at the exact same promise" | **Retreating, not competing** | Parent's entire $168.9M FY2025 revenue is enterprise voice AI; music app absent from financials; midomi web retired Feb 2025; Play rating down to 3.61 |
| Google melody catalog | "50M+ songs" | **500,000+ at launch** ¹ | 50M+ looks like the fingerprint catalog, not the melody index. Flagged rather than settled — needs a current source |
| Missing hum implementations | — | **Added Deezer, Gemini, YouTube Music** | Three more free hum surfaces strengthen the "table stakes" conclusion |
| Missing mood competitors | — | **Added Mubert, Aimi, CORRD, Apple/Amazon/Deezer** | CORRD in particular establishes the ceiling for the licensed-catalog approach |
| Distribution | Not covered | **New section** | Determines whether any of the moat is reachable |

**Kept from Bobo unchanged, and worth keeping:** AudD framed as a dependency
rather than a rival; the Music eScape and MoodDJ prior art (neither surfaced in
the store-level scan, and Music eScape is the closest thing to journey mode
that has ever been validated); the historical layer (Musipedia, Tunebot,
MoodLogic, stereomood); and the regional-genre sharpening move.

---

### Verification footnotes

1. **Google melody index** — 500,000+ songs at the 2020 launch, versus ~100M for
   fingerprint-based Sound Search. Not re-verified for 2026; may have grown.
2. **SoundHound** — the app is maintained but strategically orphaned. Treat as
   declining, not as a live threat.
3. **Shazam humming** — confirmed *not* supported.
4. **AudD humming endpoint** — confirmed via [audd.io/doc](https://audd.io/doc/)
   + GitHub wiki, but under-documented. **Re-verify against the live API** before
   relying on it in production.
5. **MoodDJ** — a 2D-map UI was not documented in the
   [DIS 2026 paper](https://dl.acm.org/doi/10.1145/3800645.3812960); unconfirmed.

### Key sources

**Recognition**
- Google Hum to Search — [blog](https://blog.google/products-and-platforms/products/search/hum-to-search/), [ML research](https://research.google/blog/the-machine-learning-behind-hum-to-search/)
- SoundHound — [support](https://support.soundhound.com/hc/en-us/articles/23816891690131-Searching-For-Music) · [FY2025 results](https://investors.soundhound.com/news-releases/news-release-details/soundhound-ai-reports-record-annual-revenue-169-million-nearly)
- Shazam is fingerprint-only — [ACRCloud](https://www.acrcloud.com/blog/what-is-query-by-humming/)
- AudD — [docs](https://audd.io/doc/) · [pricing](https://audd.io/resources/articles/music-recognition-api-pricing.html)
- ACRCloud humming — [product page](https://www.acrcloud.com/humming-recognition/)

**Mood & recommendation**
- Musicovery — [Wikipedia](https://en.wikipedia.org/wiki/Musicovery) · Moodagent — [Wikipedia](https://en.wikipedia.org/wiki/Moodagent)
- Music eScape — [JMIR mHealth 2019 RCT](https://mhealth.jmir.org/2019/1/e11482/)
- MoodDJ — [ACM DIS 2026](https://dl.acm.org/doi/10.1145/3800645.3812960)
- Spotify AI DJ reach — [Spotify Newsroom](https://newsroom.spotify.com/2026-05-07/dj-expansion-4-new-languages/)

**Platform terms**
- Spotify quota modes — [developer.spotify.com](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- Spotify Nov 2024 restrictions — [blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- Spotify Feb 2026 changelog — [changes](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)
- Dev-mode changes — [TechCrunch, Feb 2026](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)
- Apple MusicKit playlist creation — [Apple](https://developer.apple.com/documentation/applemusicapi/create-a-new-library-playlist)
- Soundiiz Import API — [docs](https://support.soundiiz.com/hc/en-us/articles/36613501259922-Let-your-users-import-any-tracklist-to-Soundiiz)
- Deezer API closed to new apps — [Deezer Community](https://en.deezercommunity.com/features-feedback-44/api-auth-impossible-80857)

**Store data** — Google Play install brackets and rating counts via
[AppBrain](https://www.appbrain.com/); Apple rating counts via Apple's public
lookup API. Apple does not publish download figures.

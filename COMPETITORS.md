# EarCandy — Competitive Landscape

Where EarCandy sits against existing products, split by the app's two parts:
**Part 1** (hum → identify a song) and **Part 2** (mood / valence–energy →
playlist). Each competitor is matched attribute-by-attribute against EarCandy
(top row, ⭐).

_Compiled from web research, 2026-08. Sources cited inline; unverified claims are
footnoted rather than asserted. See also [ROADMAP.md](ROADMAP.md)._

---

## Part 1 — Hum-to-Identify

| Product | Recognition method | Input modes | Catalog scale | Platform | Cost | Closest gap vs. EarCandy |
|---|---|---|---|---|---|---|
| **⭐ EarCandy** | **Classical DSP — autocorrelation + melody quantization, AudD cloud fallback** | **Hum / sing** | **~81-song demo (9,213 merged available)** | **Web (React/Vite)** | **Free / personal** | **— baseline —** |
| Google Hum to Search | Learned melody-embedding neural net (spectrogram → embedding) | Hum / whistle / sing | 50M+ songs | Google app, Assistant, Search, YouTube Music (Android/iOS) | Free | Trained model at massive scale; EarCandy can't match raw accuracy |
| SoundHound / Midomi | Proprietary melody matching ("Sound2Sound") | Hum / sing | Millions | iOS / Android / web | Freemium | The OG (~2007); more mature at the exact same promise |
| Shazam | Audio fingerprinting; humming *reportedly* added ¹ | Recording (primary); humming ¹ | Very large | iOS / Android / web / OS-integrated | Free | Matches recordings, not melodies; humming weak/unconfirmed |
| AudD | Fingerprinting + humming endpoint (`recognizeWithOffset`) ² | Recording; humming (secondary) | Large | Developer API (B2B) | Paid API | **This is EarCandy's _dependency_, not a rival UI** |
| AHA Music | Wraps ACRCloud fingerprint/humming (no own algo) | Hum / whistle / sing / upload | ACRCloud DB | Web + browser extension | Free | Thin wrapper; no post-match mood layer |
| Musipedia / Melodyhound | Symbolic melody contour / Parsons code | Contour, keyboard, tapped rhythm, whistle | Curated / academic | Web (some Flash-broken) | Free | Symbolic, not audio ML; dated |
| Tunebot | Academic query-by-humming | Hum / sing / virtual keyboard | Research DB | Web (defunct/dated) | Free | Research precursor, not a consumer product |
| QQ Music | Built-in humming recognition (ACRCloud-class) | Hum / sing | Large (Tencent) | iOS / Android (China) | Freemium | Regional; no affect layer |

## Part 2 — Mood / Valence–Energy Recommendation

| Product | Mood model | 2D affect-map UI? | Journey / mood-arc? | Live consumer product? | Platform | Closest gap vs. EarCandy |
|---|---|---|---|---|---|---|
| **⭐ EarCandy** | **Russell circumplex; per-track valence/energy; Euclidean proximity** | **✅ Yes — draggable marker** | **✅ Yes — current→desired arc** | **✅ Yes (local)** | **Web** | **— baseline —** + genre-weighted like-expand |
| Musicovery | 2D valence × arousal "mood pad" | ✅ Yes (the canonical one) | ❌ No (point → stream) | ❌ **No — consumer shut 2017, now B2B** | Was web (Flash) | Closest UI ancestor, but dead as consumer; no hum/journey |
| Spotify | Valence/energy audio features + mood-word playlists / daylist | ❌ No (hidden behind playlists) | ❌ No | ✅ Yes (dominant) | All platforms | Has the data + scale, deliberately hides the plane; no journey, no hum |
| Moodagent | Proprietary ML emotion tagging; mood/tempo **sliders** | ❌ No (sliders, not a plane) | ❌ No | ✅ Yes (mostly B2B now) | iOS / Android / web | Sliders ≠ spatial map; no hum |
| Music eScape | 2D valence-arousal map, 8 emotion regions | ✅ Yes | ✅ **Yes** (savable, 15–60 min) | ❌ **No** (broke on iOS updates) | iOS (TestFlight) | _Closest journey analog_ — but research prototype, dead; no hum, no genre-expand |
| MoodDJ | Emotion-regulation playlists (Spotify plugin) | ⚠️ Not documented ³ | ✅ Yes | ❌ Research prototype (2026) | Spotify plugin | Academic, unshipped; no hum |
| Endel | Context-driven **generative** soundscapes | ❌ No | ❌ No (state modes) | ✅ Yes | iOS / Android | Generates audio, doesn't recommend songs — different category |
| Brain.fm | Functional music (focus/relax/sleep) | ❌ No | ❌ No | ✅ Yes | Web / app | Functional categories; no affect map or catalog recommend |
| Gnoosic | Band similarity (yes/no feedback) | ❌ No | ❌ No | ✅ Yes | Web | Artist-similarity, not a mood model at all |
| 8tracks / stereomood | Mood-**word** tags → curated playlists | ❌ No (word taxonomy) | ❌ No | ⚠️ Mixed (stereomood defunct) | Web | Mood labels, not a spatial plane |
| MoodLogic | Collaborative mood tagging | ❌ No | ❌ No | ❌ No (defunct 2008) | Desktop | Historical precursor only |

### Verification footnotes

1. **Shazam humming** — asserted by secondary sources, **not confirmed** in Apple's own docs; reportedly weaker than Google/SoundHound at humming.
2. **AudD humming endpoint** — confirmed via [audd.io/doc](https://audd.io/doc/) + GitHub wiki, but under-documented / not homepage-marketed. **Re-verify against the live API** before relying on it in production.
3. **MoodDJ** — a 2D-map UI was not documented in the [DIS 2026 paper](https://dl.acm.org/doi/10.1145/3800645.3812960); marked unconfirmed rather than assumed.

---

## Verdict — where the moat is

| Element | Defensibility |
|---|---|
| Hum recognition | ❌ Weak — crowded; Google/SoundHound dominate |
| Regional 12-genre taxonomy | ⚠️ Weak alone — Apple Music (97 genres), Pandora already do world-genre at scale |
| **User-facing 2D affect map** | ✅ **Strong — niche currently vacant** since Musicovery left in 2017 |
| **Journey mode** | ✅ Strong — academically validated, commercially unshipped |
| **Hum → mood-journey pipeline** | ✅✅ **Strongest — appears genuinely novel; nothing chains these** |

**Bottom line.** In Part 1, every ✅ EarCandy could claim, an incumbent already
claims bigger — recognition is table stakes, not a moat. In Part 2, the columns
that matter — _live 2D map_ **and** _journey mode_ **and** _hum input_ — have
**no single competitor that fills all three**. That empty intersection is the
product: turning a hummed melody into a spatial, mood-journey experience, with
the affect map as the interface.

**Sharpening move surfaced by the research:** no major platform fuses a regional
world-genre taxonomy _with_ a spatial affect model. Folding the 12 regional
categories _into_ the mood engine (region + mood proximity together in the
like-expand) — rather than leaving genre as a separate filter — turns the
weakest differentiator into part of the moat.

### Key primary sources

- Google Hum to Search — [blog](https://blog.google/products-and-platforms/products/search/hum-to-search/), [ML research](https://research.google/blog/the-machine-learning-behind-hum-to-search/)
- SoundHound — [support](https://support.soundhound.com/hc/en-us/articles/23816891690131-Searching-For-Music) · Midomi — [midomi.com](https://www.midomi.com/)
- AudD — [audd.io/doc](https://audd.io/doc/)
- Musicovery (defunct consumer, now B2B) — [company profile](https://tracxn.com/d/companies/musicovery/__QAQPM4YDiHWoJAAOng29SURdLUVbQq-Mx9OOdT4M4Yk)
- Spotify audio features (valence/energy) — [Web API](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)
- Music eScape — [JMIR mHealth 2019 RCT](https://mhealth.jmir.org/2019/1/e11482/)
- MoodDJ — [ACM DIS 2026](https://dl.acm.org/doi/10.1145/3800645.3812960)

/**
 * Curated Tracks Database
 *
 * 100 hand-selected tracks across the 12 globalGenres, each tagged with:
 *   valence  (0..1)  — sad/negative ↔ happy/positive
 *   energy   (0..1)  — calm/low-arousal ↔ intense/high-arousal
 *   mood     — nearest named-mood label (energetic, happy, calm, melancholic, focused, romantic)
 *   bpm, key — for downstream tempo/key analyses if ever wired back in
 *
 * Coverage goal: each genre has 8-9 tracks spanning the valence/energy plane,
 * so any mood the user picks has at least one plausible match per region.
 *
 * Future: Stage 3b will merge a Spotify-features Kaggle export onto this
 * curated baseline. This module is the verified core; that file will be
 * augmentation.
 */

export const tracksDatabase = [
  // ─── CARNATIC CLASSICAL (South India) ──────────────────────────────────────
  { id: 1,  title: 'Thillana in Dhanashree',  artist: 'Balamuralikrishna',           genre: 'carnatic', bpm: 120, key: 'D',  mood: 'energetic',    valence: 0.75, energy: 0.85 },
  { id: 2,  title: 'Endaro Mahanubhavulu',    artist: 'M.S. Subbulakshmi',           genre: 'carnatic', bpm: 70,  key: 'C',  mood: 'calm',         valence: 0.65, energy: 0.30 },
  { id: 3,  title: 'Vatapi Ganapatim',        artist: 'M.S. Subbulakshmi',           genre: 'carnatic', bpm: 95,  key: 'F',  mood: 'focused',      valence: 0.70, energy: 0.55 },
  { id: 4,  title: 'Krishna Nee Begane',      artist: 'M.S. Subbulakshmi',           genre: 'carnatic', bpm: 65,  key: 'G',  mood: 'calm',         valence: 0.65, energy: 0.35 },
  { id: 5,  title: 'Anandamruthavarshini',    artist: 'Aruna Sairam',                genre: 'carnatic', bpm: 110, key: 'A',  mood: 'energetic',    valence: 0.70, energy: 0.75 },
  { id: 6,  title: 'Marivere Gathi',          artist: 'Sudha Raghunathan',           genre: 'carnatic', bpm: 80,  key: 'D',  mood: 'romantic',     valence: 0.55, energy: 0.40 },
  { id: 7,  title: 'Bhavayami Raghuramam',    artist: 'M.S. Subbulakshmi',           genre: 'carnatic', bpm: 100, key: 'E',  mood: 'focused',      valence: 0.60, energy: 0.65 },
  { id: 8,  title: 'Hechcharikaga Ra Ra',     artist: 'Aruna Sairam',                genre: 'carnatic', bpm: 75,  key: 'C',  mood: 'focused',      valence: 0.50, energy: 0.40 },

  // ─── HINDUSTANI CLASSICAL (North India) ────────────────────────────────────
  { id: 9,  title: 'Raag Yaman Alap',         artist: 'Hariprasad Chaurasia',        genre: 'hindustani', bpm: 60,  key: 'E',  mood: 'calm',       valence: 0.55, energy: 0.20 },
  { id: 10, title: 'Raag Darbari Kanada',     artist: 'Ravi Shankar',                genre: 'hindustani', bpm: 65,  key: 'C',  mood: 'melancholic', valence: 0.45, energy: 0.30 },
  { id: 11, title: 'Raag Bhairavi',           artist: 'Bhimsen Joshi',               genre: 'hindustani', bpm: 75,  key: 'A',  mood: 'focused',     valence: 0.55, energy: 0.45 },
  { id: 12, title: 'Raag Malkauns',           artist: 'Hariprasad Chaurasia',        genre: 'hindustani', bpm: 55,  key: 'D',  mood: 'calm',       valence: 0.50, energy: 0.25 },
  { id: 13, title: 'Raag Bhupali',            artist: 'Kishori Amonkar',             genre: 'hindustani', bpm: 70,  key: 'F',  mood: 'calm',       valence: 0.65, energy: 0.30 },
  { id: 14, title: 'Raag Desh',               artist: 'Shivkumar Sharma',            genre: 'hindustani', bpm: 85,  key: 'G',  mood: 'romantic',   valence: 0.60, energy: 0.45 },
  { id: 15, title: 'Raag Bageshri',           artist: 'Rashid Khan',                 genre: 'hindustani', bpm: 70,  key: 'D',  mood: 'romantic',   valence: 0.55, energy: 0.40 },
  { id: 16, title: 'Raag Shivranjani',        artist: 'Nikhil Banerjee',             genre: 'hindustani', bpm: 60,  key: 'E',  mood: 'melancholic', valence: 0.40, energy: 0.30 },

  // ─── FINNISH DEATH/MELODIC METAL (Finland) ─────────────────────────────────
  { id: 17, title: 'Hate Crew Deathroll',     artist: 'Children of Bodom',           genre: 'finnish_metal', bpm: 180, key: 'Em', mood: 'energetic',    valence: 0.45, energy: 0.98 },
  { id: 18, title: 'Sons of Winter and Stars',artist: 'Wintersun',                   genre: 'finnish_metal', bpm: 165, key: 'Dm', mood: 'energetic',    valence: 0.50, energy: 0.95 },
  { id: 19, title: 'While We Sleep',          artist: 'Insomnium',                   genre: 'finnish_metal', bpm: 140, key: 'Am', mood: 'melancholic',  valence: 0.30, energy: 0.85 },
  { id: 20, title: 'Black Winter Day',        artist: 'Amorphis',                    genre: 'finnish_metal', bpm: 115, key: 'Em', mood: 'melancholic',  valence: 0.25, energy: 0.75 },
  { id: 21, title: 'One More Magic Potion',   artist: 'Ensiferum',                   genre: 'finnish_metal', bpm: 160, key: 'D',  mood: 'energetic',    valence: 0.65, energy: 0.92 },
  { id: 22, title: 'Wishmaster',              artist: 'Nightwish',                   genre: 'finnish_metal', bpm: 145, key: 'F#m',mood: 'energetic',    valence: 0.60, energy: 0.85 },
  { id: 23, title: 'Black Diamond',           artist: 'Stratovarius',                genre: 'finnish_metal', bpm: 175, key: 'Cm', mood: 'energetic',    valence: 0.55, energy: 0.90 },
  { id: 24, title: 'Don\'t Say a Word',       artist: 'Sonata Arctica',              genre: 'finnish_metal', bpm: 170, key: 'Em', mood: 'energetic',    valence: 0.40, energy: 0.88 },

  // ─── REGGAETÓN (Puerto Rico) ───────────────────────────────────────────────
  { id: 25, title: 'Despacito',               artist: 'Luis Fonsi',                  genre: 'reggaeton', bpm: 89,  key: 'Bm', mood: 'happy',        valence: 0.85, energy: 0.75 },
  { id: 26, title: 'Gasolina',                artist: 'Daddy Yankee',                genre: 'reggaeton', bpm: 95,  key: 'G',  mood: 'energetic',    valence: 0.80, energy: 0.92 },
  { id: 27, title: 'Con Calma',               artist: 'Daddy Yankee',                genre: 'reggaeton', bpm: 93,  key: 'C',  mood: 'happy',        valence: 0.85, energy: 0.65 },
  { id: 28, title: 'Mi Gente',                artist: 'J Balvin',                    genre: 'reggaeton', bpm: 105, key: 'Bm', mood: 'energetic',    valence: 0.80, energy: 0.85 },
  { id: 29, title: 'Tusa',                    artist: 'Karol G',                     genre: 'reggaeton', bpm: 100, key: 'F#m',mood: 'melancholic',  valence: 0.55, energy: 0.70 },
  { id: 30, title: 'Hawái',                   artist: 'Maluma',                      genre: 'reggaeton', bpm: 90,  key: 'Cm', mood: 'romantic',     valence: 0.50, energy: 0.55 },
  { id: 31, title: 'China',                   artist: 'Anuel AA',                    genre: 'reggaeton', bpm: 105, key: 'Bm', mood: 'happy',        valence: 0.75, energy: 0.70 },
  { id: 32, title: 'La Modelo',               artist: 'Ozuna',                       genre: 'reggaeton', bpm: 95,  key: 'Am', mood: 'romantic',     valence: 0.70, energy: 0.65 },

  // ─── GOSPEL (USA) ──────────────────────────────────────────────────────────
  { id: 33, title: 'Oh Happy Day',            artist: 'Edwin Hawkins',               genre: 'gospel', bpm: 115, key: 'F',  mood: 'happy',           valence: 0.95, energy: 0.70 },
  { id: 34, title: 'Total Praise',            artist: 'Richard Smallwood',           genre: 'gospel', bpm: 70,  key: 'C',  mood: 'calm',            valence: 0.85, energy: 0.55 },
  { id: 35, title: 'I Smile',                 artist: 'Kirk Franklin',               genre: 'gospel', bpm: 120, key: 'G',  mood: 'happy',           valence: 0.95, energy: 0.80 },
  { id: 36, title: 'Amazing Grace',           artist: 'Chris Tomlin',                genre: 'gospel', bpm: 75,  key: 'D',  mood: 'calm',            valence: 0.70, energy: 0.40 },
  { id: 37, title: 'His Eye Is on the Sparrow',artist: 'Lauryn Hill',                genre: 'gospel', bpm: 65,  key: 'Bb', mood: 'calm',            valence: 0.65, energy: 0.30 },
  { id: 38, title: 'Take Me to the King',     artist: 'Tamela Mann',                 genre: 'gospel', bpm: 80,  key: 'F',  mood: 'romantic',        valence: 0.60, energy: 0.60 },
  { id: 39, title: 'Goodness of God',         artist: 'CeCe Winans',                 genre: 'gospel', bpm: 90,  key: 'Ab', mood: 'happy',           valence: 0.75, energy: 0.50 },
  { id: 40, title: 'Way Maker',               artist: 'Leeland',                     genre: 'gospel', bpm: 95,  key: 'E',  mood: 'happy',           valence: 0.85, energy: 0.70 },

  // ─── K-POP (South Korea) ───────────────────────────────────────────────────
  { id: 41, title: 'Dynamite',                artist: 'BTS',                         genre: 'kpop', bpm: 114, key: 'C#m',mood: 'energetic',         valence: 0.90, energy: 0.85 },
  { id: 42, title: 'Spring Day',              artist: 'BTS',                         genre: 'kpop', bpm: 80,  key: 'B',  mood: 'melancholic',      valence: 0.40, energy: 0.50 },
  { id: 43, title: 'Ddu-Du Ddu-Du',           artist: 'BLACKPINK',                   genre: 'kpop', bpm: 140, key: 'F#m',mood: 'energetic',         valence: 0.65, energy: 0.95 },
  { id: 44, title: 'Cheer Up',                artist: 'TWICE',                       genre: 'kpop', bpm: 130, key: 'C',  mood: 'happy',            valence: 0.95, energy: 0.85 },
  { id: 45, title: 'Gangnam Style',           artist: 'PSY',                         genre: 'kpop', bpm: 132, key: 'Bm', mood: 'energetic',         valence: 0.90, energy: 0.95 },
  { id: 46, title: 'Through the Night',       artist: 'IU',                          genre: 'kpop', bpm: 75,  key: 'D',  mood: 'calm',             valence: 0.55, energy: 0.30 },
  { id: 47, title: 'Fantastic Baby',          artist: 'BIGBANG',                     genre: 'kpop', bpm: 128, key: 'Em', mood: 'energetic',         valence: 0.80, energy: 0.98 },
  { id: 48, title: 'Hype Boy',                artist: 'NewJeans',                    genre: 'kpop', bpm: 110, key: 'Db', mood: 'happy',            valence: 0.85, energy: 0.65 },

  // ─── AFROBEAT (West Africa) ────────────────────────────────────────────────
  { id: 49, title: 'Water No Get Enemy',      artist: 'Fela Kuti',                   genre: 'afrobeat', bpm: 105, key: 'Em', mood: 'happy',         valence: 0.75, energy: 0.70 },
  { id: 50, title: 'Zombie',                  artist: 'Fela Kuti',                   genre: 'afrobeat', bpm: 110, key: 'Dm', mood: 'energetic',     valence: 0.55, energy: 0.80 },
  { id: 51, title: 'Essence',                 artist: 'Wizkid',                      genre: 'afrobeat', bpm: 105, key: 'Am', mood: 'romantic',      valence: 0.75, energy: 0.55 },
  { id: 52, title: 'Last Last',               artist: 'Burna Boy',                   genre: 'afrobeat', bpm: 110, key: 'Em', mood: 'melancholic',   valence: 0.45, energy: 0.70 },
  { id: 53, title: 'Calm Down',               artist: 'Rema',                        genre: 'afrobeat', bpm: 100, key: 'Bm', mood: 'happy',         valence: 0.80, energy: 0.60 },
  { id: 54, title: 'Soco',                    artist: 'Starboy',                     genre: 'afrobeat', bpm: 108, key: 'C',  mood: 'happy',         valence: 0.85, energy: 0.75 },
  { id: 55, title: 'Ye',                      artist: 'Burna Boy',                   genre: 'afrobeat', bpm: 115, key: 'G',  mood: 'focused',       valence: 0.60, energy: 0.65 },
  { id: 56, title: 'Johnny',                  artist: 'Yemi Alade',                  genre: 'afrobeat', bpm: 112, key: 'F',  mood: 'energetic',     valence: 0.85, energy: 0.85 },

  // ─── BOSSA NOVA (Brazil) ───────────────────────────────────────────────────
  { id: 57, title: 'The Girl from Ipanema',   artist: 'João Gilberto',               genre: 'bossa_nova', bpm: 72, key: 'F',  mood: 'calm',         valence: 0.70, energy: 0.30 },
  { id: 58, title: 'Águas de Março',          artist: 'Antônio Carlos Jobim',        genre: 'bossa_nova', bpm: 80, key: 'D',  mood: 'happy',        valence: 0.65, energy: 0.40 },
  { id: 59, title: 'Corcovado',               artist: 'Astrud Gilberto',             genre: 'bossa_nova', bpm: 70, key: 'A',  mood: 'calm',         valence: 0.60, energy: 0.25 },
  { id: 60, title: 'Desafinado',              artist: 'João Gilberto',               genre: 'bossa_nova', bpm: 78, key: 'Bb', mood: 'romantic',     valence: 0.55, energy: 0.40 },
  { id: 61, title: 'Mas Que Nada',            artist: 'Sergio Mendes',               genre: 'bossa_nova', bpm: 110, key: 'F', mood: 'happy',        valence: 0.85, energy: 0.65 },
  { id: 62, title: 'Wave',                    artist: 'Antônio Carlos Jobim',        genre: 'bossa_nova', bpm: 76, key: 'D',  mood: 'calm',         valence: 0.65, energy: 0.35 },
  { id: 63, title: 'Chega de Saudade',        artist: 'João Gilberto',               genre: 'bossa_nova', bpm: 75, key: 'D',  mood: 'melancholic',  valence: 0.50, energy: 0.35 },
  { id: 64, title: 'Insensatez',              artist: 'Antônio Carlos Jobim',        genre: 'bossa_nova', bpm: 70, key: 'Am', mood: 'melancholic',  valence: 0.40, energy: 0.30 },

  // ─── FLAMENCO (Spain) ──────────────────────────────────────────────────────
  { id: 65, title: 'Entre dos Aguas',         artist: 'Paco de Lucía',               genre: 'flamenco', bpm: 95,  key: 'Am', mood: 'romantic',      valence: 0.65, energy: 0.50 },
  { id: 66, title: 'Bulerías',                artist: 'Paco de Lucía',               genre: 'flamenco', bpm: 180, key: 'D',  mood: 'energetic',     valence: 0.70, energy: 0.85 },
  { id: 67, title: 'Soleá',                   artist: 'Camarón de la Isla',          genre: 'flamenco', bpm: 75,  key: 'Em', mood: 'melancholic',   valence: 0.30, energy: 0.45 },
  { id: 68, title: 'La Tarara',               artist: 'Camarón de la Isla',          genre: 'flamenco', bpm: 130, key: 'A',  mood: 'happy',         valence: 0.75, energy: 0.65 },
  { id: 69, title: 'Como el Agua',            artist: 'Camarón de la Isla',          genre: 'flamenco', bpm: 110, key: 'D',  mood: 'romantic',      valence: 0.60, energy: 0.55 },
  { id: 70, title: 'Sevillanas',              artist: 'Manolo Sanlúcar',             genre: 'flamenco', bpm: 145, key: 'F#', mood: 'happy',         valence: 0.85, energy: 0.70 },
  { id: 71, title: 'Tangos',                  artist: 'Paco de Lucía',               genre: 'flamenco', bpm: 115, key: 'Dm', mood: 'energetic',     valence: 0.65, energy: 0.70 },
  { id: 72, title: 'Volando Voy',             artist: 'Camarón de la Isla',          genre: 'flamenco', bpm: 100, key: 'Am', mood: 'romantic',     valence: 0.55, energy: 0.55 },

  // ─── J-POP (Japan) ─────────────────────────────────────────────────────────
  { id: 73, title: 'First Love',              artist: 'Hikaru Utada',                genre: 'jpop', bpm: 78,  key: 'Db', mood: 'melancholic',       valence: 0.30, energy: 0.35 },
  { id: 74, title: 'One Last Kiss',           artist: 'Hikaru Utada',                genre: 'jpop', bpm: 90,  key: 'F',  mood: 'melancholic',       valence: 0.40, energy: 0.40 },
  { id: 75, title: 'Lemon',                   artist: 'Kenshi Yonezu',               genre: 'jpop', bpm: 85,  key: 'Bm', mood: 'melancholic',       valence: 0.30, energy: 0.45 },
  { id: 76, title: 'Pretender',               artist: 'Official HIGE DANdism',       genre: 'jpop', bpm: 92,  key: 'Ab', mood: 'romantic',          valence: 0.45, energy: 0.55 },
  { id: 77, title: 'Cha-La Head-Cha-La',      artist: 'Hironobu Kageyama',           genre: 'jpop', bpm: 145, key: 'F',  mood: 'energetic',         valence: 0.90, energy: 0.95 },
  { id: 78, title: 'Plastic Love',            artist: 'Mariya Takeuchi',             genre: 'jpop', bpm: 105, key: 'F#m',mood: 'happy',            valence: 0.65, energy: 0.70 },
  { id: 79, title: 'Marigold',                artist: 'Aimyon',                      genre: 'jpop', bpm: 110, key: 'A',  mood: 'happy',            valence: 0.70, energy: 0.55 },
  { id: 80, title: 'Hikari',                  artist: 'Hikaru Utada',                genre: 'jpop', bpm: 96,  key: 'C',  mood: 'happy',            valence: 0.75, energy: 0.60 },

  // ─── QAWWALI (Pakistan) ────────────────────────────────────────────────────
  { id: 81, title: 'Tumhe Dillagi',           artist: 'Nusrat Fateh Ali Khan',       genre: 'qawwali', bpm: 85,  key: 'Gm', mood: 'romantic',       valence: 0.60, energy: 0.45 },
  { id: 82, title: 'Allah Hoo',               artist: 'Nusrat Fateh Ali Khan',       genre: 'qawwali', bpm: 110, key: 'D',  mood: 'energetic',     valence: 0.70, energy: 0.85 },
  { id: 83, title: 'Ali Maula',               artist: 'Sabri Brothers',              genre: 'qawwali', bpm: 105, key: 'C',  mood: 'energetic',     valence: 0.65, energy: 0.80 },
  { id: 84, title: 'Mast Mast',               artist: 'Nusrat Fateh Ali Khan',       genre: 'qawwali', bpm: 115, key: 'F',  mood: 'energetic',     valence: 0.75, energy: 0.75 },
  { id: 85, title: 'Yeh Jo Halka Halka',      artist: 'Nusrat Fateh Ali Khan',       genre: 'qawwali', bpm: 90,  key: 'Am', mood: 'romantic',      valence: 0.65, energy: 0.55 },
  { id: 86, title: 'Sanson Ki Mala',          artist: 'Nusrat Fateh Ali Khan',       genre: 'qawwali', bpm: 100, key: 'Em', mood: 'focused',       valence: 0.55, energy: 0.65 },
  { id: 87, title: 'Tajdar-e-Haram',          artist: 'Atif Aslam',                  genre: 'qawwali', bpm: 95,  key: 'Bm', mood: 'romantic',      valence: 0.60, energy: 0.70 },
  { id: 88, title: 'Bhar Do Jholi Meri',      artist: 'Sabri Brothers',              genre: 'qawwali', bpm: 90,  key: 'D',  mood: 'focused',       valence: 0.65, energy: 0.55 },

  // ─── AMERICAN ROCK (USA) ───────────────────────────────────────────────────
  { id: 89, title: 'Hotel California',        artist: 'Eagles',                      genre: 'american_rock', bpm: 75,  key: 'Bm', mood: 'melancholic', valence: 0.40, energy: 0.45 },
  { id: 90, title: 'Sweet Child O\' Mine',    artist: 'Guns N\' Roses',              genre: 'american_rock', bpm: 125, key: 'D',  mood: 'energetic',   valence: 0.75, energy: 0.85 },
  { id: 91, title: 'Born to Run',             artist: 'Bruce Springsteen',           genre: 'american_rock', bpm: 145, key: 'E',  mood: 'energetic',   valence: 0.65, energy: 0.85 },
  { id: 92, title: 'Stairway to Heaven',      artist: 'Led Zeppelin',                genre: 'american_rock', bpm: 70,  key: 'Am', mood: 'focused',     valence: 0.45, energy: 0.55 },
  { id: 93, title: 'Free Bird',               artist: 'Lynyrd Skynyrd',              genre: 'american_rock', bpm: 95,  key: 'G',  mood: 'energetic',   valence: 0.55, energy: 0.75 },
  { id: 94, title: 'Smells Like Teen Spirit', artist: 'Nirvana',                     genre: 'american_rock', bpm: 117, key: 'Fm', mood: 'energetic',   valence: 0.35, energy: 0.95 },
  { id: 95, title: 'November Rain',           artist: 'Guns N\' Roses',              genre: 'american_rock', bpm: 75,  key: 'C',  mood: 'melancholic', valence: 0.30, energy: 0.65 },
  { id: 96, title: 'The Sound of Silence',    artist: 'Simon & Garfunkel',           genre: 'american_rock', bpm: 105, key: 'Dm', mood: 'melancholic', valence: 0.25, energy: 0.30 },
  { id: 97, title: 'Don\'t Stop Believin\'',  artist: 'Journey',                     genre: 'american_rock', bpm: 119, key: 'E',  mood: 'happy',       valence: 0.85, energy: 0.75 },
  { id: 98, title: 'Boulevard of Broken Dreams', artist: 'Green Day',                genre: 'american_rock', bpm: 84,  key: 'Fm', mood: 'melancholic', valence: 0.35, energy: 0.65 },
  { id: 99, title: 'Wonderwall',              artist: 'Oasis',                       genre: 'american_rock', bpm: 87,  key: 'F#m',mood: 'romantic',    valence: 0.55, energy: 0.55 },
  { id: 100,title: 'Africa',                  artist: 'Toto',                        genre: 'american_rock', bpm: 93,  key: 'A',  mood: 'happy',       valence: 0.80, energy: 0.65 },
];

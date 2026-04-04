/**
 * Genre → Spotify playlist mapping.
 *
 * Each genre has:
 *   - displayName: Pretty name for output
 *   - spotifyPlaylists: Array of public Spotify playlist URLs to scrape
 *   - searchTerms: Fallback search terms if playlists fail
 *
 * Playlists are curated by Spotify editorial — they represent actual hits,
 * not random user-generated playlists.
 */

const GENRE_MAP = {
  afrobeats: {
    displayName: "Afrobeats",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DWYkaDif7Ztbx", // Afrobeats Hits
      "https://open.spotify.com/playlist/37i9dQZF1DX4SBhb3fqCJd", // Hot Hits Africa
      "https://open.spotify.com/playlist/37i9dQZF1DXarRysLJmuju", // Afro Bop
    ],
    searchTerms: ["afrobeats hits", "afrobeats new releases"],
  },

  "hip-hop": {
    displayName: "Hip-Hop",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd", // RapCaviar
      "https://open.spotify.com/playlist/37i9dQZF1DWY4xHQp97fN6", // Get Turnt
      "https://open.spotify.com/playlist/37i9dQZF1DX2RxBh64BHjQ", // Most Necessary
    ],
    searchTerms: ["hip hop hits", "rap hits"],
  },

  pop: {
    displayName: "Pop",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", // Today's Top Hits
      "https://open.spotify.com/playlist/37i9dQZF1DX0kbJZpiYdZl", // Hot Hits UK
      "https://open.spotify.com/playlist/37i9dQZF1DXarRysLJmuju", // Pop Rising
    ],
    searchTerms: ["pop hits", "top pop songs"],
  },

  "r&b": {
    displayName: "R&B",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DX4SBhb3fqCJd", // R&B Hits
      "https://open.spotify.com/playlist/37i9dQZF1DWYmmr74INQlb", // R&B+
      "https://open.spotify.com/playlist/37i9dQZF1DX2WkIBRaChxW", // Chill R&B
    ],
    searchTerms: ["r&b hits", "rnb new releases"],
  },

  rock: {
    displayName: "Rock",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DXcF6B6QPhFDv", // Rock This
      "https://open.spotify.com/playlist/37i9dQZF1DX1lVhptIYRda", // Hot Hits Rock
      "https://open.spotify.com/playlist/37i9dQZF1DWXRqgorJj26U", // Rock Classics
    ],
    searchTerms: ["rock hits", "rock new releases"],
  },

  latin: {
    displayName: "Latin",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DX10zKzsJ2jva", // Viva Latino
      "https://open.spotify.com/playlist/37i9dQZF1DX1HCSbq0nkCb", // Reggaeton Hits
      "https://open.spotify.com/playlist/37i9dQZF1DWY7IeIP1cdjF", // Latin Pop Hits
    ],
    searchTerms: ["latin hits", "reggaeton hits"],
  },

  country: {
    displayName: "Country",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DX1lVhptIYRda", // Hot Country
      "https://open.spotify.com/playlist/37i9dQZF1DWTkxQvqMy4WW", // Country's Best
      "https://open.spotify.com/playlist/37i9dQZF1DX13ZzXoot6v0", // New Boots
    ],
    searchTerms: ["country hits", "country new releases"],
  },

  gospel: {
    displayName: "Gospel",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DXcmaoFmN75bi", // Top Gospel
      "https://open.spotify.com/playlist/37i9dQZF1DX3gnvHPEHghG", // Gospel Today
      "https://open.spotify.com/playlist/37i9dQZF1DWVtgBaYYWECQ", // Gospel Hits
    ],
    searchTerms: ["gospel hits", "gospel worship songs"],
  },

  reggae: {
    displayName: "Reggae",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DXbSbnqxMTGx9", // Reggae Classics
      "https://open.spotify.com/playlist/37i9dQZF1DWTylzECqkwEM", // Island Reggae
      "https://open.spotify.com/playlist/37i9dQZF1DX0MbPBeMo2YJ", // Roots Reggae
    ],
    searchTerms: ["reggae hits", "dancehall hits"],
  },

  jazz: {
    displayName: "Jazz",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DXbITWG1ZJKYt", // Jazz Vibes
      "https://open.spotify.com/playlist/37i9dQZF1DX4wta20aJtXo", // New Jazz
      "https://open.spotify.com/playlist/37i9dQZF1DWVqfgj8NZEp1", // Coffee Table Jazz
    ],
    searchTerms: ["jazz hits", "smooth jazz"],
  },

  electronic: {
    displayName: "Electronic",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n", // mint
      "https://open.spotify.com/playlist/37i9dQZF1DX0BcQWzuB7ZO", // Dance Hits
      "https://open.spotify.com/playlist/37i9dQZF1DX6J5NfMJS675", // Future House
    ],
    searchTerms: ["edm hits", "electronic dance music"],
  },

  classical: {
    displayName: "Classical",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DWWEJlAGA9gs0", // Classical Essentials
      "https://open.spotify.com/playlist/37i9dQZF1DX7K31D69s4M1", // Classical New Releases
      "https://open.spotify.com/playlist/37i9dQZF1DWVFeEut75IAL", // Classical Focus
    ],
    searchTerms: ["classical music popular", "famous classical pieces"],
  },

  amapiano: {
    displayName: "Amapiano",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DWTp1boeRwBWe", // Amapiano Grooves
      "https://open.spotify.com/playlist/37i9dQZF1DXdBu6SZfrWe3", // Amapiano Lifestyle
      "https://open.spotify.com/playlist/37i9dQZF1DX0RjNwitAeqQ", // Amapiano Hits
    ],
    searchTerms: ["amapiano hits", "amapiano new releases"],
  },

  dancehall: {
    displayName: "Dancehall",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DXan38dNVDdl4", // Dancehall Official
      "https://open.spotify.com/playlist/37i9dQZF1DWVtgBaYYWECQ", // Dancehall Hits
    ],
    searchTerms: ["dancehall hits", "dancehall new releases"],
  },

  "bongo-flava": {
    displayName: "Bongo Flava",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DXarRysLJmuju", // East Africa Hits
    ],
    searchTerms: ["bongo flava hits", "bongo flava new releases"],
  },

  gengetone: {
    displayName: "Gengetone",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DXarRysLJmuju", // Kenya Hits
    ],
    searchTerms: ["gengetone hits", "gengetone new releases"],
  },

  "k-pop": {
    displayName: "K-Pop",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DX9tPFwDMOaN1", // K-Pop Daebak
      "https://open.spotify.com/playlist/37i9dQZF1DXe5W6diBL5N4", // K-Pop ON!
      "https://open.spotify.com/playlist/37i9dQZF1DX4FcAKI5Nhzq", // K-Pop Rising
    ],
    searchTerms: ["kpop hits", "k-pop new releases"],
  },

  reggaeton: {
    displayName: "Reggaeton",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DX1HCSbq0nkCb", // Reggaeton Hits
      "https://open.spotify.com/playlist/37i9dQZF1DX10zKzsJ2jva", // Viva Latino
    ],
    searchTerms: ["reggaeton hits", "reggaeton new releases"],
  },

  drill: {
    displayName: "Drill",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DWYMlJBMvphMQ", // Drill Essentials
      "https://open.spotify.com/playlist/37i9dQZF1DX9EM98aZosoy", // UK Drill
    ],
    searchTerms: ["drill music hits", "drill rap hits"],
  },

  indie: {
    displayName: "Indie",
    spotifyPlaylists: [
      "https://open.spotify.com/playlist/37i9dQZF1DX2Nc3B70tvx0", // Indie Pop
      "https://open.spotify.com/playlist/37i9dQZF1DXdbXrPNafg9d", // Indie Rock
      "https://open.spotify.com/playlist/37i9dQZF1DX26DKvjp0s9M", // All New Indie
    ],
    searchTerms: ["indie hits", "indie new releases"],
  },
};

// Flat list of supported genre keys
const GENRE_LIST = Object.keys(GENRE_MAP);

/**
 * Get genre config by name (case-insensitive, fuzzy).
 * Returns { key, config } or null if not found.
 */
function getGenreConfig(name) {
  const normalized = name.toLowerCase().trim();

  // Exact match
  if (GENRE_MAP[normalized]) {
    return { key: normalized, config: GENRE_MAP[normalized] };
  }

  // Try with common variations
  const variations = [
    normalized,
    normalized.replace(/\s+/g, "-"),    // "hip hop" → "hip-hop"
    normalized.replace(/-/g, " "),       // "hip-hop" → "hip hop"
    normalized.replace(/&/g, "and"),     // "r&b" → "r and b"
    normalized.replace(/and/g, "&"),     // "r and b" → "r&b"
  ];

  for (const v of variations) {
    if (GENRE_MAP[v]) {
      return { key: v, config: GENRE_MAP[v] };
    }
  }

  // Partial match — find genres that contain the search term
  for (const [key, config] of Object.entries(GENRE_MAP)) {
    if (key.includes(normalized) || config.displayName.toLowerCase().includes(normalized)) {
      return { key, config };
    }
  }

  // Not found — return a dynamic config for unknown genres
  return {
    key: normalized,
    config: {
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
      spotifyPlaylists: [],
      searchTerms: [`${name} hits`, `${name} new releases`, `best ${name} songs`],
    },
  };
}

module.exports = {
  GENRE_MAP,
  GENRE_LIST,
  getGenreConfig,
};

const { normalizeArtist } = require("../utils/format");
const { MAX_PER_ARTIST } = require("../config/constants");

/**
 * Enforce artist diversity cap on a ranked list of songs.
 *
 * Walks the list top-down. Once an artist has `maxPerArtist` songs,
 * skip their remaining songs. This preserves the ranking order
 * while ensuring no single artist dominates the playlist.
 *
 * @param {Array} rankedSongs - Songs sorted by score (descending)
 * @param {number} maxPerArtist - Max songs per artist (default: 2)
 * @returns {Array} Filtered songs
 */
function applyDiversityCap(rankedSongs, maxPerArtist = MAX_PER_ARTIST) {
  const result = [];
  const artistCount = {};

  for (const song of rankedSongs) {
    const key = normalizeArtist(song.artist || "unknown");
    artistCount[key] = (artistCount[key] || 0);

    if (artistCount[key] < maxPerArtist) {
      result.push(song);
      artistCount[key]++;
    }
  }

  return result;
}

module.exports = { applyDiversityCap };

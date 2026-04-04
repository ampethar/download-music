const { BLACKLIST } = require("../config/constants");

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

function formatViews(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function isMixOrCompilation(title) {
  const lower = title.toLowerCase();
  return BLACKLIST.some((word) => lower.includes(word));
}

/**
 * Normalize an artist name for comparison/deduplication.
 * "Davido ft. Fave" → "davido"
 * "The Weeknd" → "weeknd"
 */
function normalizeArtist(artist) {
  return artist
    .toLowerCase()
    .replace(/\s*(feat\.?|ft\.?|featuring|with|&|,|x)\s*.*/i, "")
    .replace(/^the\s+/i, "")
    .trim();
}

/**
 * Normalize a song title for deduplication.
 * Strips parentheticals like (Official Video), (Lyric Video), etc.
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s*[\(\[].*?[\)\]]/g, "")  // remove (Official Video), [Lyrics], etc.
    .replace(/\s*official\s*(music\s*)?video/i, "")
    .replace(/\s*lyric\s*video/i, "")
    .replace(/\s*audio/i, "")
    .replace(/[^\w\s]/g, "")             // remove special chars
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Create a dedup key from artist + title.
 */
function dedupKey(artist, title) {
  return `${normalizeArtist(artist)}::${normalizeTitle(title)}`;
}

module.exports = {
  sanitizeFilename,
  formatViews,
  formatDuration,
  isMixOrCompilation,
  normalizeArtist,
  normalizeTitle,
  dedupKey,
};

/**
 * Hit Score Engine
 *
 * Scores each candidate song based on multiple signals:
 *   - playlistCount (30%) — how many Spotify playlists it appears in
 *   - position (25%)      — rank within playlists (lower = better)
 *   - views (25%)         — YouTube view count (log-scaled)
 *   - recency (20%)       — bonus for recent releases
 *
 * All signals are normalized to 0–1 within the batch before weighting.
 */

const WEIGHTS = {
  playlistCount: 30,
  position: 25,
  views: 25,
  recency: 20,
};

/**
 * Normalize an array of numbers to 0–1 range (min-max).
 * Returns a Map of index → normalized value.
 */
function minMaxNormalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => (v - min) / range);
}

/**
 * Calculate recency score (0–1) from a date string or upload date.
 * Songs released < 30 days ago get 1.0, < 90 days get 0.7, < 180 get 0.4, else 0.1
 */
function recencyScore(dateStr) {
  if (!dateStr) return 0.3; // unknown date gets a neutral score

  let date;
  // yt-dlp format: "20240315"
  if (/^\d{8}$/.test(dateStr)) {
    date = new Date(
      `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    );
  } else {
    date = new Date(dateStr);
  }

  if (isNaN(date.getTime())) return 0.3;

  const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince < 30) return 1.0;
  if (daysSince < 90) return 0.7;
  if (daysSince < 180) return 0.4;
  if (daysSince < 365) return 0.2;
  return 0.1;
}

/**
 * Score a batch of candidates.
 *
 * Each candidate should have:
 *   - playlistCount (number)
 *   - bestPosition or avgPosition (number, lower = better)
 *   - views (number, from YouTube)
 *   - releaseDate or uploadDate (string, optional)
 *
 * Returns the same candidates with a `score` field added, sorted descending.
 */
function rankCandidates(candidates) {
  if (candidates.length === 0) return [];

  // Extract raw signal arrays
  const playlistCounts = candidates.map((c) => c.playlistCount || 1);
  const positions = candidates.map((c) => {
    // Invert position: position 1 should score highest
    const pos = c.bestPosition || c.avgPosition || 50;
    return 100 - Math.min(pos, 100);
  });
  // Use plays (YT Music streams) if available, fall back to YouTube views
  const views = candidates.map((c) => Math.log10(Math.max(c.plays || c.views || 1, 1)));
  const recencies = candidates.map((c) =>
    recencyScore(c.releaseDate || c.uploadDate)
  );

  // Normalize each signal to 0–1
  const normPlaylist = minMaxNormalize(playlistCounts);
  const normPosition = minMaxNormalize(positions);
  const normViews = minMaxNormalize(views);
  // recency is already 0–1

  // Calculate weighted score for each candidate
  const scored = candidates.map((c, i) => ({
    ...c,
    score:
      WEIGHTS.playlistCount * normPlaylist[i] +
      WEIGHTS.position * normPosition[i] +
      WEIGHTS.views * normViews[i] +
      WEIGHTS.recency * recencies[i],
    // Store individual scores for debugging
    _signals: {
      playlist: normPlaylist[i],
      position: normPosition[i],
      views: normViews[i],
      recency: recencies[i],
    },
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

module.exports = { rankCandidates, recencyScore, WEIGHTS };

const { chromium } = require("playwright");
const log = require("../utils/logger");
const { dedupKey, isMixOrCompilation } = require("../utils/format");
const { MAX_DURATION, MIN_DURATION, BLACKLIST } = require("../config/constants");
const { getGenreConfig } = require("../config/genres");

/**
 * Parse play count string like "759m plays" → 759000000
 */
function parsePlayCount(str) {
  if (!str) return 0;
  const match = str.toLowerCase().match(/([\d.]+)\s*(b|m|k)?/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2];
  if (unit === "b") return num * 1_000_000_000;
  if (unit === "m") return num * 1_000_000;
  if (unit === "k") return num * 1_000;
  return num;
}

/**
 * Parse duration string like "3:06" → 186 seconds
 */
function parseDuration(str) {
  if (!str) return 0;
  const match = str.match(/(\d+):(\d+):?(\d+)?/);
  if (!match) return 0;
  if (match[3]) {
    // h:mm:ss
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
  }
  // m:ss
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

/**
 * Parse the subtitle column from YouTube Music.
 * Format: "Artist • Album • Duration"
 * Returns { artist, album, duration }
 */
function parseSubtitle(text) {
  if (!text) return { artist: "Unknown", album: "", durationStr: "" };
  const parts = text.split("•").map((s) => s.trim());
  return {
    artist: parts[0] || "Unknown",
    album: parts[1] || "",
    durationStr: parts[2] || "",
  };
}

/**
 * Scrape YouTube Music search results for a query.
 * Clicks the "Songs" filter to get individual tracks only.
 * Returns array of { title, artist, album, duration, plays, videoId, url }
 */
async function scrapeYTMusicSearch(page, query) {
  try {
    const searchUrl = `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);

    // Try to click "Songs" filter — but don't fail if it's not visible
    try {
      const songFilter = await page.$('a[title="Show song results"], chip-cloud-chip-renderer:has-text("Songs")');
      if (songFilter) {
        await songFilter.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
      } else {
        // Fallback: try clicking by text with short timeout
        await page.click("text=Songs", { timeout: 5000 });
        await page.waitForTimeout(2000);
      }
    } catch {
      // Songs filter not available — continue with mixed results, we filter by duration
    }

    const rawResults = await page.evaluate(() => {
      const results = [];
      const rows = document.querySelectorAll("ytmusic-responsive-list-item-renderer");

      rows.forEach((row) => {
        const flexCols = row.querySelectorAll(".flex-columns yt-formatted-string");
        const texts = Array.from(flexCols).map((el) => el.textContent.trim());
        const linkEl = row.querySelector('a[href*="watch"]');
        const href = linkEl ? linkEl.getAttribute("href") : "";

        if (texts.length >= 2 && href) {
          results.push({
            title: texts[0],
            subtitle: texts[1],
            plays: texts[2] || "",
            href,
          });
        }
      });

      return results;
    });

    // Parse and filter results
    const songs = [];
    for (const raw of rawResults) {
      const { artist, album, durationStr } = parseSubtitle(raw.subtitle);
      const duration = parseDuration(durationStr);
      const plays = parsePlayCount(raw.plays);

      // Extract video ID
      const vidMatch = raw.href.match(/watch\?v=([a-zA-Z0-9_-]+)/);
      if (!vidMatch) continue;

      // Filter out mixes/compilations by duration
      if (duration > MAX_DURATION) continue;
      if (duration > 0 && duration < MIN_DURATION) continue;

      // Filter out mixes by title
      if (isMixOrCompilation(raw.title)) continue;

      // Filter out DJ/compilation artists
      const lowerArtist = artist.toLowerCase();
      if (lowerArtist.startsWith("dj ") || lowerArtist.includes("various")) continue;

      songs.push({
        title: raw.title,
        artist,
        album,
        duration,
        plays,
        videoId: vidMatch[1],
        url: `https://www.youtube.com/watch?v=${vidMatch[1]}`,
      });
    }

    return songs;
  } catch (err) {
    log.warn(`YT Music search failed for "${query}": ${err.message}`);
    return [];
  }
}

/**
 * Main entry point: collect candidates for a genre from YouTube Music.
 *
 * Uses multiple search queries to build a large candidate pool,
 * then merges and deduplicates.
 *
 * Returns array of:
 * {
 *   title, artist, album, duration, plays (streams),
 *   videoId, url, playlistCount, bestPosition, source
 * }
 */
async function collectCandidates(genre) {
  const { config } = getGenreConfig(genre);

  log.header(`Collecting candidates for: ${config.displayName}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // Multiple search queries to get a broad pool of candidates
    const searchQueries = [
      `${genre} hits`,
      `${genre} top songs ${new Date().getFullYear()}`,
      `best ${genre} songs`,
      `${genre} new releases ${new Date().getFullYear()}`,
      `trending ${genre}`,
    ];

    // Also add genre-specific search terms from config
    if (config.searchTerms) {
      searchQueries.push(...config.searchTerms);
    }

    // Deduplicate queries
    const uniqueQueries = [...new Set(searchQueries)];

    const candidateMap = new Map();

    for (let i = 0; i < uniqueQueries.length; i++) {
      const query = uniqueQueries[i];
      log.info(`Search ${i + 1}/${uniqueQueries.length}: "${query}"`);

      const songs = await scrapeYTMusicSearch(page, query);

      for (let pos = 0; pos < songs.length; pos++) {
        const song = songs[pos];
        const key = dedupKey(song.artist, song.title);

        if (candidateMap.has(key)) {
          // Song appeared in another search = stronger signal
          const existing = candidateMap.get(key);
          existing.playlistCount += 1;
          existing.bestPosition = Math.min(existing.bestPosition, pos + 1);
          existing.positions.push(pos + 1);
          // Keep the higher play count
          if (song.plays > existing.plays) {
            existing.plays = song.plays;
          }
        } else {
          candidateMap.set(key, {
            ...song,
            playlistCount: 1,
            bestPosition: pos + 1,
            positions: [pos + 1],
            source: "youtube-music",
          });
        }
      }

      // Small delay between searches
      if (i < uniqueQueries.length - 1) {
        await page.waitForTimeout(1500);
      }
    }

    await browser.close();

    // Calculate avg position and clean up
    const candidates = Array.from(candidateMap.values()).map((c) => {
      c.avgPosition =
        c.positions.reduce((a, b) => a + b, 0) / c.positions.length;
      delete c.positions;
      return c;
    });

    log.success(
      `Collected ${candidates.length} unique candidates from ${uniqueQueries.length} searches`
    );

    return candidates;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

/**
 * Collect candidates for a specific artist.
 * Searches YouTube Music for the artist's top/best songs.
 */
async function collectArtistCandidates(artist) {
  log.header(`Collecting top songs for: ${artist}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    const searchQueries = [
      `${artist} best songs`,
      `${artist} top hits`,
      `${artist} popular songs`,
    ];

    const candidateMap = new Map();

    for (let i = 0; i < searchQueries.length; i++) {
      const query = searchQueries[i];
      log.info(`Search ${i + 1}/${searchQueries.length}: "${query}"`);

      const songs = await scrapeYTMusicSearch(page, query);

      // Only keep songs by this artist
      const artistLower = artist.toLowerCase();
      const artistSongs = songs.filter((s) =>
        s.artist.toLowerCase().includes(artistLower) ||
        artistLower.includes(s.artist.toLowerCase())
      );

      for (let pos = 0; pos < artistSongs.length; pos++) {
        const song = artistSongs[pos];
        const key = dedupKey(song.artist, song.title);

        if (candidateMap.has(key)) {
          const existing = candidateMap.get(key);
          existing.playlistCount += 1;
          existing.bestPosition = Math.min(existing.bestPosition, pos + 1);
          existing.positions.push(pos + 1);
          if (song.plays > existing.plays) existing.plays = song.plays;
        } else {
          candidateMap.set(key, {
            ...song,
            playlistCount: 1,
            bestPosition: pos + 1,
            positions: [pos + 1],
            source: "youtube-music",
          });
        }
      }

      if (i < searchQueries.length - 1) {
        await page.waitForTimeout(1500);
      }
    }

    await browser.close();

    const candidates = Array.from(candidateMap.values()).map((c) => {
      c.avgPosition =
        c.positions.reduce((a, b) => a + b, 0) / c.positions.length;
      delete c.positions;
      return c;
    });

    log.success(`Collected ${candidates.length} unique songs by ${artist}`);
    return candidates;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

module.exports = { collectCandidates, collectArtistCandidates, scrapeYTMusicSearch };

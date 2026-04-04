const { collectCandidates, collectArtistCandidates } = require("./scrapers/spotify");
const { searchYouTube, findBestMatch, downloadTrack, searchAndDownload } = require("./scrapers/youtube");
const { rankCandidates } = require("./scoring/hitScore");
const { applyDiversityCap } = require("./scoring/diversity");
const { generateM3U, generateM3UFromFiles, getExistingSongs } = require("./playlist/m3u");
const { MUSIC_DIR, MAX_DURATION, MIN_DURATION } = require("./config/constants");
const { isMixOrCompilation, formatViews, formatDuration } = require("./utils/format");
const { getGenreConfig } = require("./config/genres");
const { checkAllDeps, ensureDirs } = require("./utils/deps");
const log = require("./utils/logger");

/**
 * Genre flow: Spotify discover → Score → Download → Playlist
 */
async function runGenre({ genre, limit = 10, name, dryRun = false }) {
  if (!checkAllDeps()) process.exit(1);
  ensureDirs();

  const { config } = getGenreConfig(genre);
  const playlistName = name || `${config.displayName} Hits`;

  // ── Stage 1: Collect candidates from Spotify ──
  let candidates = await collectCandidates(genre);

  // Fallback: if Spotify gave us nothing, use YouTube search
  if (candidates.length === 0) {
    log.warn("Spotify scraping returned no results, falling back to YouTube search...");
    candidates = await youtubeSearchFallback(genre, limit * 3);
  }

  if (candidates.length === 0) {
    log.error(`No songs found for genre "${genre}".`);
    process.exit(1);
  }

  // ── Stage 2: Enrich candidates missing YouTube data ──
  // YouTube Music candidates already have plays, duration, videoId
  // Only enrich candidates that are missing this data
  const needsEnrichment = candidates.filter((c) => !c.videoId);

  if (needsEnrichment.length > 0) {
    log.header(`Enriching ${needsEnrichment.length} candidates with YouTube data...`);

    let enriched = 0;
    for (const candidate of needsEnrichment) {
      try {
        const match = await findBestMatch(candidate.artist, candidate.title);
        if (match) {
          candidate.views = match.views;
          candidate.duration = match.duration;
          candidate.uploadDate = match.uploadDate;
          candidate.videoUrl = match.url;
          candidate.videoId = match.videoId;
          enriched++;
        }
      } catch {
        // Skip enrichment failures silently
      }
    }

    log.success(`Enriched ${enriched}/${needsEnrichment.length} candidates`);
  } else {
    log.info("All candidates already have YouTube data — skipping enrichment");
  }

  // Ensure videoUrl is set for all candidates with videoId
  for (const c of candidates) {
    if (c.videoId && !c.videoUrl) {
      c.videoUrl = c.url || `https://www.youtube.com/watch?v=${c.videoId}`;
    }
  }

  // ── Stage 3: Remove songs already in playlists/music folder ──
  const existing = getExistingSongs();
  const beforeCount = candidates.length;

  candidates = candidates.filter((c) => {
    const titleLower = (c.title || "").toLowerCase();
    const artistTitle = `${(c.artist || "")} - ${c.title || ""}`.toLowerCase();

    // Check if song already exists (by title or artist-title combo)
    return !existing.has(titleLower) && !existing.has(artistTitle);
  });

  const skipped = beforeCount - candidates.length;
  if (skipped > 0) {
    log.info(`Skipped ${skipped} song(s) already in your library`);
  }

  if (candidates.length === 0) {
    log.success("You already have all the hits for this genre!");
    return;
  }

  // ── Stage 4: Score and rank ──
  log.header("Scoring and ranking...");

  const ranked = rankCandidates(candidates);
  const diverse = applyDiversityCap(ranked);
  const selected = diverse.slice(0, limit);

  // Print the ranked list
  log.header(`Top ${selected.length} ${config.displayName} Hits:`);
  selected.forEach((s, i) => {
    const dur = s.duration ? formatDuration(s.duration) : "?:??";
    const streams = s.plays ? formatViews(s.plays) + " plays" : s.views ? formatViews(s.views) + " views" : "no data";
    const playlists = s.playlistCount > 1 ? `in ${s.playlistCount} searches` : "1 search";
    const score = s.score.toFixed(1);

    console.log(
      `  ${String(i + 1).padStart(2)}. ${s.artist} - ${s.title}`
    );
    log.dim(`      [${dur} | ${streams} | ${playlists} | score: ${score}]`);
  });

  // Dry run stops here
  if (dryRun) {
    log.header("Dry run — no downloads.");
    return;
  }

  // ── Stage 4: Download ──
  log.header(`Downloading ${selected.length} tracks...`);

  const downloadedTracks = [];

  for (let i = 0; i < selected.length; i++) {
    const song = selected[i];
    log.progress(i + 1, selected.length, `${song.artist} - ${song.title}`);

    let result;

    // If we already have a video URL from enrichment, download directly
    if (song.videoUrl) {
      try {
        const filePath = await downloadTrack(song.videoUrl, MUSIC_DIR);
        if (filePath) {
          result = { filePath, videoData: song };
        }
      } catch (err) {
        log.warn(`Direct download failed, searching again: ${err.message}`);
      }
    }

    // Fallback: search and download
    if (!result) {
      result = await searchAndDownload(song.artist, song.title, MUSIC_DIR);
    }

    if (result) {
      downloadedTracks.push({
        filePath: result.filePath,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
      });
      log.success(`Downloaded: ${song.artist} - ${song.title}`);
    } else {
      log.warn(`Skipped: ${song.artist} - ${song.title}`);
    }
  }

  if (downloadedTracks.length === 0) {
    log.error("No tracks were downloaded.");
    process.exit(1);
  }

  // ── Stage 5: Generate playlist ──
  log.success(`Downloaded ${downloadedTracks.length}/${selected.length} track(s)`);

  generateM3U({ name: playlistName, tracks: downloadedTracks });

  log.header("Done! Copy music/ and playlists/ to your USB drive for car playback.");
}

/**
 * Song flow: search for a single song by name and download it.
 */
async function runSong({ song, dryRun = false }) {
  if (!checkAllDeps()) process.exit(1);
  ensureDirs();

  log.info(`Searching for: "${song}"`);

  const results = await searchYouTube(song, 5);

  // Filter out mixes/compilations
  const valid = results.filter((r) => {
    if (r.duration > MAX_DURATION || r.duration < MIN_DURATION) return false;
    if (isMixOrCompilation(r.title)) return false;
    return true;
  });

  if (valid.length === 0) {
    log.error(`No results found for "${song}".`);
    process.exit(1);
  }

  // Sort by views — most popular match first
  valid.sort((a, b) => b.views - a.views);

  // Show top matches
  log.header("Best matches:");
  valid.slice(0, 5).forEach((r, i) => {
    const dur = r.duration ? formatDuration(r.duration) : "?:??";
    const views = r.views ? formatViews(r.views) + " views" : "";
    console.log(`  ${i + 1}. ${r.title}`);
    log.dim(`     [${dur} | ${views} | ${r.channel}]`);
  });

  if (dryRun) {
    log.header("Dry run — no download.");
    return;
  }

  // Download the best match
  const best = valid[0];
  log.info(`Downloading: ${best.title}`);

  try {
    const filePath = await downloadTrack(best.url, MUSIC_DIR);
    if (filePath) {
      log.success(`Downloaded: ${filePath}`);
    } else {
      log.error("Download failed.");
    }
  } catch (err) {
    log.error(err.message);
  }
}

/**
 * URL flow: download directly from a URL (YouTube, SoundCloud, etc.)
 */
async function runUrl({ url, name = "My Playlist" }) {
  if (!checkAllDeps()) process.exit(1);
  ensureDirs();

  log.info(`Downloading from: ${url}`);

  try {
    const filePath = await downloadTrack(url, MUSIC_DIR);
    if (!filePath) {
      log.error("No MP3 files were downloaded.");
      process.exit(1);
    }

    // downloadTrack returns a single file; for playlists yt-dlp handles multiple
    const files = Array.isArray(filePath) ? filePath : [filePath];

    log.success(`Downloaded ${files.length} track(s)`);
    generateM3UFromFiles(name, files);
    log.header("Done! Copy music/ and playlists/ to your USB drive for car playback.");
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }
}

/**
 * YouTube search fallback when Spotify scraping fails.
 * Searches YouTube for genre hits and returns candidates.
 */
async function youtubeSearchFallback(genre, count = 30) {
  log.info(`Searching YouTube for "${genre}" hits...`);

  const query = `${genre} official music video ${new Date().getFullYear()}`;
  const results = await searchYouTube(query, count);

  return results
    .filter((r) => {
      if (r.duration > MAX_DURATION || r.duration < MIN_DURATION) return false;
      if (isMixOrCompilation(r.title)) return false;
      return true;
    })
    .map((r) => ({
      title: r.title,
      artist: r.channel || "Unknown",
      playlistCount: 1,
      bestPosition: 50,
      views: r.views,
      duration: r.duration,
      uploadDate: r.uploadDate,
      videoUrl: r.url,
      videoId: r.videoId,
      source: "youtube",
    }));
}

/**
 * Artist flow: find and download top songs by a specific artist.
 * No diversity cap here — all songs are by the same artist.
 */
async function runArtist({ artist, limit = 5, name, dryRun = false }) {
  if (!checkAllDeps()) process.exit(1);
  ensureDirs();

  const playlistName = name || `Best of ${artist}`;

  // ── Stage 1: Collect candidates ──
  let candidates = await collectArtistCandidates(artist);

  if (candidates.length === 0) {
    log.error(`No songs found for artist "${artist}".`);
    process.exit(1);
  }

  // ── Stage 2: Remove songs already in your library ──
  const existing = getExistingSongs();
  const beforeCount = candidates.length;

  candidates = candidates.filter((c) => {
    const titleLower = (c.title || "").toLowerCase();
    const artistTitle = `${(c.artist || "")} - ${c.title || ""}`.toLowerCase();
    return !existing.has(titleLower) && !existing.has(artistTitle);
  });

  const skipped = beforeCount - candidates.length;
  if (skipped > 0) {
    log.info(`Skipped ${skipped} song(s) already in your library`);
  }

  if (candidates.length === 0) {
    log.success(`You already have all the top songs by ${artist}!`);
    return;
  }

  // ── Stage 3: Score and rank (no diversity cap — same artist) ──
  log.header("Scoring and ranking...");

  const ranked = rankCandidates(candidates);
  const selected = ranked.slice(0, limit);

  log.header(`Top ${selected.length} songs by ${artist}:`);
  selected.forEach((s, i) => {
    const dur = s.duration ? formatDuration(s.duration) : "?:??";
    const streams = s.plays ? formatViews(s.plays) + " plays" : "no data";
    const score = s.score.toFixed(1);

    console.log(`  ${String(i + 1).padStart(2)}. ${s.title}`);
    log.dim(`      [${dur} | ${streams} | score: ${score}]`);
  });

  if (dryRun) {
    log.header("Dry run — no downloads.");
    return;
  }

  // ── Stage 3: Download ──
  log.header(`Downloading ${selected.length} tracks...`);

  const downloadedTracks = [];

  for (let i = 0; i < selected.length; i++) {
    const song = selected[i];
    log.progress(i + 1, selected.length, `${song.artist} - ${song.title}`);

    let result;

    if (song.videoUrl || song.url) {
      try {
        const filePath = await downloadTrack(song.videoUrl || song.url, MUSIC_DIR);
        if (filePath) result = { filePath, videoData: song };
      } catch (err) {
        log.warn(`Direct download failed, searching again: ${err.message}`);
      }
    }

    if (!result) {
      result = await searchAndDownload(song.artist, song.title, MUSIC_DIR);
    }

    if (result) {
      downloadedTracks.push({
        filePath: result.filePath,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
      });
      log.success(`Downloaded: ${song.artist} - ${song.title}`);
    } else {
      log.warn(`Skipped: ${song.title}`);
    }
  }

  if (downloadedTracks.length === 0) {
    log.error("No tracks were downloaded.");
    process.exit(1);
  }

  log.success(`Downloaded ${downloadedTracks.length}/${selected.length} track(s)`);
  generateM3U({ name: playlistName, tracks: downloadedTracks });
  log.header("Done! Copy music/ and playlists/ to your USB drive for car playback.");
}

module.exports = { runGenre, runArtist, runSong, runUrl };

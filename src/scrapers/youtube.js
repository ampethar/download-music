const { spawn } = require("child_process");
const { MUSIC_DIR, MAX_DURATION, MIN_DURATION } = require("../config/constants");
const { isMixOrCompilation } = require("../utils/format");
const log = require("../utils/logger");

/**
 * Search YouTube via yt-dlp and return metadata for each result.
 * Returns: [{ videoId, title, url, views, duration, uploadDate, channel }]
 */
function searchYouTube(query, count = 5) {
  return new Promise((resolve, reject) => {
    const args = [
      `ytsearch${count}:${query}`,
      "--flat-playlist",
      "--dump-json",
      "--no-download",
    ];

    const proc = spawn("yt-dlp", args, { stdio: ["inherit", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp search failed: ${stderr.slice(0, 200)}`));
        return;
      }

      const results = stdout
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => {
          try { return JSON.parse(l); } catch { return null; }
        })
        .filter(Boolean)
        .map((r) => ({
          videoId: r.id,
          title: r.title || "",
          url: `https://www.youtube.com/watch?v=${r.id}`,
          views: r.view_count || 0,
          duration: r.duration || 0,
          uploadDate: r.upload_date || null,
          channel: r.channel || r.uploader || "",
        }));

      resolve(results);
    });
  });
}

/**
 * Search YouTube for a specific song by artist + title.
 * Filters results to find the best match (single track, not a mix).
 * Returns the best matching result or null.
 */
async function findBestMatch(artist, title) {
  const query = `${artist} - ${title} official audio`;
  const results = await searchYouTube(query, 5);

  // Filter: must be a single track, not a mix
  const valid = results.filter((r) => {
    if (r.duration > MAX_DURATION) return false;
    if (r.duration < MIN_DURATION) return false;
    if (isMixOrCompilation(r.title)) return false;
    return true;
  });

  if (valid.length === 0) return null;

  // Prefer the one with most views (likely the official version)
  valid.sort((a, b) => b.views - a.views);
  return valid[0];
}

/**
 * Download a single video as MP3.
 * Returns the file path of the downloaded MP3, or null on failure.
 */
function downloadTrack(url, outputDir = MUSIC_DIR) {
  return new Promise((resolve, reject) => {
    const outputTemplate = `${outputDir}/%(title)s.%(ext)s`;

    const args = [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--embed-thumbnail",
      "--add-metadata",
      "-o", outputTemplate,
      "--print", "after_move:filepath",
      "--no-overwrites",
      url,
    ];

    const proc = spawn("yt-dlp", args, { stdio: ["inherit", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      const text = d.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on("data", (d) => {
      const text = d.toString();
      stderr += text;
      // Only print real errors, skip warnings
      if (text.includes("ERROR")) process.stderr.write(text);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Download failed: ${stderr.slice(0, 200)}`));
        return;
      }

      const files = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.endsWith(".mp3"));

      resolve(files[0] || null);
    });
  });
}

/**
 * Search YouTube for a song and download it as MP3.
 * Returns { filePath, videoData } or null on failure.
 */
async function searchAndDownload(artist, title, outputDir = MUSIC_DIR) {
  const match = await findBestMatch(artist, title);
  if (!match) {
    log.warn(`No YouTube match found for "${artist} - ${title}"`);
    return null;
  }

  try {
    const filePath = await downloadTrack(match.url, outputDir);
    return filePath ? { filePath, videoData: match } : null;
  } catch (err) {
    log.warn(`Failed to download "${artist} - ${title}": ${err.message}`);
    return null;
  }
}

module.exports = {
  searchYouTube,
  findBestMatch,
  downloadTrack,
  searchAndDownload,
};

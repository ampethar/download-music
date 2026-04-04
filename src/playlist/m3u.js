const fs = require("fs");
const path = require("path");
const { PLAYLISTS_DIR } = require("../config/constants");
const { sanitizeFilename } = require("../utils/format");
const log = require("../utils/logger");

/**
 * Generate an M3U playlist file from an array of track objects.
 *
 * @param {object} options
 * @param {string} options.name - Playlist name
 * @param {Array} options.tracks - Array of { filePath, title, artist, duration }
 * @param {string} [options.outputDir] - Output directory (default: PLAYLISTS_DIR)
 * @returns {string} Path to the generated .m3u file
 */
function generateM3U({ name, tracks, outputDir = PLAYLISTS_DIR }) {
  fs.mkdirSync(outputDir, { recursive: true });

  const safeName = sanitizeFilename(name);
  const m3uPath = path.join(outputDir, `${safeName}.m3u`);

  let content = "#EXTM3U\n";
  content += `#PLAYLIST:${name}\n\n`;

  for (const track of tracks) {
    const duration = track.duration ? Math.round(track.duration) : -1;
    const display = track.artist
      ? `${track.artist} - ${track.title}`
      : track.title || path.basename(track.filePath, ".mp3");

    const relativePath = path.relative(outputDir, track.filePath);

    content += `#EXTINF:${duration},${display}\n`;
    content += `${relativePath}\n`;
  }

  fs.writeFileSync(m3uPath, content, "utf-8");
  log.success(`Playlist saved: ${m3uPath}`);
  return m3uPath;
}

/**
 * Simple version: generate M3U from just an array of file paths.
 * Used for direct URL downloads where we don't have rich metadata.
 */
function generateM3UFromFiles(name, filePaths, outputDir = PLAYLISTS_DIR) {
  const tracks = filePaths.map((fp) => ({
    filePath: fp,
    title: path.basename(fp, ".mp3"),
    artist: null,
    duration: -1,
  }));

  return generateM3U({ name, tracks, outputDir });
}

/**
 * Read existing MP3 files from the music directory (/home/musyoka/Music/).
 * Returns a Set of lowercase filenames (without .mp3 extension).
 */
function getExistingSongs() {
  const existing = new Set();
  const { MUSIC_DIR } = require("../config/constants");

  if (fs.existsSync(MUSIC_DIR)) {
    const mp3Files = fs.readdirSync(MUSIC_DIR).filter((f) => f.endsWith(".mp3"));
    for (const file of mp3Files) {
      existing.add(path.basename(file, ".mp3").toLowerCase());
    }
  }

  return existing;
}

module.exports = { generateM3U, generateM3UFromFiles, getExistingSongs };

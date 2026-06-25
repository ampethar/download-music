#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const MUSIC_DIR = path.join(__dirname, "music");
const PLAYLISTS_DIR = path.join(__dirname, "playlists");

const GENRES = [
  "pop",
  "hip-hop",
  "r&b",
  "rock",
  "country",
  "latin",
  "afrobeats",
  "reggae",
  "gospel",
  "jazz",
  "electronic",
  "dancehall",
  "bongo flava",
  "gengetone",
  "amapiano",
  "indie",
  "classical",
  "k-pop",
  "reggaeton",
  "drill",
];

function ensureDirs() {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
}

function isSpotifyUrl(url) {
  return url.includes("spotify.com");
}

function checkDependency(cmd, name, installHint) {
  const finder = os.platform() === "win32" ? "where" : "which";

  try {
    execSync(`${finder} ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    console.error(
      `\x1b[31m[ERROR]\x1b[0m ${name} is not installed. Install it with: ${installHint}`
    );
    return false;
  }
}

function checkBaseDeps() {
  let ok = true;
  if (!checkDependency("yt-dlp", "yt-dlp", "pip install yt-dlp")) ok = false;
  if (!checkDependency("ffmpeg", "ffmpeg", "sudo apt install ffmpeg")) ok = false;
  return ok;
}

function checkDeps(url) {
  let ok = checkBaseDeps();
  if (isSpotifyUrl(url)) {
    if (!checkDependency("spotdl", "spotdl", "pip install spotdl")) ok = false;
  }
  return ok;
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

// ─── Blacklist words to filter out mixes/compilations ───

const BLACKLIST = [
  "mix", "nonstop", "compilation", "medley", "hours", "hour",
  "playlist", "mashup", "megamix", "non-stop", "non stop",
  "collection", "jukebox", "juke-box", "best of all time",
  "dj remix", "dj non stop", "relaxation", "sleep", "study",
  "ambient", "lofi", "lo-fi", "white noise", "rain sounds",
];

function isMixOrCompilation(title) {
  const lower = title.toLowerCase();
  return BLACKLIST.some((word) => lower.includes(word));
}

function formatViews(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

// ─── Scrape genre hits using yt-dlp search + Playwright fallback ───

async function scrapeGenreHits(genre, limit = 10) {
  console.log(
    `\n\x1b[36m[INFO]\x1b[0m Searching for top "${genre}" songs...\n`
  );

  // Search for more than we need so we can filter
  const searchCount = limit * 5;
  const searchQuery = `${genre} official music video ${new Date().getFullYear()}`;

  // Use yt-dlp to search YouTube — gives us title, duration, view_count
  const args = [
    `ytsearch${searchCount}:${searchQuery}`,
    "--flat-playlist",
    "--dump-json",
    "--no-download",
  ];

  const raw = await new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args, { stdio: ["inherit", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`yt-dlp search failed: ${stderr}`));
      else resolve(stdout);
    });
  });

  // Parse each JSON line (one per result)
  const allResults = raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean);

  // Filter: single songs only (< 10 min), no mixes, must have views
  const filtered = allResults.filter((r) => {
    const duration = r.duration || 0;
    const title = r.title || "";

    // Must be under 10 minutes (single song territory)
    if (duration > 600) return false;

    // Must be at least 1 minute (skip intros/shorts)
    if (duration < 60) return false;

    // Skip mixes and compilations
    if (isMixOrCompilation(title)) return false;

    return true;
  });

  // Sort by view count (most viewed = biggest hits)
  filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));

  // Take top N
  const songs = filtered.slice(0, limit).map((r) => ({
    videoId: r.id,
    title: r.title,
    url: `https://www.youtube.com/watch?v=${r.id}`,
    views: r.view_count || 0,
    duration: r.duration || 0,
  }));

  // If yt-dlp search didn't find enough, fall back to Playwright on YouTube Music
  if (songs.length < limit) {
    console.log(
      `\x1b[33m[INFO]\x1b[0m Found ${songs.length} via search, trying YouTube Music for more...\n`
    );
    const extra = await scrapeYTMusicFallback(genre, limit - songs.length, new Set(songs.map((s) => s.videoId)));
    songs.push(...extra);
  }

  if (songs.length === 0) {
    console.error(
      `\x1b[31m[ERROR]\x1b[0m Could not find any single songs for genre "${genre}".`
    );
    return [];
  }

  console.log(`\x1b[32m[SUCCESS]\x1b[0m Found ${songs.length} track(s):\n`);
  songs.forEach((s, i) => {
    const dur = `${Math.floor(s.duration / 60)}:${String(s.duration % 60).padStart(2, "0")}`;
    const views = s.views ? ` | ${formatViews(s.views)} views` : "";
    console.log(`  ${i + 1}. ${s.title} [${dur}${views}]`);
  });

  return songs;
}

async function scrapeYTMusicFallback(genre, limit, excludeIds) {
  const { chromium } = require("playwright");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const searchQuery = `${genre} top songs ${new Date().getFullYear()}`;
  const searchUrl = `https://music.youtube.com/search?q=${encodeURIComponent(searchQuery)}`;

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    const songLinks = await page.evaluate(
      ({ maxResults, excludeIds, blacklist }) => {
        const results = [];
        const seen = new Set(excludeIds);

        const links = document.querySelectorAll("a[href*='watch?v=']");
        for (const link of links) {
          if (results.length >= maxResults) break;
          const href = link.getAttribute("href");
          if (!href) continue;
          const match = href.match(/watch\?v=([a-zA-Z0-9_-]+)/);
          if (!match) continue;
          const videoId = match[1];
          if (seen.has(videoId)) continue;
          seen.add(videoId);
          const title = link.getAttribute("title") || link.textContent.trim().substring(0, 100) || "Unknown";

          // Apply blacklist filter — skip mixes/compilations
          const lower = title.toLowerCase();
          if (blacklist.some((w) => lower.includes(w))) continue;

          results.push({ videoId, title, url: `https://www.youtube.com/watch?v=${videoId}`, views: 0, duration: 0 });
        }
        return results;
      },
      { maxResults: limit, excludeIds: [...excludeIds], blacklist: BLACKLIST }
    );

    await browser.close();
    return songLinks;
  } catch (err) {
    await browser.close();
    return [];
  }
}

// ─── Download functions ───

function downloadWithYtDlp(url) {
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(MUSIC_DIR, "%(title)s.%(ext)s");

    const args = [
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--embed-thumbnail",
      "--add-metadata",
      "-o",
      outputTemplate,
      "--print",
      "after_move:filepath",
      "--no-overwrites",
      url,
    ];

    const proc = spawn("yt-dlp", args, { stdio: ["inherit", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}\n${stderr}`));
        return;
      }

      const files = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.endsWith(".mp3"));

      resolve(files);
    });
  });
}

function downloadWithSpotdl(url) {
  return new Promise((resolve, reject) => {
    const args = [
      "download",
      url,
      "--output",
      path.join(MUSIC_DIR, "{title} - {artist}"),
      "--format",
      "mp3",
      "--bitrate",
      "320k",
    ];

    console.log(`\n\x1b[36m[INFO]\x1b[0m Downloading from Spotify: ${url}`);

    const proc = spawn("spotdl", args, { stdio: "inherit" });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`spotdl exited with code ${code}`));
        return;
      }

      const files = fs
        .readdirSync(MUSIC_DIR)
        .filter((f) => f.endsWith(".mp3"))
        .map((f) => path.join(MUSIC_DIR, f));

      resolve(files);
    });
  });
}

// ─── Playlist generation ───

function generateM3U(playlistName, files) {
  const safeName = sanitizeFilename(playlistName);
  const m3uPath = path.join(PLAYLISTS_DIR, `${safeName}.m3u`);

  let content = "#EXTM3U\n";
  content += `#PLAYLIST:${playlistName}\n`;

  for (const filePath of files) {
    const name = path.basename(filePath, ".mp3");
    const relativePath = path.relative(PLAYLISTS_DIR, filePath);
    content += `#EXTINF:-1,${name}\n`;
    content += `${relativePath}\n`;
  }

  fs.writeFileSync(m3uPath, content, "utf-8");
  console.log(`\n\x1b[32m[SUCCESS]\x1b[0m Playlist saved: ${m3uPath}`);
  return m3uPath;
}

// ─── CLI helpers ───

function promptInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function printUsage() {
  console.log(`
\x1b[1mMusic Downloader & Playlist Creator\x1b[0m

\x1b[33mCommands:\x1b[0m

  \x1b[1m1. Download by genre (Playwright scrapes YouTube Music):\x1b[0m
     node index.js --genre <genre> [--limit 10] [--name "Playlist Name"]

  \x1b[1m2. Download by URL:\x1b[0m
     node index.js <url> [playlist-name]

  \x1b[1m3. Interactive mode:\x1b[0m
     node index.js --interactive

\x1b[33mGenre examples:\x1b[0m
  node index.js --genre "afrobeats"
  node index.js --genre "hip-hop" --limit 20 --name "Hip Hop Bangers"
  node index.js --genre "gospel" --limit 15
  node index.js --genre "amapiano" --name "Amapiano 2026"

\x1b[33mURL examples:\x1b[0m
  node index.js "https://youtube.com/watch?v=xxx" "My Playlist"
  node index.js "https://youtube.com/playlist?list=xxx" "Road Trip"
  node index.js "https://open.spotify.com/playlist/xxx" "Spotify Hits"

\x1b[33mAvailable genres:\x1b[0m
  ${GENRES.join(", ")}
  (or type any genre — the scraper will search for it)

\x1b[33mOutput:\x1b[0m
  - MP3 files saved to: ./music/
  - M3U playlists saved to: ./playlists/
  `);
}

function parseArgs(argv) {
  const args = { _positional: [] };
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === "--genre" || argv[i] === "-g") {
      args.genre = argv[++i];
    } else if (argv[i] === "--limit" || argv[i] === "-l") {
      args.limit = parseInt(argv[++i], 10);
    } else if (argv[i] === "--name" || argv[i] === "-n") {
      args.name = argv[++i];
    } else if (argv[i] === "--interactive" || argv[i] === "-i") {
      args.interactive = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    } else {
      args._positional.push(argv[i]);
    }
    i++;
  }
  return args;
}

// ─── Main flows ───

async function genreFlow(genre, limit, playlistName) {
  if (!checkBaseDeps()) process.exit(1);
  ensureDirs();

  const name = playlistName || `${genre.charAt(0).toUpperCase() + genre.slice(1)} Hits`;

  const songs = await scrapeGenreHits(genre, limit);
  if (songs.length === 0) process.exit(1);

  console.log(`\n\x1b[36m[INFO]\x1b[0m Downloading ${songs.length} tracks...\n`);

  const downloadedFiles = [];

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    console.log(
      `\n\x1b[36m[${i + 1}/${songs.length}]\x1b[0m Downloading: ${song.title}`
    );
    try {
      const files = await downloadWithYtDlp(song.url);
      downloadedFiles.push(...files);
    } catch (err) {
      console.error(
        `\x1b[33m[WARN]\x1b[0m Failed to download "${song.title}": ${err.message}`
      );
    }
  }

  if (downloadedFiles.length === 0) {
    console.error("\x1b[31m[ERROR]\x1b[0m No tracks were downloaded.");
    process.exit(1);
  }

  console.log(
    `\n\x1b[32m[SUCCESS]\x1b[0m Downloaded ${downloadedFiles.length}/${songs.length} track(s)`
  );

  generateM3U(name, downloadedFiles);

  console.log(
    `\n\x1b[1mDone! Copy music/ and playlists/ to your USB drive for car playback.\x1b[0m\n`
  );
}

async function urlFlow(url, playlistName) {
  if (!checkDeps(url)) process.exit(1);
  ensureDirs();

  const name = playlistName || "My Playlist";

  console.log(`\n\x1b[36m[INFO]\x1b[0m Downloading from: ${url}`);

  let files;
  if (isSpotifyUrl(url)) {
    files = await downloadWithSpotdl(url);
  } else {
    files = await downloadWithYtDlp(url);
  }

  if (files.length === 0) {
    console.log("\x1b[33m[WARN]\x1b[0m No MP3 files were downloaded.");
    process.exit(1);
  }

  console.log(`\n\x1b[32m[SUCCESS]\x1b[0m Downloaded ${files.length} track(s)`);
  generateM3U(name, files);
  console.log(
    `\n\x1b[1mDone! Copy music/ and playlists/ to your USB drive for car playback.\x1b[0m\n`
  );
}

async function interactiveMode() {
  console.log("\n\x1b[1mMusic Downloader & Playlist Creator\x1b[0m\n");
  console.log("  1. Download by genre (auto-find hits)");
  console.log("  2. Download by URL\n");

  const choice = await promptInput("Choose mode (1 or 2): ");

  if (choice === "1") {
    console.log(`\n\x1b[33mAvailable genres:\x1b[0m ${GENRES.join(", ")}\n`);
    const genre = await promptInput("Enter genre: ");
    if (!genre) {
      console.error("No genre provided.");
      process.exit(1);
    }
    const limitStr = await promptInput("How many tracks? (default: 10): ");
    const limit = parseInt(limitStr, 10) || 10;
    const name =
      (await promptInput("Playlist name (press Enter for default): ")) || null;

    await genreFlow(genre, limit, name);
  } else {
    const url = await promptInput("Enter URL (YouTube/Spotify/SoundCloud): ");
    if (!url) {
      console.error("No URL provided.");
      process.exit(1);
    }
    const name =
      (await promptInput("Playlist name (default: My Playlist): ")) || "My Playlist";

    await urlFlow(url, name);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || (args._positional.length === 0 && !args.genre && !args.interactive)) {
    printUsage();
    process.exit(0);
  }

  try {
    if (args.interactive) {
      await interactiveMode();
    } else if (args.genre) {
      await genreFlow(args.genre, args.limit || 10, args.name);
    } else {
      await urlFlow(args._positional[0], args._positional[1] || args.name);
    }
  } catch (err) {
    console.error(`\n\x1b[31m[ERROR]\x1b[0m ${err.message}`);
    process.exit(1);
  }
}

main();

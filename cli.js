#!/usr/bin/env node

const readline = require("readline");
const { runGenre, runArtist, runSong, runUrl } = require("./src/pipeline");
const { GENRE_LIST, getGenreConfig } = require("./src/config/genres");
const { DEFAULT_LIMIT } = require("./src/config/constants");
const log = require("./src/utils/logger");

// ─── Arg parsing ───

function parseArgs(argv) {
  const args = { _positional: [] };
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === "--genre" || argv[i] === "-g") {
      args.genre = argv[++i];
    } else if (argv[i] === "--artist" || argv[i] === "-a") {
      args.artist = argv[++i];
    } else if (argv[i] === "--song" || argv[i] === "-s") {
      args.song = argv[++i];
    } else if (argv[i] === "--limit" || argv[i] === "-l") {
      args.limit = parseInt(argv[++i], 10);
    } else if (argv[i] === "--name" || argv[i] === "-n") {
      args.name = argv[++i];
    } else if (argv[i] === "--url" || argv[i] === "-u") {
      args.url = argv[++i];
    } else if (argv[i] === "--dry-run" || argv[i] === "--dry") {
      args.dryRun = true;
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

// ─── Usage ───

function printUsage() {
  console.log(`
\x1b[1mMusic Downloader & Playlist Creator\x1b[0m
  Download hit songs by genre with smart ranking.

\x1b[33mGenre mode (recommended):\x1b[0m
  node cli.js --genre <genre> [--limit 10] [--name "Playlist Name"] [--dry-run]

\x1b[33mArtist mode:\x1b[0m
  node cli.js --artist <name> [--limit 5] [--name "Playlist Name"] [--dry-run]

\x1b[33mSingle song:\x1b[0m
  node cli.js --song "Calm Down Rema"

\x1b[33mURL mode:\x1b[0m
  node cli.js --url <url> [--name "Playlist Name"]

\x1b[33mInteractive mode:\x1b[0m
  node cli.js -i

\x1b[33mExamples:\x1b[0m
  node cli.js --genre afrobeats
  node cli.js --genre "hip-hop" --limit 20 --name "Hip Hop Bangers"
  node cli.js --genre classical --dry-run          # preview without downloading
  node cli.js --genre gospel --limit 15
  node cli.js --artist "Burna Boy" --limit 5       # top 5 Burna Boy songs
  node cli.js --artist "Adele" --dry-run            # preview Adele's best
  node cli.js --song "Calm Down Rema"              # download a single song
  node cli.js --song "Someone Like You Adele"      # search and download
  node cli.js --url "https://youtube.com/watch?v=xxx" --name "My Song"

\x1b[33mHow it works:\x1b[0m
  1. Scrapes Spotify playlists for the genre (real curated hits)
  2. Enriches with YouTube view counts
  3. Scores each song: playlist appearances + position + views + recency
  4. Applies diversity cap (max 2 songs per artist)
  5. Downloads top songs as MP3 via yt-dlp
  6. Generates M3U playlist for car/USB playback

\x1b[33mAvailable genres:\x1b[0m
  ${GENRE_LIST.join(", ")}
  (or type any genre — it will search Spotify for playlists)

\x1b[33mFlags:\x1b[0m
  --genre, -g     Genre to download
  --artist, -a    Artist to download top songs for
  --song, -s      Search and download a single song by name
  --limit, -l     Number of tracks (default: ${DEFAULT_LIMIT})
  --name, -n      Playlist name
  --url, -u       Direct URL to download
  --dry-run       Preview ranked songs without downloading
  --interactive   Interactive mode
  --help, -h      Show this help
  `);
}

// ─── Interactive mode ───

function prompt(question) {
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

async function interactiveMode() {
  log.header("Music Downloader & Playlist Creator");
  console.log("  1. Download by genre (smart hit detection)");
  console.log("  2. Download top songs by artist");
  console.log("  3. Download a single song by name");
  console.log("  4. Download by URL\n");

  const choice = await prompt("Choose mode (1, 2, 3 or 4): ");

  if (choice === "1") {
    console.log(`\nAvailable genres: ${GENRE_LIST.join(", ")}\n`);
    const genre = await prompt("Enter genre: ");
    if (!genre) {
      log.error("No genre provided.");
      process.exit(1);
    }

    const limitStr = await prompt(`How many tracks? (default: ${DEFAULT_LIMIT}): `);
    const limit = parseInt(limitStr, 10) || DEFAULT_LIMIT;

    const name = (await prompt("Playlist name (Enter for default): ")) || null;

    const dryStr = await prompt("Preview only? (y/N): ");
    const dryRun = dryStr.toLowerCase() === "y";

    await runGenre({ genre, limit, name, dryRun });
  } else if (choice === "2") {
    const artist = await prompt("Enter artist name: ");
    if (!artist) {
      log.error("No artist provided.");
      process.exit(1);
    }
    const limitStr = await prompt("How many tracks? (default: 5): ");
    const limit = parseInt(limitStr, 10) || 5;
    const name = (await prompt("Playlist name (Enter for default): ")) || null;
    const dryStr = await prompt("Preview only? (y/N): ");
    const dryRun = dryStr.toLowerCase() === "y";

    await runArtist({ artist, limit, name, dryRun });
  } else if (choice === "3") {
    const song = await prompt("Enter song name (e.g. Calm Down Rema): ");
    if (!song) {
      log.error("No song name provided.");
      process.exit(1);
    }
    await runSong({ song });
  } else {
    const url = await prompt("Enter URL: ");
    if (!url) {
      log.error("No URL provided.");
      process.exit(1);
    }
    const name = (await prompt("Playlist name (default: My Playlist): ")) || "My Playlist";
    await runUrl({ url, name });
  }
}

// ─── Main ───

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || (args._positional.length === 0 && !args.genre && !args.artist && !args.song && !args.url && !args.interactive)) {
    printUsage();
    process.exit(0);
  }

  try {
    if (args.interactive) {
      await interactiveMode();
    } else if (args.genre) {
      await runGenre({
        genre: args.genre,
        limit: args.limit || DEFAULT_LIMIT,
        name: args.name,
        dryRun: args.dryRun || false,
      });
    } else if (args.artist) {
      await runArtist({
        artist: args.artist,
        limit: args.limit || 5,
        name: args.name,
        dryRun: args.dryRun || false,
      });
    } else if (args.song) {
      await runSong({
        song: args.song,
        dryRun: args.dryRun || false,
      });
    } else if (args.url || args._positional[0]) {
      await runUrl({
        url: args.url || args._positional[0],
        name: args.name || args._positional[1] || "My Playlist",
      });
    } else {
      printUsage();
    }
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }
}

main();

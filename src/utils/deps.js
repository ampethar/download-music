const { execSync,spawnSync } = require("child_process");
const fs = require("fs");
const { MUSIC_DIR, PLAYLISTS_DIR } = require("../config/constants");
const log = require("./logger");

function checkDependency(cmd, name, installHint) {
  const finder = process.platform === "win32" ? "where" : "which";

  const result = spawnSync(finder, [cmd], {
    stdio: "ignore"
  });

  if (result.status === 0) {
    return true;
  }

  console.error(
    `\x1b[31m[ERROR]\x1b[0m ${name} is not installed. Install it with: ${installHint}`
  );

  return false;
}

function checkAllDeps() {
  let ok = true;
  if (!checkDependency("yt-dlp", "yt-dlp", "pip install yt-dlp")) ok = false;
  if (!checkDependency("ffmpeg", "ffmpeg", "sudo apt install ffmpeg")) ok = false;
  return ok;
}

function ensureDirs() {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
}

module.exports = { checkDependency, checkAllDeps, ensureDirs };

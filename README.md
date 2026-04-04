# Music Downloader & Playlist Creator

A smart CLI tool that finds, ranks, and downloads hit songs by **genre**, **artist**, or **song name** — then generates M3U playlists ready for car USB playback.

## How It Works

```
Search YouTube Music  -->  Filter junk  -->  Score & Rank  -->  Download MP3  -->  Generate Playlist
```

**Genre mode** uses a hit detection system:

1. **Candidate Collection** — Searches YouTube Music with multiple queries to build a pool of 50+ songs
2. **Filtering** — Removes mixes, compilations, DJ sets, and anything over 10 minutes
3. **Hit Scoring** — Ranks each song using a weighted formula:
   - Playlist count (30%) — song appeared in multiple searches = stronger signal
   - Position (25%) — ranked higher in search results = more relevant
   - Play count (25%) — 759M streams beats 1M streams
   - Recency (20%) — newer songs get a boost
4. **Diversity Control** — Max 2 songs per artist so one artist doesn't dominate
5. **Download** — Downloads top N songs as MP3 via yt-dlp
6. **Playlist** — Generates `.m3u` playlist file

## Installation

### Prerequisites

```bash
# Required
sudo apt install ffmpeg
pip install yt-dlp

# Install Node.js dependencies
npm install
```

### Playwright Browser

Playwright (used for YouTube Music scraping) installs Chromium automatically with `npm install`. If needed:

```bash
npx playwright install chromium
```

## Usage

### Download by Genre

```bash
node cli.js --genre afrobeats
node cli.js --genre "hip-hop" --limit 20 --name "Hip Hop Bangers"
node cli.js --genre gospel --limit 15
node cli.js --genre amapiano --name "Amapiano 2026"
```

### Download by Artist

```bash
node cli.js --artist "Burna Boy" --limit 5
node cli.js --artist "Adele" --limit 10 --name "Adele Collection"
node cli.js --artist "Wizkid"
```

### Download a Single Song

```bash
node cli.js --song "Calm Down Rema"
node cli.js --song "Someone Like You Adele"
node cli.js --song "Bohemian Rhapsody"
```

### Download by URL

```bash
node cli.js --url "https://youtube.com/watch?v=xxxxx" --name "My Song"
node cli.js --url "https://soundcloud.com/artist/track"
```

### Preview Without Downloading

```bash
node cli.js --genre afrobeats --dry-run
node cli.js --artist "Drake" --limit 10 --dry-run
```

### Interactive Mode

```bash
node cli.js -i
```

## Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--genre` | `-g` | Genre to download hits for |
| `--artist` | `-a` | Artist to download top songs for |
| `--song` | `-s` | Search and download a single song by name |
| `--url` | `-u` | Direct URL to download |
| `--limit` | `-l` | Number of tracks (default: 10 for genre, 5 for artist) |
| `--name` | `-n` | Custom playlist name |
| `--dry-run` | | Preview ranked results without downloading |
| `--interactive` | `-i` | Interactive mode |
| `--help` | `-h` | Show help |

## Supported Genres

`afrobeats` `hip-hop` `pop` `r&b` `rock` `latin` `country` `gospel` `reggae` `jazz` `electronic` `classical` `amapiano` `dancehall` `bongo-flava` `gengetone` `k-pop` `reggaeton` `drill` `indie`

Any genre not in this list will still work — the tool searches YouTube Music dynamically.

## Output

```
~/Music/        --> Downloaded MP3 files
playlists/      --> Generated .m3u playlist files
```

Copy `~/Music/` and `playlists/` to a USB drive and plug it into your car stereo.

## Project Structure

```
cli.js                          # CLI entry point
src/
  config/
    constants.js                # Blacklist, directories, limits
    genres.js                   # Genre-to-search-query mapping
  scrapers/
    spotify.js                  # YouTube Music scraper (Playwright)
    youtube.js                  # yt-dlp wrapper (search, metadata, download)
  scoring/
    hitScore.js                 # Weighted hit score engine
    diversity.js                # Artist diversity cap
  playlist/
    m3u.js                      # M3U playlist generator
  utils/
    logger.js                   # Colored console output
    format.js                   # Filename sanitization, normalization, dedup
    deps.js                     # Dependency checker
  pipeline.js                   # Orchestrator (collect -> score -> download -> playlist)
```

## Hit Score Formula

```
score =
  (playlistCount * 30) +      // appeared in multiple searches
  (positionScore * 25) +      // higher position in results
  (playsNormalized * 25) +    // YouTube Music play count (log-scaled)
  (recencyScore * 20)         // newer songs get a boost
```

All signals are normalized to 0-1 within the batch before weighting. A song with 759M plays appearing in 4 out of 6 searches will consistently rank #1.

## Examples

```
$ node cli.js --genre afrobeats --dry-run

Top 10 Afrobeats Hits:

   1. Ayra Starr - Rush
      [3:06 | 759.0M plays | in 4 searches | score: 86.0]
   2. Lojay & Sarz - Monalisa
      [3:34 | 306.0M plays | in 4 searches | score: 78.4]
   3. Fireboy DML & Asake - Bandana
      [2:59 | 224.0M plays | in 2 searches | score: 62.5]
   ...
```

```
$ node cli.js --artist "Burna Boy" --limit 5 --dry-run

Top 5 songs by Burna Boy:

   1. Last Last
      [2:53 | 453.0M plays | score: 83.6]
   2. It's Plenty
      [3:37 | 112.0M plays | score: 78.7]
   3. Ye
      [3:52 | 354.0M plays | score: 77.8]
   ...
```

## Troubleshooting

**yt-dlp errors / "Signature extraction failed"**
Update yt-dlp: `pip install -U yt-dlp`

**No results found for genre**
YouTube Music may not return results for very niche genres. Try broader terms or use `--song` to download individual tracks.

**Playwright browser not found**
Run: `npx playwright install chromium`

**ffmpeg not found**
Install: `sudo apt install ffmpeg`

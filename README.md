# mussheum

An open-source SSH art gallery. Visitors connect via `ssh your-host.example.com` and browse curated artwork rendered directly in the terminal.

Built with [Wish](https://github.com/charmbracelet/wish) (Go SSH server), [React Ink](https://github.com/vadimdemedes/ink) (TUI), and [ink-picture](https://github.com/nicholasgasior/ink-picture) (terminal image rendering).

## Architecture

```
ssh your-host             ssh your-host submit < art.zip
       |                            |
       v                            v
+--------------+         +--------------+  +--------------+
|  Go SSH +    |  spawns |  Bun/Ink TUI |  |  Submission   |
|  HTTP Server |-------->|  (per session)|  |  Handler      |
|  (Wish)      |   PTY   |              |  |  (-> R2)      |
+--------------+         +--------------+  +--------------+
       |                         |
       | serves                  v
       v                 +--------------+
+--------------+         |  gallery/    |
|  Website     |         |  (local dir) |
|  (embedded)  |         +--------------+
+--------------+
```

- **Go server** (`server/`) -- Wish-based SSH server + embedded HTTP server for the website
- **TUI app** (`tui/`) -- React Ink gallery with artwork browsing and detail views
- **Gallery** (`gallery/`) -- Local directory of artwork folders; no database required
- **Website** (`server/www/`) -- Static site embedded in the Go binary
- **Submissions** -- Artists pipe a zip via SSH, validated and uploaded to S3-compatible storage
- **Worker** (`worker/`) -- Optional Cloudflare Worker for email notifications on new submissions

## Quick Start

### Prerequisites

- [Go](https://go.dev/) 1.21+
- [Bun](https://bun.sh/) 1.0+

### Build & Run

```bash
# Install TUI dependencies + build everything
./build.sh

# Start the server (SSH on :2222, HTTP on :8080)
cd server && ./mussheum-server

# Connect
ssh -p 2222 localhost
```

### Development

For fast TUI iteration without an SSH connection:

```bash
cd tui && bun install
bun tui/tui.tsx --user-key=test
```

## Gallery Setup

### Configuration

The gallery is configured via `gallery/config.json`. All fields have sensible defaults.

```json
{
  "name": "mussheum",
  "tagline": "an ssh art gallery",
  "exhibition": "Example Exhibition",
  "accentColor": "cyan",
  "secondaryColor": "magenta",
  "curationDate": "2026",
  "utmSource": "mussheum",
  "utmMedium": "ssh",
  "subscribeEnabled": true,
  "sortOrder": "newest",
  "splash": "bigtext",
  "submitMethod": "github-pr",
  "submitRepo": "owner/repo"
}
```

A full example config with all available fields is also provided in `gallery/config.example.json`.

| Field              | Type                  | Description                                                    |
|--------------------|-----------------------|----------------------------------------------------------------|
| `name`             | string                | Gallery name, shown in splash screen and footer                |
| `tagline`          | string                | Subtitle shown on the splash screen                            |
| `exhibition`       | string                | Current exhibition name                                        |
| `accentColor`      | string                | Ink color name for highlights and selection                     |
| `secondaryColor`   | string                | Ink color name for secondary elements                          |
| `curationDate`     | string                | Included in UTM campaign parameters                            |
| `utmSource`        | string                | UTM source appended to artwork URLs                            |
| `utmMedium`        | string                | UTM medium appended to artwork URLs                            |
| `newsletterUrl`    | string                | Optional. URL for newsletter CTA on exit screen                |
| `newsletterCta`    | string                | Optional. Text for the newsletter link                         |
| `submissionsUrl`   | string                | Optional. URL for submissions CTA                              |
| `submissionsCta`   | string                | Optional. Text for the submissions link                        |
| `hours`            | array or `"closed"`   | Optional. Gallery opening hours (see below)                    |
| `subscribeEnabled` | boolean               | Optional. Set `false` to hide in-TUI subscribe prompt (default `true`) |
| `sortOrder`        | string                | Optional. `"newest"`, `"oldest"`, `"title"`, `"artist"`, or `"random"` (default `"newest"`) |
| `splash`           | string                | Optional. Splash screen mode: `"bigtext"`, `"logo"`, `"ascii"`, or `"image"` (default `"bigtext"`) |
| `submitMethod`     | string                | Optional. Set to `"github-pr"` to enable in-TUI submissions via GitHub PRs |
| `submitRepo`       | string                | Required when `submitMethod` is set. GitHub repo in `owner/repo` format |
| `auth`             | object                | Optional. OAuth authentication config (see below)                      |

### Authentication

Restrict gallery access to members of an OAuth-enabled community. When enabled, users with unrecognized SSH keys see a one-time auth URL. They authenticate in a browser, and their SSH key is permanently approved.

Auth is **disabled by default**. To enable it, add an `auth` block to your config and set the required environment variables.

```json
{
  "auth": {
    "provider": "oauth",
    "authorizeUrl": "https://provider.example.com/oauth/authorize",
    "tokenUrl": "https://provider.example.com/oauth/token",
    "profileUrl": "https://provider.example.com/api/me",
    "profileNameField": "name"
  }
}
```

| Field              | Description                                                            |
|--------------------|------------------------------------------------------------------------|
| `provider`         | Must be `"oauth"`                                                      |
| `authorizeUrl`     | OAuth authorization endpoint                                           |
| `tokenUrl`         | OAuth token exchange endpoint                                          |
| `profileUrl`       | API endpoint that returns user profile JSON (called with Bearer token) |
| `profileNameField` | Optional. JSON field to use as display name. Falls back to `first_name`/`last_name`, `name`, `login`, `username` |

**Environment variables** (required when auth is enabled):

| Variable            | Description                                              |
|---------------------|----------------------------------------------------------|
| `OAUTH_CLIENT_ID`   | OAuth app client ID                                      |
| `OAUTH_CLIENT_SECRET` | OAuth app client secret                                |
| `PUBLIC_URL`        | Your public-facing URL (e.g. `https://gallery.example.com`) |
| `ADMIN_TOKEN`       | Optional. Enables admin API for key management           |

**Setup:**

1. Register an OAuth app with your provider
2. Set the redirect URI to `https://<your-public-url>/auth/callback`
3. Set the env vars

Approved keys are persisted to `/data/approved-keys.json`.

**Admin API** (when `ADMIN_TOKEN` is set):

```bash
# Clear all approved keys (forces re-authentication)
curl -X POST https://<your-host>/auth/admin/clear-keys \
  -H "Authorization: Bearer <your-admin-token>"
```

### Gallery Hours

Control when the gallery is open. If `hours` is omitted, it's open 24/7.

```json
{ "hours": "closed" }
```

```json
{
  "hours": [
    {
      "days": [1, 3, 5],
      "open": "13:00",
      "close": "15:00",
      "tz": "America/New_York"
    }
  ]
}
```

| Field   | Type     | Description                                                        |
|---------|----------|--------------------------------------------------------------------|
| `days`  | number[] | Days of the week: 0=Sunday, 1=Monday, ..., 6=Saturday              |
| `open`  | string   | Opening time in 24h format (`"HH:MM"`)                             |
| `close` | string   | Closing time in 24h format (`"HH:MM"`)                             |
| `tz`    | string   | IANA timezone (e.g. `"America/New_York"`)                           |
| `week`  | string   | Optional. `"first"`, `"second"`, `"third"`, `"fourth"`, or `"last"` |

### Splash Screen

The `splash` config controls the splash screen appearance:

| Mode       | Files needed              | Description                                    |
|------------|---------------------------|------------------------------------------------|
| `"bigtext"` | none                     | Default. Gallery name in large ASCII text       |
| `"logo"`   | `gallery/logo.png`        | Small image above the bigtext title             |
| `"ascii"`  | `gallery/splash.txt`      | ASCII art file replaces bigtext (tagline still shown) |
| `"image"`  | `gallery/splash.png`      | Full-screen image, no text                      |

### Sort Order

The `sortOrder` config controls how artwork is displayed in the gallery list:

| Value      | Description                        |
|------------|------------------------------------|
| `"newest"` | Newest `dateAdded` first (default) |
| `"oldest"` | Oldest `dateAdded` first           |
| `"title"`  | Alphabetical by title              |
| `"artist"` | Alphabetical by artist             |
| `"random"` | Shuffled on each session           |

### Adding Artwork

Each piece lives in its own subdirectory under `gallery/`:

```
gallery/
  my-artwork/
    meta.json
    art.png
```

`meta.json` fields:

| Field       | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| `title`     | string | yes      | Display title                            |
| `artist`    | string | yes      | Artist name                              |
| `url`       | string | yes      | Link to the work                         |
| `artistUrl` | string | no       | Link to the artist's site                |
| `dateAdded` | string | yes      | ISO 8601 date (e.g. `2026-05-17`)        |
| `medium`    | string | no       | Medium/material                          |
| `statement` | string | no       | Artist statement (`\n\n` for paragraphs) |

### Curator's Note

Optional message on the home screen. Stored as `gallery/curator-note.md`:

```markdown
---
date: 2026
---

Welcome to the gallery.
```

### Exhibition Archive

Record past shows in `gallery/archive.json`. Visitors press `a` to browse.

```json
[
  {
    "exhibition": "First Exhibition",
    "pieces": [
      { "title": "Untitled", "artist": "Artist Name" }
    ]
  }
]
```

## Submitting Artwork

Artists can submit work directly via SSH:

```bash
ssh -p 2222 localhost submit < submission.zip
```

The zip must contain:
- **`meta.json`** -- title, artist, statement (required); url, artistUrl, email (optional)
- **One image** -- PNG or JPG, under 5MB, max 2000x2000px

Submissions are validated server-side and uploaded to S3-compatible storage (e.g. Cloudflare R2). Rate limited to 3 per SSH key per hour.

### GitHub PR Submissions

As an alternative to S3-based submissions, you can enable in-TUI submissions that open GitHub pull requests. This is useful for self-hosted setups without cloud storage.

Add to your `gallery/config.json`:

```json
{
  "submitMethod": "github-pr",
  "submitRepo": "owner/repo"
}
```

Set the `GITHUB_TOKEN` environment variable with a token that has write access to the repo. A [fine-grained personal access token](https://github.com/settings/tokens?type=beta) with **Contents** and **Pull requests** write permissions scoped to the target repo is recommended.

Visitors press `u` in the gallery to submit. The TUI collects:
- Title (required)
- Artist name (required)
- Image URL (required -- the image is downloaded and committed)
- Statement (optional)
- Artist URL (optional)

The submission creates a branch, commits `gallery/<slug>/meta.json` and the artwork image, and opens a PR for review.

## SSH Info Command

Query gallery metadata programmatically:

```bash
ssh -p 2222 localhost info
```

Returns JSON with name, tagline, exhibition, hours, status, and artwork count.

## Environment Variables

| Variable                | Description                                    |
|-------------------------|------------------------------------------------|
| `BUTTONDOWN_API_KEY`    | Optional. Buttondown API key for in-terminal subscribe |
| `AWS_ACCESS_KEY_ID`     | S3/R2 access key for submission uploads        |
| `AWS_SECRET_ACCESS_KEY` | S3/R2 secret key                               |
| `R2_ENDPOINT`           | S3-compatible endpoint URL                     |
| `R2_BUCKET`             | Bucket name for submissions                    |
| `GITHUB_TOKEN`          | Optional. GitHub token for PR-based submissions |
| `OAUTH_CLIENT_ID`       | Optional. OAuth client ID (enables auth)       |
| `OAUTH_CLIENT_SECRET`   | Optional. OAuth client secret                  |
| `PUBLIC_URL`            | Optional. Public URL for auth callbacks        |
| `ADMIN_TOKEN`           | Optional. Enables admin API for key management |
| `TUI_CMD`               | Override TUI command (default: compiled binary) |

## Deployment

The included `Dockerfile`, `fly.toml`, and `worker/` are set up for [Fly.io](https://fly.io) (hosting) and [Cloudflare](https://www.cloudflare.com/) (R2 for submission storage, Workers for email notifications). These are the first-class deployment targets, but nothing about the architecture is tightly coupled to them — the server is a standard Docker container, submissions go to any S3-compatible storage, and the email worker is optional.

### Fly.io

```bash
fly launch
fly volume create mussheum_vol --region ewr --size 1
fly secrets set AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... R2_ENDPOINT=... R2_BUCKET=...
fly deploy
```

The server exposes SSH on port 22 and HTTP on port 443 (via Fly's proxy).

### Stats

A pair of scripts in `scripts/` let you check visitor stats from your access log:

```bash
# Run against a local log file
./scripts/stats.sh today server/access.log

# Pull the log from Fly and run stats locally
./scripts/fly-stats.sh          # today (default)
./scripts/fly-stats.sh week     # last 7 days
./scripts/fly-stats.sh all      # all time
```

`fly-stats.sh` reads your app name from `fly.toml` and uses `fly ssh sftp get` to fetch the log.

## Controls

| Key       | Action                                          |
|-----------|-------------------------------------------------|
| Up / Down | Navigate gallery                                |
| Enter     | View artwork                                    |
| i         | Toggle info panel                               |
| a         | View past exhibitions                           |
| s         | Subscribe to updates (when `subscribeEnabled`)  |
| u         | Submit artwork (when `submitMethod` configured) |
| b / Esc   | Back                                            |
| q         | Quit                                            |

## Customizing the Website

The static website is embedded in the Go binary from `server/www/`. Edit the HTML files to match your gallery:

- `server/www/index.html` -- Homepage
- `server/www/join/index.html` -- Newsletter signup page
- `server/www/submissions/index.html` -- Submission instructions

Search for placeholder text like `your-host.example.com` and `mussheum` and replace with your own values.

## Project Structure

```
mussheum/
  build.sh                    # Builds TUI binary and SSH server
  Dockerfile                  # Multi-stage build (Bun + Go)
  fly.toml                    # Fly.io config
  entrypoint.sh               # Docker entrypoint
  gallery/
    config.json               # Gallery configuration
    config.example.json       # Example config with all fields
    curator-note.md           # Optional curator's note
    archive.json              # Optional past exhibitions
    <slug>/
      meta.json               # Artwork metadata
      art.png                 # Artwork image
  server/
    main.go                   # SSH + HTTP server, PTY bridge, logging
    auth.go                   # OAuth authentication + admin API
    submit.go                 # Submission handler + command middleware
    info.go                   # SSH info command handler
    www/                      # Embedded static website
      index.html
      join/index.html
      submissions/index.html
  tui/
    tui.tsx                   # Entry point
    app.tsx                   # Screen routing + state
    lib/
      gallery.ts              # Gallery data loader + hours logic
    components/
      gallery-list.tsx        # Artwork list with curator's note
      artwork-detail.tsx      # Artwork view + info panel
      splash.tsx              # Splash screen
      archive-screen.tsx      # Past exhibitions
      closed-screen.tsx       # Gallery closed message
      exit-screen.tsx         # Exit screen
      subscribe-prompt.tsx    # In-terminal newsletter subscription
      submit-prompt.tsx       # In-terminal GitHub PR submission
      auth-screen.tsx         # OAuth authentication screen
      footer.tsx              # Keybinding hints
  scripts/
    stats.sh                    # Parse access log and report visitor stats
    fly-stats.sh                # Pull log from Fly and run stats locally
  worker/                       # Optional: Cloudflare Worker for email notifications
    src/index.js                # Queue consumer + email sender
    wrangler.toml               # Worker configuration
    package.json
```

## License

MIT

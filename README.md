# TryHackMe Profile Badge

A GitHub Action that auto-generates and updates a TryHackMe profile badge every 12 hours.

![Badge](assets/uploadme.png)

## How It Works

1. Fetches `https://tryhackme.com/badge/140548` via **ScraperAPI** (bypasses Vercel bot protection on CI runners; falls back to direct HTTPS locally).
2. Decodes the base64-encoded badge HTML from TryHackMe's embed endpoint.
3. Extracts **username**, **points**, **rank**, and **rooms** from the decoded HTML.
4. Downloads the user's **avatar** from TryHackMe's S3 CDN (not behind Vercel).
5. Loads a **vendored SVG background** (`assets/thm_public_badge_bg.svg`) from the repo.
6. Renders the badge HTML with **inline SVG icons** (no external CDN) using Puppeteer.
7. Screenshots the result to `assets/uploadme.png` and commits the update.

## Tech Stack

- **Node.js 22** + **Puppeteer** (with system Chromium fallback)
- **ScraperAPI** with `render=true` for reliable fetching from GitHub Actions runners (Vercel blocks datacenter IPs)
- Inline SVG icons — no Font Awesome or external CSS dependencies
- Vendored background SVG — no external image requests during render

## Setup

### Prerequisites
- Node.js 22+
- GitHub repository with Actions enabled

### Secrets

Add `SCRAPER_API_KEY` to your GitHub repo secrets (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `SCRAPER_API_KEY` | Your ScraperAPI key (free tier: 5,000 requests/month) |

### Local Development

```bash
npm install
SCRAPER_API_KEY=your_key DEBUG=1 node index.js
```

Without `SCRAPER_API_KEY`, falls back to direct HTTPS fetch (works on residential IPs).

## Project Structure

```
index.js                              — Main script (fetch → decode → extract → render → screenshot)
assets/uploadme.png                   — Generated badge image (329x88 PNG)
assets/thm_public_badge_bg.svg        — Vendored badge background
.github/workflows/update-badge.yml    — GitHub Actions workflow (every 12 hours)
```

## Workflow

The GitHub Action runs automatically every 12 hours and on manual dispatch:

- Fetches fresh stats via ScraperAPI
- Generates the badge PNG
- Commits and pushes if the image changed

## License

MIT

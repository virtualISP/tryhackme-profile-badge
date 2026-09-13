const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');

const BADGE_URL = 'https://tryhackme.com/badge/140548';
const OUTPUT_PATH = path.join(__dirname, 'assets', 'uploadme.png');

const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
function debugLog(...args) { if (DEBUG) console.log('[DEBUG]', ...args); }
function debugFile(name, content) {
  if (!DEBUG) return;
  const dir = path.join(__dirname, 'debug');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, name);
  fs.writeFileSync(fp, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  console.log(`[DEBUG] Saved ${fp} (${content.length || 0} bytes)`);
}

// ─── Launch options for Puppeteer ─────────────────────────────────────
function getLaunchOptions() {
  const { execSync } = require('child_process');
  let chromiumPath;
  for (const bin of ['chromium-browser', 'chromium', 'google-chrome', 'google-chrome-stable']) {
    try { chromiumPath = execSync(`which ${bin}`, { encoding: 'utf8' }).trim(); break; } catch {}
  }

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=VizDisplayCompositor',
    '--no-first-run',
    '--no-default-browser-check'
  ];
  const launchOpts = { args: launchArgs, headless: 'new', ignoreDefaultArgs: ['--enable-automation'] };

  if (chromiumPath) {
    launchOpts.executablePath = chromiumPath;
    console.log(`Using system Chromium: ${chromiumPath}`);
  } else {
    console.log('No system Chromium found — using Puppeteer bundled Chromium');
  }

  return launchOpts;
}

// ─── Badge HTML fetch via Puppeteer ───────────────────────────────────
async function fetchBadgeHTML() {
  const browser = await puppeteer.launch(getLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 329, height: 88 });
    await page.goto(BADGE_URL, { waitUntil: 'networkidle0' });
    let html = await page.content();
    await browser.close();

    // TryHackMe badge page returns base64-encoded HTML: document.write(window.atob("..."))
    const atobMatch = html.match(/document\.write\(window\.atob\("([^"]+)"\)\)/);
    if (atobMatch) {
      const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf-8');
      debugLog('Decoded badge HTML:', decoded.length, 'bytes');
      debugFile('badge-decoded.html', decoded);
      return decoded;
    }

    // Maybe the HTML is not encoded but still contains the badge
    if (html.includes('thm_badge') || html.includes('thm_nickname')) {
      debugLog('Badge HTML not encoded, using raw');
      debugFile('badge-raw.html', html);
      return html;
    }

    console.warn('Could not decode badge HTML via atob');
    console.warn('First 500 chars:', html.substring(0, 500));
    debugFile('badge-decode-failure.html', html);
    throw new Error('Badge page did not contain expected content');
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// ─── Stats extraction from badge HTML ───────────────────────────────
function extractStatsFromBadgeHTML(html) {
  // Pattern 1: <span class="thm_stat...">value</span>
  let statsMatches = [...html.matchAll(/<span class="thm_stat[^"]*">([^<]+)<\/span>/g)];
  if (statsMatches.length >= 3) {
    debugLog('Stats via thm_stat:', statsMatches.map(m => m[1]));
    return statsMatches.map(m => m[1]);
  }

  // Pattern 2: <span class="details-text">value</span>
  statsMatches = [...html.matchAll(/<span class="details-text">([^<]+)<\/span>/g)];
  if (statsMatches.length >= 3) {
    debugLog('Stats via details-text:', statsMatches.map(m => m[1]));
    return statsMatches.map(m => m[1]);
  }

  // Pattern 3: Any three consecutive numbers in spans
  const allNums = [...html.matchAll(/<span[^>]*>\s*(\d[\d,]*)\s*<\/span>/g)].map(m => m[1].replace(/,/g, ''));
  if (allNums.length >= 3) {
    debugLog('Stats via all spans:', allNums.slice(0, 5));
    return allNums.slice(0, 3);
  }

  debugLog('No stats found in HTML. First 1000 chars:', html.substring(0, 1000));
  return [];
}

// ─── Avatar download ────────────────────────────────────────────────
async function downloadImageAsDataUri(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const base64 = Buffer.concat(data).toString('base64');
        const mime = res.headers['content-type'] || 'image/png';
        resolve(`data:${mime};base64,${base64}`);
      });
    }).on('error', reject);
  });
}

// ─── Badge HTML builder ─────────────────────────────────────────────
async function buildHTML(stats) {
  // 1. Download avatar from S3 (not behind Vercel)
  let avatarDataUri;
  try {
    avatarDataUri = await downloadImageAsDataUri(stats.avatarUrl);
  } catch (err) {
    console.warn('Avatar download failed, using fallback:', err.message);
    avatarDataUri = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"%3E%3Ccircle cx="30" cy="30" r="30" fill="%23333"/%3E%3C/svg%3E';
  }

  // 2. Load background SVG from local asset (committed to repo)
  const bgSvgPath = path.join(__dirname, 'assets', 'thm_public_badge_bg.svg');
  let bgDataUri;
  try {
    if (fs.existsSync(bgSvgPath)) {
      const svgContent = fs.readFileSync(bgSvgPath, 'utf8');
      bgDataUri = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    } else {
      throw new Error('SVG file not found');
    }
  } catch (err) {
    console.warn('Background SVG load failed, using fallback:', err.message);
    bgDataUri = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="329" height="88"%3E%3Crect width="329" height="88" fill="%23121212" rx="12"/%3E%3C/svg%3E';
  }

  return `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Ubuntu:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet" />
  <style>
    body { width: 329px; height: 88px; margin: 0; background: transparent; }
    #thm-badge { width: 327px; height: 84px; background-image: url('${bgDataUri}'); background-size: cover; display: flex; align-items: center; gap: 12px; border-radius: 12px; }
    .thm-avatar-outer { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(to bottom left, #a3ea2a, #2e4463); padding: 2px; margin-left: 10px; display: flex; align-items: center; justify-content: center; }
    .thm-avatar { width: 60px; height: 60px; background-image: url('${avatarDataUri}'); background-size: cover; background-position: center; border-radius: 50%; background-color: #121212; box-shadow: 0 0 3px 0 #303030; }
    .badge-user-details { display: flex; flex-direction: column; gap: 8px; }
    .title-wrapper { display: flex; align-items: center; gap: 6px; }
    .user_name { font-family: 'Ubuntu', sans-serif; font-weight: 500; font-size: 14px; color: #f9f9fb; max-width: 135px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rank-icon { color: #ffbb45; font-size: 10px; }
    .rank-title { font-family: Ubuntu, sans-serif; font-weight: 500; font-size: 12px; color: #ffffff; }
    .details-wrapper { display: flex; gap: 8px; }
    .details-icon-wrapper { display: flex; gap: 5px; align-items: center; }
    .detail-icons { font-weight: 900; font-size: 11px; }
    .trophy-icon { color: #9ca4b4; }
    .award-icon { color: #d752ff; font-size: 13px; }
    .door-closed-icon { color: #719cf9; font-size: 12px; }
    .details-text { font-family: Ubuntu, sans-serif; font-weight: 400; font-size: 11px; color: #ffffff; }
    .thm-link { font-family: Ubuntu, sans-serif; font-weight: 400; font-size: 11px; color: #f9f9fb; text-decoration: none; }
  </style>
</head>
<body>
  <div id="thm-badge">
    <div class="thm-avatar-outer"><div class="thm-avatar"></div></div>
    <div class="badge-user-details">
      <div class="title-wrapper">
        <span class="user_name">${stats.username}</span>
        <div><i class="fa-solid fa-bolt-lightning rank-icon"></i><span class="rank-title">${stats.rankTitle}</span></div>
      </div>
      <div class="details-wrapper">
        <div class="details-icon-wrapper"><i class="fa-solid fa-trophy detail-icons trophy-icon"></i><span class="details-text">${stats.points}</span></div>
        <div class="details-icon-wrapper"><i class="fa-solid fa-award detail-icons award-icon"></i><span class="details-text">${stats.rank}</span></div>
        <div class="details-icon-wrapper"><i class="fa-solid fa-door-closed detail-icons door-closed-icon"></i><span class="details-text">${stats.rooms}</span></div>
      </div>
      <a href="https://tryhackme.com" class="thm-link" target="_blank">tryhackme.com</a>
    </div>
  </div>
</body>
</html>`;
}

// ─── Screenshot ─────────────────────────────────────────────────────
async function takeScreenshot(html) {
  const browser = await puppeteer.launch(getLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 329, height: 88 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.thm-avatar');
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: OUTPUT_PATH, omitBackground: true });
    await browser.close();
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  try {
    if (DEBUG) console.log('[DEBUG] Mode enabled — saving raw HTML to debug/');

    const html = await fetchBadgeHTML();

    // Extract username, rankTitle, avatarUrl from badge HTML
    const nicknameMatch = html.match(/<span class="thm_nickname">([^<]+)<\/span>/);
    const username = nicknameMatch ? nicknameMatch[1] : 'virtualISP';

    const rankMatch = html.match(/<span class="thm_rank">([^<]+)<\/span\s*>/);
    const rankTitle = rankMatch ? rankMatch[1] : '[0xE]';

    let avatarUrl = null;
    const avatarMatch = html.match(/class="thm_avatar"[^>]*style="[^"]*background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if (avatarMatch) {
      avatarUrl = avatarMatch[1];
      if (avatarUrl.startsWith('user-avatars/')) {
        avatarUrl = 'https://tryhackme-images.s3.amazonaws.com/' + avatarUrl;
      }
    }
    if (!avatarUrl) {
      const anyUrlMatch = html.match(/user-avatars\/([^'")]+)/);
      avatarUrl = anyUrlMatch ? 'https://tryhackme-images.s3.amazonaws.com/user-avatars/' + anyUrlMatch[1] : null;
    }
    if (!avatarUrl) {
      avatarUrl = 'https://tryhackme-images.s3.amazonaws.com/user-avatars/9868455b210665b03783b489764e48df.png';
    }

    const statsArray = extractStatsFromBadgeHTML(html);
    if (statsArray.length < 3) {
      console.warn('Stats extraction failed. HTML length:', html.length);
      console.warn('Has thm_nickname:', html.includes('thm_nickname'));
      console.warn('Has thm_stat:', html.includes('thm_stat'));
      throw new Error(`Expected at least 3 stats from badge, got ${statsArray.length}`);
    }
    const [points, rooms, rank] = statsArray;

    const stats = { username, rankTitle, avatarUrl, points, rank, rooms };

    const badgeHTML = await buildHTML(stats);
    await takeScreenshot(badgeHTML);

    console.log('Badge generated successfully!');
    console.log(`   Username: ${stats.username}`);
    console.log(`   Points: ${stats.points}`);
    console.log(`   Rank: ${stats.rank}`);
    console.log(`   Rooms: ${stats.rooms}`);
  } catch (err) {
    console.error('Failed to generate badge:', err.message);
    process.exit(1);
  }
}

main();
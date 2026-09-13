const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BADGE_URL = 'https://tryhackme.com/badge/140548';
const PROFILE_URL = 'https://tryhackme.com/p/virtualISP';
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

// FlareSolverr configuration
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || '';
const USE_FLARESOLVERR = FLARESOLVERR_URL.length > 0;

// ─── FlareSolverr client ───────────────────────────────────────────
async function fetchViaFlareSolverr(url, options = {}) {
  if (!USE_FLARESOLVERR) throw new Error('FLARESOLVERR_URL not set');

  const payload = JSON.stringify({
    cmd: 'request.get',
    url: url,
    maxTimeout: options.maxTimeout || 120000,
  });

  const parsedUrl = new URL(FLARESOLVERR_URL);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('FlareSolverr timeout')), 150000);

    const req = http.request(parsedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      clearTimeout(timeout);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'ok' && json.solution) {
            const body = json.solution.response;
            debugLog(`FlareSolverr response for ${url}: ${body.length} bytes`);
            resolve(body);
          } else {
            const msg = json.message || 'unknown error';
            reject(new Error(`FlareSolverr: ${msg}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      clearTimeout(timeout);
      reject(e);
    });
    req.write(payload);
    req.end();
  });
}

// ─── Badge HTML fetch & decode ──────────────────────────────────────
async function fetchBadgeHTML() {
  if (!USE_FLARESOLVERR) throw new Error('FlareSolverr not configured');

  const rawHtml = await fetchViaFlareSolverr(BADGE_URL);
  debugFile('badge-raw.html', rawHtml);

  // Check if we got a Vercel challenge page
  if (rawHtml.includes('x-vercel-challenge') || rawHtml.includes('Just a moment')) {
    throw new Error('FlareSolverr returned a Vercel challenge page for badge URL');
  }

  // TryHackMe badge page returns base64-encoded HTML: document.write(window.atob("..."))
  const atobMatch = rawHtml.match(/document\.write\(window\.atob\("([^"]+)"\)\)/);
  if (atobMatch) {
    const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf-8');
    debugLog('Decoded badge HTML:', decoded.length, 'bytes');
    debugFile('badge-decoded.html', decoded);
    return decoded;
  }

  // Maybe the HTML is not encoded but still contains the badge
  if (rawHtml.includes('thm_badge') || rawHtml.includes('thm_nickname')) {
    debugLog('Badge HTML not encoded, using raw');
    return rawHtml;
  }

  // Last resort: dump and try to extract from whatever we got
  console.warn('⚠️ Could not decode badge HTML via atob');
  console.warn('First 500 chars:', rawHtml.substring(0, 500));
  debugFile('badge-decode-failure.html', rawHtml);
  return rawHtml;
}

// ─── Streak extraction ──────────────────────────────────────────────
async function fetchStreak() {
  if (!USE_FLARESOLVERR) throw new Error('FlareSolverr not configured');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const html = await fetchViaFlareSolverr(PROFILE_URL);

      if (attempt === 1) {
        debugFile('profile-raw.html', html);
        debugLog('Profile HTML length:', html.length);
      }

      // Check for Vercel challenge
      if (html.includes('x-vercel-challenge') || html.includes('Just a moment')) {
        throw new Error('FlareSolverr returned a Vercel challenge page for profile URL');
      }

      // Pattern 1: React structure - "Streak" heading followed by fire icon SVG then number
      let match = html.match(/>Streak<\/div>[\s\S]*?<\/svg><\/div><span[^>]*>(\d+)<\/span>/i);
      if (match) { debugLog('Streak P1 match:', match[1]); return match[1]; }

      // Pattern 2: "Streak" followed by any container with a number
      match = html.match(/>Streak<\/div>[\s\S]{0,500}?(?:span|div)[^>]*>(\d+)<\/(?:span|div)>/i);
      if (match) { debugLog('Streak P2 match:', match[1]); return match[1]; }

      // Pattern 3: aria-label="Streak" nearby number
      match = html.match(/aria-label="Streak[^"]*"[^>]*>[^<]*<[^>]*>(\d+)/i);
      if (match) { debugLog('Streak P3 match:', match[1]); return match[1]; }

      // Pattern 4: section with id="streak" or similar containing a number
      match = html.match(/id="streak"[^>]*>[\s\S]{0,300}?(\d+)/i);
      if (match) { debugLog('Streak P4 match:', match[1]); return match[1]; }

      // Pattern 5: Plain text "Streak 459" or "Streak: 459" (but NOT "Streak notifications")
      match = html.match(/>Streak<[^>]*>[^<]*(?:<[^>]*>)*\s*(\d+)/i);
      if (match) { debugLog('Streak P5 match:', match[1]); return match[1]; }

      // Pattern 6: data attribute
      match = html.match(/data-streak["\s]*[:=]\s*["']?(\d+)["']/i);
      if (match) { debugLog('Streak P6 match:', match[1]); return match[1]; }

      // Pattern 7: JSON-LD or embedded data
      match = html.match(/"streak"\s*:\s*(\d+)/i);
      if (match) { debugLog('Streak P7 match:', match[1]); return match[1]; }

      // Find ALL numbers within 2000 chars of "Streak"/"streak" for debugging
      const streakIdx = html.search(/streak/i);
      if (streakIdx >= 0) {
        const context = html.substring(streakIdx, Math.min(html.length, streakIdx + 2000));
        const nearbyNums = [...context.matchAll(/>(\d{1,6})</g)].map(m => m[1]);
        console.warn('Numbers near "streak":', nearbyNums.slice(0, 10));
        if (attempt === 1) {
          console.warn('Profile HTML length:', html.length);
          console.warn('Profile preview (first 1000 chars):', html.substring(0, 1000));
          debugFile('streak-context.txt', context);
          debugFile('profile-failure.html', html);
        }
      } else {
        console.warn('No "streak" text found in profile HTML');
        console.warn('Profile HTML length:', html.length);
        console.warn('Profile preview (first 1000 chars):', html.substring(0, 1000));
      }

      if (attempt < 3) {
        console.warn(`Streak not found (attempt ${attempt}/3), retrying...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      console.warn('⚠️ Could not extract streak after 3 attempts');
      return '0';
    } catch (err) {
      if (attempt < 3) {
        console.warn(`Streak fetch failed (attempt ${attempt}/3): ${err.message}, retrying...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
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

  // Pattern 3: Look for thm_icon + thm_stat pairs
  const iconStatMatches = [...html.matchAll(/<img[^>]*class="thm_icon"[^>]*>[\s\S]*?<span[^>]*>(\d[\d,]*)<\/span>/g)];
  if (iconStatMatches.length >= 3) {
    debugLog('Stats via icon+stat:', iconStatMatches.map(m => m[1]));
    return iconStatMatches.map(m => m[1].replace(/,/g, ''));
  }

  // Pattern 4: trophy/door/target in any attribute
  const trophyMatch = html.match(/trophy[^>]*>\s*(\d[\d,]*)/i);
  const doorMatch = html.match(/door[^>]*>\s*(\d[\d,]*)/i);
  const targetMatch = html.match(/target[^>]*>\s*(\d[\d,]*)/i);
  if (trophyMatch && doorMatch && targetMatch) {
    debugLog('Stats via trophy/door/target:', [trophyMatch[1], doorMatch[1], targetMatch[1]]);
    return [trophyMatch[1], doorMatch[1], targetMatch[1]];
  }

  // Pattern 5: Any three consecutive numbers in spans near icons
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
    .fire-icon { color: #a3ea2a; font-size: 13px; }
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
        <div class="details-icon-wrapper"><i class="fa-solid fa-fire detail-icons fire-icon"></i><span class="details-text">${stats.streak}</span></div>
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
  // Find chromium binary — try common paths, fall back to Puppeteer's bundled Chromium
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

  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  await page.setViewport({ width: 329, height: 88 });
  
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.thm-avatar');
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.screenshot({ path: OUTPUT_PATH, omitBackground: true });
  await browser.close();
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  try {
    if (DEBUG) console.log('[DEBUG] Mode enabled — saving raw HTML to debug/');

    const html = await fetchBadgeHTML();
    const streak = await fetchStreak();
    
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
      console.warn('⚠️ Stats extraction failed. HTML length:', html.length);
      console.warn('HTML preview (first 1000 chars):', html.substring(0, 1000));
      // Check for known patterns
      console.warn('Has thm_nickname:', html.includes('thm_nickname'));
      console.warn('Has thm_stat:', html.includes('thm_stat'));
      console.warn('Has thm_badge:', html.includes('thm_badge'));
      console.warn('Has details-text:', html.includes('details-text'));
      throw new Error(`Expected at least 3 stats from badge, got ${statsArray.length}`);
    }
    const [points, rooms, rank] = statsArray;
    
    const stats = { username, rankTitle, avatarUrl, points, streak, rank, rooms };
    
    const badgeHTML = await buildHTML(stats);
    await takeScreenshot(badgeHTML);
    
    console.log('✅ Badge generated successfully!');
    console.log(`   Username: ${stats.username}`);
    console.log(`   Points: ${stats.points}`);
    console.log(`   Streak: ${stats.streak}`);
    console.log(`   Rank: ${stats.rank}`);
    console.log(`   Rooms: ${stats.rooms}`);
  } catch (err) {
    console.error('❌ Failed to generate badge:', err.message);
    process.exit(1);
  }
}

main();

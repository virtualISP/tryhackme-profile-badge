const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BADGE_URL = 'https://tryhackme.com/badge/140548';
const PROFILE_URL = 'https://tryhackme.com/p/virtualISP';
const OUTPUT_PATH = path.join(__dirname, 'assets', 'uploadme.png');

async function fetchBadgeHTML() {
  console.log('Launching browser to fetch badge...');
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/usr/bin/chromium',
    headless: 'new'
  });
  const page = await browser.newPage();
  
  // Set realistic viewport and user agent
  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0');
  
  // Navigate to badge page with retry
  let html;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(BADGE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      console.log(`Navigation attempt ${attempt} failed, retrying...`);
      await new Promise(r => setTimeout(r, 10000 * attempt));
    }
  }
  
  // Wait for challenge to resolve - if Vercel challenge is present, wait longer
  console.log('Waiting for badge content to load...');
  try {
    await page.waitForFunction(() => {
      // The badge page renders via document.write(atob(...)) 
      // which sets innerHTML - look for the badge container
      const html = document.documentElement.innerHTML;
      return html.includes('thm_badge') && !html.includes('Vercel Security Checkpoint');
    }, { timeout: 120000 });
    console.log('Badge content detected');
  } catch (e) {
    console.log('Timeout waiting for badge content, checking anyway...');
  }
  
  // Additional wait for JS rendering
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  html = await page.content();
  console.log('Page HTML length:', html.length);
  
  // Check if we got the challenge page
  if (html.includes('Vercel Security Checkpoint')) {
    console.log('WARNING: Still on Vercel challenge page');
  }
  
  await browser.close();
  
  // Decode the base64 content from the page
  const decoded = decodeBadgeHTML(html);
  console.log('Decoded HTML length:', decoded.length);
  console.log('Decoded HTML preview:', decoded.substring(0, 2000));
  
  return decoded;
}

async function fetchStreak() {
  console.log('Launching browser to fetch streak from profile...');
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/usr/bin/chromium',
    headless: 'new'
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0');
  
  await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  
  // Wait for the Vercel challenge to resolve - profile page may take a while
  console.log('Waiting for profile page to load (may include Vercel challenge)...');
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      // Check if we're past the Vercel challenge
      if (text.includes('Vercel Security Checkpoint') || text.includes('spinner')) {
        return false;
      }
      // Look for user-specific content (username or streak)
      return text.includes('virtualISP') && text.match(/Streak\s+(\d+)/i) !== null;
    }, { timeout: 180000 });
    console.log('Profile page loaded with stats');
  } catch (e) {
    console.log('Profile page did not load stats in time, trying anyway...');
  }
  
  // Debug: log page text
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('Profile page text preview:', pageText.substring(0, 1500));
  
  // Also check if we hit the challenge
  if (pageText.includes('Vercel Security Checkpoint')) {
    console.log('WARNING: Still on Vercel challenge on profile page');
  }
  
  // Extract streak from profile page text content
  const streak = await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/Streak\s+(\d+)/i);
    return match ? match[1] : null;
  });
  
  await browser.close();
  console.log('Extracted streak:', streak);
  return streak || '0';
}

function decodeBadgeHTML(html) {
  // The badge page returns a base64-encoded HTML document via document.write(atob(...))
  const match = html.match(/document\.write\(window\.atob\("([^"]+)"\)\)/);
  if (!match) {
    // Fallback: maybe it's not encoded
    console.log('No base64 encoding found, using raw HTML');
    return html;
  }
  const encoded = match[1];
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  console.log('Decoded HTML length:', decoded.length);
  return decoded;
}

async function downloadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${res.statusCode}`));
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

function extractStats(html, streak) {
  // Extract username and rank title from .thm_nickname and .thm_rank
  const nicknameMatch = html.match(/<span class="thm_nickname">([^<]+)<\/span>/);
  const username = nicknameMatch ? nicknameMatch[1] : 'virtualISP';
  
  // Extract rank title - handle potential line breaks in closing tag
  const rankMatch = html.match(/<span class="thm_rank">([^<]+)<\/span\s*>/);
  const rankTitle = rankMatch ? rankMatch[1] : '[0xD]';
  
  // Extract avatar URL from the thm_avatar div's style attribute
  let avatarUrl = null;
  const avatarMatch = html.match(/class="thm_avatar"[^>]*style="[^"]*background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
  if (avatarMatch) {
    avatarUrl = avatarMatch[1];
    // If it's a relative path, prepend the base URL
    if (avatarUrl.startsWith('user-avatars/')) {
      avatarUrl = 'https://tryhackme-images.s3.amazonaws.com/' + avatarUrl;
    }
  } else {
    // Fallback: any url() in the HTML for avatars
    const anyUrlMatch = html.match(/user-avatars\/([^'")]+)/);
    avatarUrl = anyUrlMatch ? 'https://tryhackme-images.s3.amazonaws.com/user-avatars/' + anyUrlMatch[1] : null;
  }
  
  // Hardcoded fallback if extraction fails
  if (!avatarUrl) {
    avatarUrl = 'https://tryhackme-images.s3.amazonaws.com/user-avatars/9868455b210665b03783b489764e48df.png';
  }
  
  // Extract stats using flexible multi-pattern matching
  const stats = extractStatsFromBadgeHTML(html);
  console.log('Extracted stats:', stats);
  if (stats.length < 3) {
    console.log('DEBUG: HTML preview:', html.substring(0, 3000));
    throw new Error(`Expected at least 3 stats, found ${stats.length}`);
  }
  
  // Order: trophy (points), door (rooms), target (rank)
  const [points, rooms, rank] = stats;
  
  return { username, rankTitle, avatarUrl, points, streak, rank, rooms };
}

function extractStatsFromBadgeHTML(html) {
  // Try multiple patterns to extract stats
  // Pattern 1: base64-decoded format (.thm_stat spans)
  let statsMatches = [...html.matchAll(/<span class="thm_stat[^"]*">([^<]+)<\/span>/g)];
  if (statsMatches.length >= 3) {
    return statsMatches.map(m => m[1]);
  }
  
  // Pattern 2: raw HTML format (different class names)
  statsMatches = [...html.matchAll(/<span class="details-text">([^<]+)<\/span>/g)];
  if (statsMatches.length >= 3) {
    return statsMatches.map(m => m[1]);
  }
  
  // Pattern 3: look for numbers near icon indicators
  const text = html;
  const trophyMatch = text.match(/trophy[^>]*>\s*(\d+)/i);
  const doorMatch = text.match(/door[^>]*>\s*(\d+)/i);
  const targetMatch = text.match(/target[^>]*>\s*(\d+)/i);
  if (trophyMatch && doorMatch && targetMatch) {
    return [trophyMatch[1], doorMatch[1], targetMatch[1]];
  }
  
  // Pattern 4: look for stats in any order with icons
  const allStats = [...text.matchAll(/(?:trophy|door|target)[^>]*>\s*(\d+)/gi)];
  if (allStats.length >= 3) {
    return allStats.map(m => m[1]);
  }
  
  return [];
}

async function buildHTML(stats) {
  // Download avatar and convert to base64 to avoid CORS/loading issues
  let avatarDataUri;
  try {
    console.log('Downloading avatar...');
    avatarDataUri = await downloadImageAsBase64(stats.avatarUrl);
  } catch (err) {
    console.warn('Failed to download avatar, using fallback placeholder:', err.message);
    // Use a simple colored circle as fallback
    avatarDataUri = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"%3E%3Ccircle cx="30" cy="30" r="30" fill="%23333"/%3E%3C/svg%3E';
  }

  return `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Ubuntu:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet" />
  <style>
    body {
      width: 329px;
      height: 88px;
      margin: 0;
      background: transparent;
    }
    #thm-badge {
      width: 327px;
      height: 84px;
      background-image: url('https://tryhackme.com/img/thm_public_badge_bg.svg');
      background-size: cover;
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 12px;
    }
    .thm-avatar-outer {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(to bottom left, #a3ea2a, #2e4463);
      padding: 2px;
      margin-left: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thm-avatar {
      width: 60px;
      height: 60px;
      background-image: url('${avatarDataUri}');
      background-size: cover;
      background-position: center;
      border-radius: 50%;
      background-color: #121212;
      box-shadow: 0 0 3px 0 #303030;
    }
    .badge-user-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .title-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .user_name {
      font-family: 'Ubuntu', sans-serif;
      font-weight: 500;
      font-size: 14px;
      color: #f9f9fb;
      max-width: 135px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rank-icon {
      color: #ffbb45;
      font-size: 10px;
    }
    .rank-title {
      font-family: Ubuntu, sans-serif;
      font-weight: 500;
      font-size: 12px;
      color: #ffffff;
    }
    .details-wrapper {
      display: flex;
      gap: 8px;
    }
    .details-icon-wrapper {
      display: flex;
      gap: 5px;
      align-items: center;
    }
    .detail-icons {
      font-weight: 900;
      font-size: 11px;
    }
    .trophy-icon { color: #9ca4b4; }
    .fire-icon { color: #a3ea2a; font-size: 13px; }
    .award-icon { color: #d752ff; font-size: 13px; }
    .door-closed-icon { color: #719cf9; font-size: 12px; }
    .details-text {
      font-family: Ubuntu, sans-serif;
      font-weight: 400;
      font-size: 11px;
      color: #ffffff;
    }
    .thm-link {
      font-family: Ubuntu, sans-serif;
      font-weight: 400;
      font-size: 11px;
      color: #f9f9fb;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div id="thm-badge">
    <div class="thm-avatar-outer">
      <div class="thm-avatar"></div>
    </div>
    <div class="badge-user-details">
      <div class="title-wrapper">
        <span class="user_name">${stats.username}</span>
        <div>
          <i class="fa-solid fa-bolt-lightning rank-icon"></i>
          <span class="rank-title">${stats.rankTitle}</span>
        </div>
      </div>
      <div class="details-wrapper">
        <div class="details-icon-wrapper">
          <i class="fa-solid fa-trophy detail-icons trophy-icon"></i>
          <span class="details-text">${stats.points}</span>
        </div>
        <div class="details-icon-wrapper">
          <i class="fa-solid fa-fire detail-icons fire-icon"></i>
          <span class="details-text">${stats.streak}</span>
        </div>
        <div class="details-icon-wrapper">
          <i class="fa-solid fa-award detail-icons award-icon"></i>
          <span class="details-text">${stats.rank}</span>
        </div>
        <div class="details-icon-wrapper">
          <i class="fa-solid fa-door-closed detail-icons door-closed-icon"></i>
          <span class="details-text">${stats.rooms}</span>
        </div>
      </div>
      <a href="https://tryhackme.com" class="thm-link" target="_blank">tryhackme.com</a>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  try {
    console.log('Fetching badge HTML via browser...');
    const html = await fetchBadgeHTML();
    
    console.log('Fetching streak from profile...');
    const streak = await fetchStreak();
    
    const stats = extractStats(html, streak);
    console.log('Stats extracted:', stats);

    const badgeHTML = await buildHTML(stats);
    
    // Screenshot with retry
    let screenshotSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Screenshot attempt ${attempt}...`);
        await takeScreenshot(badgeHTML);
        console.log('✅ Exact badge screenshot saved!');
        screenshotSuccess = true;
        break;
      } catch (e) {
        console.log(`Screenshot attempt ${attempt} failed:`, e.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!screenshotSuccess) throw new Error('All screenshot attempts failed');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

async function takeScreenshot(html) {
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/usr/bin/chromium',
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 329, height: 88 });
  
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  // Wait for avatar to be present and then a bit more
  await page.waitForSelector('.thm-avatar');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await page.screenshot({ path: OUTPUT_PATH, omitBackground: true });
  
  await browser.close();
}

main();

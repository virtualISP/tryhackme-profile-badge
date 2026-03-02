const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const https = require('https');

const API_URL = 'https://tryhackme.com/api/v2/badges/public-profile?userPublicId=140548';
const OUTPUT_PATH = path.join(__dirname, 'assets', 'uploadme.png');

async function fetchStats() {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return await response.text();
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

function extractStats(html) {
  // Extract username
  const username = html.match(/<span class="user_name">([^<]+)<\/span>/)?.[1] || 'virtualISP';
  
  // Extract rank title
  const rankTitle = html.match(/<span class="rank-title">([^<]+)<\/span>/)?.[1] || '[0xD]';
  
  // Extract avatar URL - look for it in the style block
  let avatarUrl = null;
  const styleMatch = html.match(/\.thm-avatar\s*{[^}]*background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
  if (styleMatch) {
    avatarUrl = styleMatch[1];
  } else {
    // Fallback: any url() in the HTML
    const anyUrlMatch = html.match(/url\(['"]?([^'")]+)['"]?\)/);
    avatarUrl = anyUrlMatch ? anyUrlMatch[1] : null;
  }
  
  // Hardcoded fallback if extraction fails (using your avatar from earlier)
  if (!avatarUrl) {
    avatarUrl = 'https://tryhackme-images.s3.amazonaws.com/user-avatars/9868455b210665b03783b489764e48df.png';
  }
  
  // Extract four stats
  const statsMatches = [...html.matchAll(/<span class="details-text">([^<]+)<\/span>/g)];
  if (statsMatches.length < 4) throw new Error(`Expected 4 stats, found ${statsMatches.length}`);
  const [points, streak, rank, rooms] = statsMatches.map(m => m[1]);
  
  return { username, rankTitle, avatarUrl, points, streak, rank, rooms };
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
    console.log('Fetching stats...');
    const html = await fetchStats();
    const stats = extractStats(html);
    console.log('Stats extracted:', stats);

    const badgeHTML = await buildHTML(stats);

    console.log('Launching browser...');
    const browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 329, height: 88 });
    
    await page.setContent(badgeHTML, { waitUntil: 'networkidle0' });
    
    // Wait for avatar to be present and then a bit more
    await page.waitForSelector('.thm-avatar');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Taking screenshot...');
    await page.screenshot({ path: OUTPUT_PATH, omitBackground: true });

    await browser.close();
    console.log('✅ Exact badge screenshot saved!');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

main();

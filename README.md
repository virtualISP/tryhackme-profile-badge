# 🛡️ TryHackMe Badge

<div align="center">

[![Update Badge](https://github.com/virtualISP/tryhackme-profile-badge/actions/workflows/update-badge.yml/badge.svg)](https://github.com/virtualISP/tryhackme-profile-badge/actions/workflows/update-badge.yml)
[![Last Commit](https://img.shields.io/github/last-commit/virtualISP/tryhackme-profile-badge)](https://github.com/virtualISP/tryhackme-profile-badge/commits/main)
[![Profile](https://img.shields.io/badge/TryHackMe-virtualISP-1f8c2f?logo=tryhackme&logoColor=white)](https://tryhackme.com/p/virtualISP)

</div>

---

## 📊 My Live Stats

This badge updates **every 12 hours** with my latest TryHackMe progress – rank, rooms completed, and badges.  
Click the badge to visit my profile!

<div align="center">
  <a href="https://tryhackme.com/p/virtualISP">
    <img src="./assets/uploadme.png" alt="TryHackMe Badge">
  </a>
</div>

---

## ✨ Features

- **⏱️ Updates every 12 hours** – Always shows current stats.
- **🎨 Exact replica** – Uses the official TryHackMe badge design (background, icons, avatar).
- **🤖 Fully automated** – Powered by GitHub Actions and Puppeteer.
- **🔗 Clickable** – Takes you straight to my TryHackMe profile.

---

## 🔄 How It Works

1. A GitHub Action runs every 12 hours (or can be triggered manually).
2. It fetches my latest stats from TryHackMe via ScraperAPI.
3. Puppeteer renders the official badge HTML with my stats, avatar, and exact THM icons.
4. A PNG screenshot is saved to `assets/uploadme.png`.
5. If the image changed (i.e., stats updated), it’s committed back to the repo.

---

## 🚀 Run Your Own

Want an automatically updating TryHackMe badge for your own profile?
Fork this repository and update the `userPublicId` in `index.js` with your own ID (find it in the iframe embed code from TryHackMe).
Then enable GitHub Actions – that’s it!

## ⚙️ Setup

To run this in GitHub Actions, you need to set up a ScraperAPI key:

1. Get a free ScraperAPI key from [scraperapi.com](https://www.scraperapi.com/) (free tier: 5,000 requests/month)
2. In your forked repository, go to Settings → Secrets → Actions
3. Create a new secret named `SCRAPER_API_KEY` with your key value
4. Enable GitHub Actions - the workflow will automatically run every 12 hours

Without `SCRAPER_API_KEY`, the action falls back to direct HTTPS fetch (works only on non-blocked IPs).

---

## 📝 License

This project is open source under the [MIT License](LICENSE).  
The TryHackMe badge design and assets are property of TryHackMe.

---

## 🙌 Acknowledgements

- [TryHackMe](https://tryhackme.com) for the awesome platform.
- [Puppeteer](https://pptr.dev/) for headless browser rendering.
- [GitHub Actions](https://github.com/features/actions) for the automation.

---

<div align="center">
  Made with ❤️ by virtualISP
</div>

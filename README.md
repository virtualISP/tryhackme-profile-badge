# 🛡️ TryHackMe Badge

<div align="center">

[![Update Badge](https://github.com/virtualISP/tryhackme-badge/actions/workflows/update-badge.yml/badge.svg)](https://github.com/virtualISP/tryhackme-badge/actions/workflows/update-badge.yml)

[![Profile](https://img.shields.io/badge/TryHackMe-virtualISP-1f8c2f?logo=tryhackme&logoColor=white)](https://tryhackme.com/p/virtualISP)

</div>

---

## 📊 My Live Stats

This badge updates **every hour** with my latest TryHackMe progress – points, rank, and rooms completed. Click the badge to visit my profile!

<div align="center">
  <a href="https://tryhackme.com/p/virtualISP">
    <img src="./assets/uploadme.png" alt="TryHackMe Badge">
  </a>
</div>

---

## ✨ Features

- **⏱️ Hourly updates** – Always shows current stats.
- **🎨 Exact replica** – Uses the official TryHackMe badge design (background, icons, avatar).
- **🤖 Fully automated** – Powered by GitHub Actions with Puppeteer to bypass Vercel challenges.
- **🔗 Clickable** – Takes you straight to my TryHackMe profile.

---

## 🔄 How It Works

1. A GitHub Action runs every hour (or can be triggered manually).
2. It uses Puppeteer with stealth plugin to fetch the badge page (bypassing Vercel JS challenges).
3. Extracts stats: points, rank, rooms from the badge HTML.
4. Renders the official badge HTML with current stats and avatar.
5. Takes a high‑resolution PNG screenshot saved to `assets/uploadme.png`.
6. If the image changed (stats updated), it’s committed back to the repo.

---

## 🚀 Run Your Own

Want an automatically updating TryHackMe badge for your own profile?

1. **Fork this repository**.
2. Update the `BADGE_URL` constant in `index.js` with your own badge ID (find it in the iframe embed code from TryHackMe, e.g., `https://tryhackme.com/badge/123456`).
3. Enable GitHub Actions – that’s it!
   - The workflow already includes the necessary setup; no extra secrets are required.

---

## 🛠️ Local Setup (for testing)

1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Run the script:
   ```bash
   node index.js
   ```
3. Check `assets/uploadme.png` for the generated badge.

---

## 📝 License

This project is open source under the [MIT License](LICENSE).  The TryHackMe badge design and assets are property of TryHackMe.

---

## 🙌 Acknowledgements

- [TryHackMe](https://tryhackme.com) for the awesome platform.
- [Puppeteer](https://pptr.dev/) for headless browser rendering (used for screenshot generation).
- [GitHub Actions](https://github.com/features/actions) for the automation.

---

<div align="center">
  Made with ❤️ by virtualISP
</div>
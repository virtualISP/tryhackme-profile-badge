# 🛡️ TryHackMe Badge

<div align="center">

[![Update Badge](https://github.com/virtualISP/tryhackme-badge/actions/workflows/update-badge.yml/badge.svg)](https://github.com/virtualISP/tryhackme-badge/actions/workflows/update-badge.yml)

[![Profile](https://img.shields.io/badge/TryHackMe-virtualISP-1f8c2f?logo=tryhackme&logoColor=white)](https://tryhackme.com/p/virtualISP)

</div>

---

## 📊 My Live Stats

This badge updates **every hour** with my latest TryHackMe progress – points, streak, rank, and rooms completed. Click the badge to visit my profile!

<div align="center">
  <a href="https://tryhackme.com/p/virtualISP">
    <img src="./assets/uploadme.png" alt="TryHackMe Badge">
  </a>
</div>

---

## ✨ Features

- **⏱️ Hourly updates** – Always shows current stats.
- **🎨 Exact replica** – Uses the official TryHackMe badge design (background, icons, avatar).
- **🤖 Fully automated** – Powered by GitHub Actions with FlareSolverr to bypass Vercel/Cloudflare challenges.
- **🔗 Clickable** – Takes you straight to my TryHackMe profile.

---

## 🔄 How It Works

1. A GitHub Action runs every hour (or can be triggered manually).
2. It starts a **FlareSolverr** Docker container (self-hosted service) that solves Vercel/Cloudflare JS challenges.
3. The action fetches the badge and profile pages via FlareSolverr (getting fully rendered HTML).
4. Extracts stats: points, streak, rank, rooms from the badge/profile HTML.
5. Renders the official badge HTML with current stats and avatar.
6. Takes a high‑resolution PNG screenshot saved to `assets/uploadme.png`.
7. If the image changed (stats updated), it’s committed back to the repo.
8. FlareSolverr container is stopped after the run.

---

## 🚀 Run Your Own

Want an automatically updating TryHackMe badge for your own profile?

1. **Fork this repository**.
2. Update the `BADGE_URL` and `PROFILE_URL` constants in `index.js` with your own IDs (find them in the iframe embed code from TryHackMe, e.g., `https://tryhackme.com/badge/123456` and `https://tryhackme.com/p/yourUsername`).
3. Enable GitHub Actions – that’s it!
   - The workflow already includes a FlareSolverr service container; no extra secrets are required.

---

## 🛠️ Local Setup (for testing)

1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Start FlareSolverr:
   ```bash
   docker run -d -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest
   export FLARESOLVERR_URL=http://localhost:8191/v1
   ```
3. Run the script:
   ```bash
   node index.js
   ```
4. Check `assets/uploadme.png` for the generated badge.
5. Stop FlareSolverr when done:
   ```bash
   docker rm -f $(docker ps -q -f ancestor=ghcr.io/flaresolverr/flaresolverr:latest)
   ```

---

## 📝 License

This project is open source under the [MIT License](LICENSE).  
The TryHackMe badge design and assets are property of TryHackMe.

---

## 🙌 Acknowledgements

- [TryHackMe](https://tryhackme.com) for the awesome platform.
- [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr) for solving Vercel/Cloudflare challenges.
- [Puppeteer](https://pptr.dev/) for headless browser rendering (used for screenshot generation).
- [GitHub Actions](https://github.com/features/actions) for the automation.

---

<div align="center">
  Made with ❤️ by virtualISP
</div>
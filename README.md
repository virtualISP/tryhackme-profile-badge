# 🛡️ TryHackMe Badge

<div align="center">

[![Update Badge](https://github.com/virtualISP/tryhackme-badge/actions/workflows/update-badge.yml/badge.svg)](https://github.com/virtualISP/tryhackme-badge/actions/workflows/update-badge.yml)

[![Profile](https://img.shields.io/badge/TryHackMe-virtualISP-1f8c2f?logo=tryhackme&logoColor=white)](https://tryhackme.com/p/virtualISP)

</div>

---

## 📊 My Live Stats

This badge updates **every hour** with my latest TryHackMe progress – points, streak, rank, and rooms completed.  
Click the badge to visit my profile!

<div align="center">
  <a href="https://tryhackme.com/p/virtualISP">
    <img src="./assets/uploadme.png" alt="TryHackMe Badge">
  </a>
</div>

---

## ✨ Features

- **⏱️ Hourly updates** – Always shows current stats.
- **🎨 Exact replica** – Uses the official TryHackMe badge design (background, icons, avatar).
- **🤖 Fully automated** – Powered by GitHub Actions and Puppeteer.
- **🔗 Clickable** – Takes you straight to my TryHackMe profile.

---

## 🔄 How It Works

1. A GitHub Action runs every hour (or can be triggered manually).
2. It fetches my latest stats from the TryHackMe public API.
3. Puppeteer renders the official badge HTML with my stats and avatar.
4. A high‑resolution PNG screenshot is saved to `assets/uploadme.png`.
5. If the image changed (i.e., stats updated), it’s committed back to the repo.

---

## 🚀 Run Your Own

Want an automatically updating TryHackMe badge for your own profile?  
Fork this repository and update the `userPublicId` in `index.js` with your own ID (find it in the iframe embed code from TryHackMe).  
Then enable GitHub Actions – that’s it!

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

# 📱 Instagram Unfollowers

[![CI](https://github.com/davidarroyo1234/InstagramUnfollowers/actions/workflows/ci.yaml/badge.svg)](https://github.com/davidarroyo1234/InstagramUnfollowers/actions/workflows/ci.yaml)
[![Maintenance](https://img.shields.io/maintenance/yes/2026)](https://github.com/davidarroyo1234/InstagramUnfollowers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A browser-based tool that shows you who doesn't follow you back on Instagram and lets you bulk-unfollow them. No download, no install, no server — paste a script into the developer console on instagram.com and you're done.

## ⚠️ Read this first

Bulk-unfollowing through Instagram's private endpoints **may violate the [Instagram Terms of Use](https://help.instagram.com/581066165581870)** and **can trigger temporary or permanent account restrictions**. Instagram actively rate-limits this kind of traffic. This project tries hard to stay below their thresholds (adaptive backoff, circuit breaker, randomized jitter), but no client-side safeguard makes the action _safe_.

You accept that risk by using this tool. The maintainers are not affiliated with, endorsed by, or connected to Instagram in any way.

## 🖥️ Desktop usage

1. Open [the bookmarklet page](https://davidarroyo1234.github.io/InstagramUnfollowers/) and press **COPY**.

    <img src="./assets/copy_code.png" alt="Copy code button" />

2. Log in to Instagram in another tab.
3. Open the developer console (Windows: `Ctrl + Shift + J`, macOS: `⌘ + ⌥ + I`).
4. Paste the script and press Enter. The UI takes over the tab:

    <img src="./assets/initial.png" alt="Initial screen" />

5. Click **RUN** to start scanning. After scanning, you'll see who doesn't follow back:

    <img src="./assets/results.png" alt="Results screen" />

6. 🤍 Whitelist users by clicking their profile image. The whitelist persists in `localStorage`.
7. 💾 Export / Import / Clear the whitelist from **Settings → Whitelist**:

    <img src="./assets/settings_whitelist.png" alt="Settings screen" />

8. ✅ Tick the users to unfollow and press **Unfollow**.
9. ⚙️ Adjust timings via **Settings** if you keep getting rate-limited:

    <img src="./assets/settings.png" alt="Settings screen" />

If Instagram rate-limits you mid-batch, the tool stops automatically and surfaces a typed error screen. Resume an interrupted batch on the next session — the unfollow queue is persisted to IndexedDB every five actions.

## 📱 Mobile usage

For Android:

1. Install [Eruda Browser](https://github.com/liriliri/eruda-android/releases/).
2. Open Instagram web inside Eruda.
3. Tap the Eruda icon → console, then follow the desktop steps.

## ⚡ Performance notes

- Runtime grows with the number of accounts you follow.
- Works on Chromium- and Firefox-based browsers.
- Mobile takes a couple of extra seconds to mount.
- Whitelist and timings live in `localStorage`. The in-flight unfollow queue lives in IndexedDB.

## ✨ Features

- 🔍 Scan and identify users who don't follow you back
- 🤍 Whitelist with export / import / merge
- 💾 Resume an interrupted unfollow batch (IndexedDB-backed queue)
- 🚦 Closed-loop rate limiter: backs off on Instagram's `feedback_required` / 429 responses
- ⛔ Circuit breaker stops the loop before a soft-ban escalates to a hard one
- 🔁 Dynamic GraphQL `query_hash` detection (no more breakage when Instagram rotates the hash)
- ⚙️ Customizable timings to dodge rate limits
- 🎨 Dark, minimalist UI
- 🔒 All data stays local — no external servers

## 🛠️ Development

```bash
nvm use            # Node 20 LTS (see .nvmrc)
npm install
npm test           # Vitest run, ~70 unit tests across core/ + state/
npm run build-dev  # webpack-dev-server on http://localhost:8080
npm run build      # production bundle + inline into public/index.html
```

For the dev preview UI without hitting Instagram's API, open
<http://localhost:8080/preview.html?preview=scanning>. The app detects
`localhost` and substitutes mock users for every fetch.

Architecture overview lives in [CLAUDE.md](CLAUDE.md). The short version:

- `src/core/` — pure, typed Instagram API layer (`fetchFollowingPage`, `unfollowUser`), adaptive rate limiter, circuit breaker, IndexedDB queue, dynamic query-hash detector.
- `src/hooks/` — `useScanner` + `useUnfollower` drive the long-running loops; share an `api-error-handler` that routes typed errors into the state machine.
- `src/state/` — pure selectors (`getUsersForDisplay`, etc.) and the discriminated `State` union (`initial | scanning | unfollowing | error`).
- `src/components/` — Preact UI. `components/ui/ConfirmDialog.tsx` exposes `useConfirm` + `useAlert` (replaces the native blocking dialogs).
- `src/main.tsx` — entry, mounts `<DialogProvider><App /></DialogProvider>` and wires the hooks to the state.

## 🤝 Contributing

PRs welcome. Before opening one:

1. **Branch off `master`** with a `feat/`, `fix/`, `refactor/`, or `docs/` prefix.
2. **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
3. **Tests stay green**: `npm test` must pass. Add tests for new logic in `src/core/` or `src/state/`.
4. **Builds stay green**: `npm run webpack-build` (CI gates on this).
5. **No new runtime deps without a reason.** Bundle size matters — this app ships as a string pasted into a browser console.

Bug reports and feature ideas go in [Issues](https://github.com/davidarroyo1234/InstagramUnfollowers/issues).

## ⚖️ Disclaimer & License

This tool is **not affiliated, associated, authorized, endorsed by, or officially connected with Instagram**. Using it may violate Instagram's Terms of Use. Use at your own risk.

Licensed under the [MIT License](LICENSE).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node version is pinned in `.nvmrc` to **16.14.0** (`nvm use`).

- `npm install` — install deps.
- `npm run webpack-build` — webpack production build only (`src/main.tsx` → `dist/dist.js`).
- `npm run build` — full release build: runs `webpack-build` then `scripts/update-index.js` to inline the minified bundle into `public/index.html`. This is what GitHub Pages serves.
- `npm run build-dev` — build once, then start `webpack-dev-server` in development mode.
- `npm run build-prod` — build once, then start dev server in production mode.
- `npm run update-readme` — re-inline `dist/dist.js` into `public/index.html` without rebuilding.

There is no `test` or `lint` npm script. ESLint config exists (`.eslintrc.json`, TS-aware, hooked into `tsconfig.json`). To lint manually: `npx eslint "src/**/*.{ts,tsx}"`. There are no unit tests in the repo.

CI (`.github/workflows/build_and_deploy_pages.yaml`) runs `npm run build` on push to `master` and deploys `public/` to GitHub Pages.

## Architecture

This is a **single-bundle Preact app that ships as a string of JavaScript to be pasted into Instagram's devtools console**. Understanding that distribution model is required to make sense of the build pipeline and the runtime guards.

### Distribution pipeline

1. `webpack.config.js` bundles `src/main.tsx` into `dist/dist.js`. React imports are aliased to `preact/compat` (both webpack `resolve.alias` and `tsconfig.json` `paths`), so `import { render } from "react-dom"` resolves to Preact at build time. `tsconfig.json` targets `es5` because the bundle runs in whatever browser the user has Instagram open in.
2. `scripts/update-index.js` reads `dist/dist.js`, escapes it, and splices it into `public/index.html` between the markers `const instagramScript = "` and `";//__END_OF_SCRIPT__`. The published landing page (`public/index.html`) is therefore *self-contained*: the COPY button copies that escaped string for the user to paste into Instagram's console. Do not hand-edit the area between those markers.
3. GitHub Pages serves `public/`. The app itself never runs from Pages — Pages is only the delivery vehicle for the script.

### Runtime modes

`src/main.tsx` branches on `location.hostname`:
- On `www.instagram.com` (`INSTAGRAM_HOSTNAME`): real mode. App wipes `document.body`, mounts itself, and hits Instagram's private GraphQL endpoints using cookies (`ds_user_id` for queries, `csrftoken` for unfollow POSTs). URLs are built in `src/utils/utils.ts` (`urlGenerator`, `unfollowUserUrlGenerator`).
- On `localhost` / `127.0.0.1` / `::1` (`LOCAL_PREVIEW_HOSTS`): preview mode. The scanning/unfollow `useEffect` loops early-return, and `onScan` populates state with mock users from `_getPreviewUsers()`. This is what makes `npm run build-dev` actually usable — without the guard, the dev server would 401 against Instagram. Append `?preview=scanning` for the scanning UI on first paint.
- On any other host: an `alert("Can be used only on Instagram routes")` is the only side effect.

### State machine

The whole app is a discriminated union `State` (`src/model/state.ts`) with `status: "initial" | "scanning" | "unfollowing"`. `src/main.tsx` switches on `state.status` to pick the top-level component (`NotSearching` / `Searching` / `Unfollowing`) and to gate every handler — handlers all `if (state.status !== "<expected>") return;` before touching state. New status values must be added to the union *and* handled in every switch, since `assertUnreachable(state)` in the default branches will trigger a TS error otherwise. That helper (in `utils.ts`) is the convention for exhaustive checks across the codebase.

The two long-running flows (scan, unfollow) are each a single `useEffect` keyed on `state.status` with intentionally incomplete deps and an `eslint-disable-next-line react-hooks/exhaustive-deps`. They read `timings` and `scanningPaused` (module-level `let`, toggled by `pauseScan`) by closure. Be careful changing the effect deps — re-firing them will re-run a partial scan.

### Anti-rate-limit timing

The scan and unfollow loops are deliberately jittered (random micro-pauses, long pauses every 5 cycles) using values from `Timings` (`src/model/timings.ts`). Defaults live in `src/constants/constants.ts`. The user can override via the settings menu; overrides persist in `localStorage` under `iu_timings` (see `src/utils/whitelist-manager.ts`).

### Persistence

Everything is local. `src/utils/whitelist-manager.ts` reads/writes two `localStorage` keys defined in `src/constants/constants.ts`:
- `iu_whitelisted-results` — whitelist of `UserNode[]`. Users in the whitelist are hidden from the unfollow candidates tab.
- `iu_timings` — `Timings` overrides.

The Settings menu (`src/components/SettingMenu.tsx`, `WhitelistManager.tsx`) also exports/imports the whitelist as JSON.

### Code style enforced by ESLint

Single quotes (`@typescript-eslint/quotes`), semis required, trailing commas always-multiline, `as-needed` arrow parens/body, `eqeqeq smart`, `no-unnecessary-condition`, `react-hooks/exhaustive-deps` as error (the two scan/unfollow effects suppress this on purpose — keep the disable comments). Underscore-prefixed args/vars are exempt from `no-unused-*` (the `_getPreviewUsers` / `_createPreviewUser` helpers rely on this).

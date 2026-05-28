# Contributing

Thanks for taking the time to look at this project. The repo aims to stay
small, auditable, and easy to fork. Most contributions can land in under
a hundred lines, and we want to keep it that way.

## Ground rules

1. **Open an issue first** for anything non-trivial — feature ideas,
   refactors, dependency bumps. A short discussion saves both of us
   from doing throwaway work.
2. **One pull request = one focused change.** Don't bundle a refactor
   with a feature with a doc update. Smaller PRs review faster.
3. **Stay within the security posture.** The app ships as a string the
   user pastes into Instagram's console. Anything you add runs in the
   user's live, authenticated Instagram tab. No analytics, no network
   calls to third parties, no `eval`, no remote code loading.

## Local setup

```bash
nvm use            # Node 20 LTS pinned in .nvmrc
npm install
npm test           # vitest run — must stay green
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src/**/*.{ts,tsx}
npm run build      # produces dist/dist.js and re-inlines it into public/index.html
```

For UI iteration without hitting Instagram, run the dev server and open
`/preview.html?preview=scanning`:

```bash
npm run build-dev
# open http://localhost:8080/preview.html?preview=scanning
```

`localhost` is detected as a preview host and the scan loop substitutes
mock users (`src/main.tsx`).

## Branch + commit conventions

- **Branch off `master`** with one of these prefixes: `feat/`, `fix/`,
  `refactor/`, `test/`, `docs/`, `chore/`.
- **Conventional Commits** for messages: `feat:`, `fix:`, `refactor:`,
  `test:`, `docs:`, `chore:`, optional `(scope)`.
- Squash + merge is the default when merging into `master`. Keep your
  branch's history clean enough that the squash summary still reads as
  a useful changelog entry.

## What CI gates on

- `npm test` — vitest suite must pass.
- `npm run webpack-build` — production bundle must compile.
- `npm run typecheck` — strict TS, no `any`, no unused locals.
- `npm run lint` — ESLint config in `.eslintrc.json`.

If you add a new test file, name it `*.test.ts` so vitest's `include`
picks it up. Component-render tests are out of scope right now (no
`@testing-library/preact` installed) — unit-test the pure helpers in
`src/core/`, `src/state/`, `src/utils/`, `src/i18n/` instead.

## What we will and will not accept

**Likely yes**

- Bug fixes with a reproduction test
- Performance improvements that come with measurements
- Accessibility fixes
- New translations under `src/i18n/dictionaries.ts`
- Documentation and clearer error messages

**Likely no without prior discussion**

- New runtime dependencies (the bundle has to stay paste-able)
- Replacing Preact with React or another framework
- Adding analytics, telemetry, or remote calls of any kind
- Anything that touches whitelist / IndexedDB persistence without a
  migration plan

## Disclosure

This project is not affiliated with Instagram. Using it may violate
their terms of service. By contributing, you confirm you understand
that and that your contribution is your own work, released under the
project's MIT license.

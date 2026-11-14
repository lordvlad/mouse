# Mouse Adventures

A choose-your-path reading game for first graders: the child reads short pages out loud and taps choices, finds things
behind glowing words and gets braver along the way. Starts with a page for parents (rules, tips, text size, reset).
First book: **Mouse** (Pip, a hungry and not very brave mouse), chapters *The Cheese* and *Sleeping Cats*.

Single-page, offline-first PWA. Static files in `public/`, no build step.

- **Stories:** markdown in `public/books/` (library -> books -> chapters -> scenes, with items, stats, flags,
  conditions and tappable words). Format: [WRITING.md](WRITING.md). Validate with `bun scripts/check.js`.
- **Engine:** `public/story.js` parses and runs the format (no DOM; the checker uses it too). UI and saved progress
  (`localStorage`, key `mouse-adventures`) live in `public/index.html`.
- **Run:** `bun src/server.ts` (`PORT`, default 8790).
- **Offline:** `public/sw.js` precaches the app shell (`ASSETS`) plus every file linked from `books/library.md`, following
  links through the books and chapters, so new stories need no change there. CI stamps the cache name with the commit hash.
- **Android:** `bun android/build.ts` wraps `public/` (stories included) in a WebView app (no Gradle; SDK at `$ANDROID_HOME`, default `/data/android-sdk`) and writes `public/mouse.apk`. Signing key: `android/mouse-debug.keystore` (gitignored, created on first build; password `android`).
- **Donate:** the heart (bottom right) opens a PayPal hosted-button modal behind a maths gate; inside the APK it opens PayPal's page in the system browser.

## Publish

Push to `main`; `.github/workflows/pages.yml` checks the books, then deploys `public/` to GitHub Pages (repo Settings > Pages > Source: GitHub Actions).
CI builds the APK and signs it with the secret `ANDROID_KEYSTORE_B64` (`base64 -w0 android/mouse-debug.keystore`); without it each build gets a throwaway key and can't update an installed copy. The run number is the versionCode.

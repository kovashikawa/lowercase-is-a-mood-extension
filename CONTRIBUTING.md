# Contributing

This extension is deliberately tiny: plain JavaScript, Manifest V3, no dependencies, no build step. It only changes CSS presentation and makes no network requests. Changes should keep it that way.

## Setup

Node 20 or newer. Nothing to install.

```sh
npm test             # unit tests plus manifest and package checks
npm run package      # builds dist/lowercase-is-a-mood-<version>.zip
```

To try a change in Chrome: open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, pick this folder, and click the reload icon after each edit.

## Pull requests

1. Branch from `main` and keep the change small and focused.
2. Add or update a test in `tests/` for any behavior change.
3. Run `npm test` and try the change in Chrome.
4. Open a PR. CI must pass before merge.

## Rules the tests enforce

- Manifest V3 only.
- Permissions are an allowlist in `tests/manifest.test.cjs`. Adding one needs maintainer sign-off, because it triggers a store re-review and a warning for existing users.
- No `eval`, `fetch`, remote scripts, or other remote code.
- A new runtime file must be added to `scripts/package.sh` and to `runtimeFiles` in `tests/manifest.test.cjs`. The package test fails if they disagree.

## Releases (maintainer)

1. Bump `version` in `manifest.json` in a PR and merge it.
2. Tag the merge commit: `git tag v0.1.1 && git push origin v0.1.1`.
3. The Release workflow checks the tag against the manifest, runs the tests, and attaches the zip to a GitHub Release.
4. Upload that zip in the Chrome Web Store developer dashboard.

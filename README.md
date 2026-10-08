# Lowercase Is a Mood

[![CI](https://github.com/kovashikawa/lowercase-is-a-mood-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/kovashikawa/lowercase-is-a-mood-extension/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Chrome extension version of the [site toggle](https://kovashikawa.com/design/projects/lowercase-is-a-mood/). Click the `a / A` button in the extension popup to switch the current site's rendered text between lowercase and its original case. The bold letter shows the active mode.

The choice is saved per origin, so tabs and reloads on that site use the same setting. The extension changes only CSS presentation. It does not rewrite text, form values, page source, or feeds, and it makes no network requests.

## Install locally

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open a regular web page and click the extension's toolbar icon. Pin it for one-click access to the popup.

Chrome asks for access to all websites because the extension must load its small CSS and script on pages before you toggle them. Preferences stay in local Chrome storage. Chrome's internal pages, the Web Store, and some embedded or shadow-DOM content cannot be changed. Existing tabs may need one reload after installation.

Run the tests with `node --test tests/*.test.cjs`. No install or build step is needed.

## Trust

- No network requests, no analytics, no dependencies, no build step. CI fails if `fetch`, `eval`, or remote scripts appear.
- Permissions are an allowlist enforced by a test, so adding one needs a deliberate change.
- Tests cover 100% of lines, branches, and functions in the two scripts, and CI enforces it.
- Release zips ship with a SHA256 checksum and a signed build provenance attestation. See [SECURITY.md](SECURITY.md) for how to verify them, and for what the attestation does not cover.
- [PRIVACY.md](PRIVACY.md) states what is stored (one on/off value per site, locally).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).

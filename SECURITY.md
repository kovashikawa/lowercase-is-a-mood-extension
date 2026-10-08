# Security policy

## Reporting a vulnerability

Email dev@kovashikawa.com with a description and steps to reproduce. Please do not open a public issue for security problems. You should get a reply within a few days.

## Scope and design

- No network access: the code uses no `fetch`, `XMLHttpRequest`, or remote scripts, and CI fails if any appear.
- No `eval` or dynamic code.
- No runtime dependencies and no build step. The shipped files are the files in this repo.
- Permissions are limited to `storage` and `activeTab`, plus a content script on all sites that only toggles a CSS class. CI fails if a permission is added without updating the allowlist in `tests/manifest.test.cjs`.

## Verifying a release

Each GitHub Release attaches the extension zip and a `SHA256SUMS` file. Releases are built by the Release workflow, which also records a signed build provenance attestation. To check a downloaded zip:

```sh
shasum -a 256 -c SHA256SUMS
gh attestation verify lowercase-is-a-mood-<version>.zip --repo kovashikawa/lowercase-is-a-mood-extension
```

The Chrome Web Store re-packages and re-signs extensions on upload, so the installed copy is not byte-identical to the release zip. The attestation covers the release zip, not the store copy.

# Demo recording pipeline

Records a real screen capture of the extension working on Hacker News: the
pinned toolbar icon is clicked with OS-level mouse events, the popup opens, the
page flips to lowercase, a comments thread loads already lowercase, and the
setting is flipped back. Nothing here is a synthesised animation or a
page-only capture; every click is a CoreGraphics event against the real
browser UI.

The result is `store/demo-<date>.mp4`, 1920x1080 h264 yuv420p.

## Why it is split up

Two macOS privileges decide the shape of this pipeline:

- **Screen Recording.** `screencapture` fails with "could not create image
  from display" unless its parent terminal holds the grant.
- **Accessibility.** `CGEventPost` fails *silently* without it: the call
  succeeds and the cursor does not move. Always confirm with
  `osascript -l JavaScript step.js where`.

So the parts that drive input and capture pixels must run under a terminal
that owns both grants, while the Playwright process can run anywhere. The
browser host therefore runs on its own and answers questions over the
filesystem instead of being imported.

## Running it

1. Start the browser host from any shell and wait for `READY`:

   ```sh
   export LC_DEMO_WORK=~/.cache/lc-demo
   node store/demo/browser-host.mjs | tee "$LC_DEMO_WORK/host.log"
   ```

   It launches Chrome with the unpacked extension, pins the action, sets the
   window bounds over CDP, opens Hacker News, and then keeps printing a `NAV`
   and `TRANSFORM` journal. That journal is the proof the recording is real.

2. Measure, calibrate and record, under a terminal holding both grants:

   ```sh
   open -na Ghostty --args -e /bin/sh store/demo/run.sh
   ```

   Watch `$LC_DEMO_WORK/run.log`. Note that `pgrep -x Ghostty` misses the
   process, whose name is lowercase; use `pgrep -x ghostty`.

3. Transcode and print the verification facts:

   ```sh
   sh store/demo/finish.sh store/demo-$(date +%F).mp4
   ```

Environment: `LC_DEMO_WORK` (artifact dir, default `$TMPDIR/lc-demo`),
`LC_DEMO_PY` (a python3 with Pillow, default `/opt/homebrew/bin/python3`),
`LC_DEMO_DUR` (capture seconds, default 46), `LC_DEMO_TRIM` (output seconds,
default 40.5), `LC_EXT_DIR` (defaults to the repo root).

## What each piece does

| File | Role |
| --- | --- |
| `browser-host.mjs` | Launches Chrome, pins the action, serves state queries, journals NAV/TRANSFORM |
| `ctl.py` | One-shot client for the host |
| `markers.py` | Finds injected corner markers to get the exact page-to-screen mapping |
| `toolbar.py` | Clusters bright glyphs into candidate toolbar buttons |
| `candidates.py` | Orders those candidates for the calibration search |
| `popup.py` | Diffs two captures to find the popup, and rejects wrong-shaped ones |
| `icongeom.py` | Writes the verified icon and popup-button coordinates |
| `calibrate.sh` | Clicks candidates until one opens a correctly shaped popup |
| `makeplan.py` | Resolves live link positions and emits the step plan |
| `step.js` | One CoreGraphics input action |
| `sequence.js` | Runs the whole plan in a single process, for stable pacing |
| `record.sh` | Resets state, pre-warms the popup, captures, drives the sequence |
| `run.sh` | measure, calibrate, plan, record |
| `finish.sh` | Transcode plus ffprobe and journal output |
| `scan.py` | Finds where each beat actually landed in the finished video |

## Things that cost time, recorded so they do not again

- **Chrome's `window.screenX/screenY` report the window frame, not the
  viewport.** The chrome above the page measured 87px here, but do not hardcode
  that: `markers.py` paints pure-colour squares into the viewport corners and
  finds them in a capture, which also proves the display scale is 1.0.
- **Chrome for Testing ignores `--window-position` and `--window-size`.** Set
  the bounds over CDP `Browser.setWindowBounds` and read them back. Asking for
  1920x1044 yields a maximized 1920x987 window at top=30.
- **Unpacked extensions are not pinned**, and writing
  `extensions.pinned_extensions` into `Default/Preferences` is ignored. Pin it
  by toggling `#pin-to-toolbar` in the extensions UI and assert `checked=true`.
- **Identify the toolbar button by verification, not by pixels.** Darkness and
  brightness heuristics both mis-fired; the first attempt hit the omnibox
  bookmark star, whose "Bookmark added" dialog is ~576x232, and the puzzle
  piece opens a ~328x213 panel. The real popup is ~87x58, so `popup.py`
  rejects anything outside that shape and `calibrate.sh` tries the next
  candidate.
- **The popup is invisible to Playwright.** It never appears in
  `ctx.pages()`, and a persistent context has no `browser()` to enumerate
  targets from. Find it in screen pixels only.
- **Never diff the whole screen.** The desktop is not static; two captures
  seconds apart differ across most of it. Diff a narrow band only.
- **`ffmpeg -f avfoundation` is broken on this machine**: even
  `-list_devices true` exits 1 and prints nothing. `screencapture -v -V <secs>
  -C -x out.mov` produces 1920x1080 h264 yuv420p directly; ffmpeg is used only
  to transcode.
- **`screencapture -v` must stay in the foreground.** Backgrounded it reads the
  tty, takes `SIGTTIN`, stops, and never finalises the movie, so the output
  file does not exist at all. Background the input sequence instead.
- **`screencapture -v` output is variable frame rate**: it emits frames only
  when the screen changes, so static stretches have no frames and event times
  do not map linearly. Use `scan.py` to locate beats.
- **Navigating over CDP leaves the URL selected in the omnibox**, which shows
  as a blue highlight for the whole recording. Only a real click into page
  background clears it, so `record.sh` clicks an `elementFromPoint` blank spot.
- **The first MV3 popup open takes about 1.5s** while the service worker
  starts, which makes the "popup opens" beat look rushed. `record.sh` opens and
  closes it once before recording.
- **Clicking the page to clear focus can navigate.** On the Hacker News front
  page an arbitrary click lands on a story link, so the blank target comes from
  `elementFromPoint` filtered for no `a`/`input`/`button`/`textarea`.
- **Wrap `osascript` and `screencapture` in `timeout`.** `osascript` blocks
  forever when macOS is waiting on a consent prompt.
- Hacker News reorders its front page every few minutes, so link coordinates
  are resolved immediately before recording, not reused from an earlier run.

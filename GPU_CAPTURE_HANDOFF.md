# Verdant Forest: laptop GPU recording handoff

The forest upgrade is complete and published at https://verdant-forest.lexn8.chatgpt.site. The remaining task is to record and deliver the full 30-second cinematic on a real laptop GPU. The user explicitly stopped the slow cloud render and asked for this handoff and all current work on GitHub main.

## Current verified state

- Published scene source commit: `486260a6f94c3fa175620005d2f9e29820e439ba` in the Sites source history. GitHub equivalent: `2d7ddf6d379ff582ea3b6d10f86e60ef0991764e`. Their exact tree is `a367a10e921d0cdb488f0911c05e804d55e55d5e`.
- Approved combined `app/forest` SHA-256: `090013292d8f5d247f522f42402662883680e442a6e35fcc311c10d6809d8a80`.
- The final handoff commit changes capture tools, evidence and documentation only. Keep `app/forest` unchanged for this recording.
- Trees: 7,155; wildflowers: 9,193 across four families; richer sorrel, moss, litter, seedheads and pebbles; camera far plane 460 m. Birch bark, lighting, shadows, color and distance were already visually refined.
- TypeScript/build and actual WebGL scene review passed before publication. Existing reviewed images are in `artifacts/browser-approved-review/`.
- Cloud recording stopped intentionally with **431 saved native frames**, indices **0–430**, at 1280×720 and 24 fps. They cover 17.958333 seconds. The full 30-second movie is **not complete**.
- Cloud renderer was Chromium 153 / ANGLE SwiftShader. Recent frames cost roughly 47 seconds each on shared CPU graphics. The laptop should use its physical GPU; do not force SwiftShader, llvmpipe, lavapipe or WARP.
- The raw cloud PNG sequence and partial preview MP4 are **not in Git**. They were kept separately. The eight-second preview was delivered earlier. Do not claim a full final film has been delivered.

## Recording target

Start a **new complete sequence** at **1920×1080, 24 fps, 720 native frames**, which is exactly **30 seconds**. First run the GPU probe and a three-frame smoke capture at that resolution. 1080p is the laptop target, not a cloud-verified result. If a genuine hardware limitation prevents 1080p, report it clearly before choosing the existing 1280×720 target.

Use the current production Three.js engine and its existing five camera shots. No scene edits, interpolated frames, repeated stills, fake screenshots or external scene recreation. This is a browser canvas capture at deterministic times `n / 24`, encoded for smooth playback; it is not evidence of interactive 24 fps performance.

Do not combine the cloud software-rendered frames with hardware frames. Driver/browser rendering can differ. Use `--resume` only after a local interruption on the **same GPU, browser version, source, dimensions and FPS**, in that same local output directory. The capture tool checks the recorded source and frame hashes and restores the shadow phase. Hardware-required resumes also reject unknown or changed renderer/browser identity.

## Dependencies

From a clean checkout of GitHub main:

1. Install Node.js 24 (project minimum 22.13), Git, Python 3, and FFmpeg including `ffprobe` on PATH.
2. Have current Google Chrome installed, with graphics acceleration enabled. Microsoft Edge can be selected with `--channel msedge`. An explicit path can be selected with `--executable "C:\\path\\to\\chrome.exe"`.
3. Run `npm ci`, then `npm install --no-save --package-lock=false playwright`. Playwright is a capture tool dependency; do not change the checked-in lockfile just to record. Installed Chrome is used, so no Playwright browser download is required for `--channel chrome`.
4. Install Python verification dependencies: `python -m pip install pillow numpy` (on Windows, `py -m pip install pillow numpy` is also fine).
5. Plug in the laptop. Keep the capture window open, avoid sleep, and prefer the discrete GPU in the OS graphics settings when available. The probe records the actual renderer; do not infer hardware acceleration from the browser merely opening.

`capture-start.mjs` now starts Vite directly through Node and works without Bash or cloud environment wrappers. `capture-encode.mjs` is the portable FFmpeg exporter; the `.sh` alternative is retained for Unix shells.

## Windows PowerShell commands

Run from the repository root. Clear inherited cloud-only browser overrides first:

```powershell
Remove-Item Env:FOREST_SOFTWARE_WEBGL, Env:FOREST_BROWSER_ARGS, Env:FOREST_BROWSER_EXECUTABLE, Env:FOREST_PLAYWRIGHT_MODULE, Env:FOREST_BROWSER_CHANNEL -ErrorAction SilentlyContinue
$forestSource = '090013292d8f5d247f522f42402662883680e442a6e35fcc311c10d6809d8a80'
node scripts/capture-start.mjs --source-only --expected-source $forestSource
node scripts/capture-start.mjs --probe-only --require-hardware --headed --channel chrome --output artifacts/laptop-gpu-probe --expected-source $forestSource
```

Require `hardwareVerified: true` and an identifiable physical GPU renderer in the probe output. SwiftShader/software or unavailable/unidentified WebGL fails with an explicit error before loading the heavy forest. Fix the browser/driver/OS GPU selection if this happens; do not remove `--require-hardware` to finish in software.

Smoke capture, in a fresh directory:

```powershell
node scripts/capture-start.mjs --require-hardware --headed --channel chrome --width 1920 --height 1080 --fps 24 --frames 3 --output artifacts/laptop-smoke-1080p --expected-source $forestSource
```

Inspect all three PNGs for correct scene, color, framing and shader errors. Then capture the full film into a separate fresh directory:

```powershell
node scripts/capture-start.mjs --require-hardware --headed --channel chrome --width 1920 --height 1080 --fps 24 --frames 720 --output artifacts/laptop-film-1080p --expected-source $forestSource
python scripts/capture-verify.py artifacts/laptop-film-1080p --width 1920 --height 1080 --fps 24 --frames 720
node scripts/capture-encode.mjs artifacts/laptop-film-1080p artifacts/verdant-forest-30s.mp4 24 720
```

If Python is installed as `py`, replace `python` with `py`. In Bash/zsh, use `unset FOREST_SOFTWARE_WEBGL FOREST_BROWSER_ARGS FOREST_BROWSER_EXECUTABLE FOREST_PLAYWRIGHT_MODULE FOREST_BROWSER_CHANNEL` and `forestSource=090013292d8f5d247f522f42402662883680e442a6e35fcc311c10d6809d8a80`; the same Node commands work with `"$forestSource"`.

Only for an interrupted **local** full film, rerun the exact full-capture command above with `--resume` appended. Never resume the three-frame smoke directory as the final film. Ctrl+C preserves completed frames and records interruption.

## Required final checks and delivery

- `capture-report-0.json` must say `complete`, source hash must match, 720/720 frames, zero browser console errors, and the graphics record must identify hardware.
- `capture-verify.py` requires 720 distinct decoded RGB frames, exact requested dimensions, no effectively blank frames and no unexplained motion jumps. The four intentional cuts are frames **192, 336, 480 and 600** (8, 14, 20 and 25 seconds).
- The exporter uses H.264 CRF18/slow, yuv420p, faststart and matrix-only full-RGB to limited-range BT.709 conversion/tagging. Do not add a separate brightness-changing transfer conversion.
- The exporter fully decodes the MP4 and prints `ffprobe` results. Require 1920×1080, `24/1` frame rates, 720 decoded frames, `30.000000` seconds, and `tv`/`bt709` color metadata.
- Watch the full encoded video. Inspect first/last frames, all four cuts, close bark, flowers and ground detail, shadows, exposure and any stutter or visual defects. Metadata alone does not establish visual quality.
- Record the final MP4 SHA-256, byte size, probe report, renderer and source hash. Update `artifacts/upgrade-capture-run.json`, `gates/upgrade-capture.md` and the video gate in `gates/upgrade.md` only after actual checks and delivery.
- Deliver `verdant-forest-30s.mp4` as a downloadable file. Keep raw PNGs and movies out of Git. Commit only the concise final evidence/docs and any necessary capture fixes. There is no need to rebuild or republish the unchanged forest just for recording.

## Implementation references and limitations

- `scripts/capture-browser.mjs`: source fingerprint, actual browser canvas PNGs, local GPU probe, deterministic times, atomic writes, timing/hash ledger, resume and graphics identity.
- `scripts/capture-start.mjs` / `capture-vite.config.mjs`: portable local server and production engine harness. Port 5173 must be free; failure to bind stops cleanly.
- `scripts/capture-verify.py`: complete source frame audit, including decoded uniqueness and intentional cut exclusions.
- `scripts/capture-encode.mjs` and `.sh`: export and full-decode/probe.
- `app/forest/cinematic.ts`: existing five shots lasting 8 + 6 + 6 + 5 + 5 seconds.
- The local GPU and 1080p capture cannot be validated on this cloud machine. Tool syntax, source fingerprint, help and the tiny-canvas software rejection were checked here. The laptop agent must verify its own actual GPU and smoke frames before committing to the full export.
- Cloud full-Chrome/Xvfb attempts previously hit an explicit local socket permission failure. Do not repeat or work around that access restriction here; the requested path is the user's own laptop GPU.

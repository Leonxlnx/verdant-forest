# Capture and runtime gates
- [x] C1 Available runtime and browser capabilities inspected from actual execution.
  EVIDENCE: artifacts/upgrade-capture-run.json records the actual Radeon 780M ANGLE/D3D11 hardware renderer, installed headed Chrome 154.0.8037.57 and hardware-required probe. The prior cloud software capture is preserved as history.
- [x] C2 Current project dependency/build path established without network-policy bypass.
  EVIDENCE: existing lockfile retained; original production build passed artifacts/upgrade-build.log. Recovery restored the exact approved source commit and installed its 694 locked packages.
- [x] C3 Reproducible capture script records current-source browser frames at smooth 30-second output.
  EVIDENCE: fresh 720/720 native hardware frames at 1920×1080 and n/24 seconds; approved source hash unchanged, every PNG hash matches its ledger, zero capture console errors. Supplied verifier passed 720 unique decoded frames, no blank frames or unexplained motion jumps. No cloud frames, interpolation or repeated stills. artifacts/upgrade-capture-run.json.
- [x] C4 Export duration/frame count/decode and selected frames verified.
  EVIDENCE: delivered verdant-forest-30s.mp4; ffprobe reports 1920×1080, 24/1 fps, 720 frames, 30.000000 seconds, H.264/yuv420p and limited BT.709. Full decode and 720 decoded-frame uniqueness passed. Normal-speed full Chrome playback ended with zero dropped frames. All 720 decoded frames, four intentional cuts and 15 full-resolution detail frames inspected. SHA-256 b8bcd930976e65e93179b011417975242889e32997fbe107a7d4d97791dbfec6; 231454738 bytes. artifacts/upgrade-capture-run.json.
- [x] C5 Portable laptop handoff prepared and cloud recording stopped as requested.
  EVIDENCE: GPU_CAPTURE_HANDOFF.md; direct Node/Vite launcher; installed Chrome/headed selection; source guard; tiny-canvas hardware check before forest loading; software fallback rejection; portable FFmpeg exporter. Syntax/source-hash checks passed. Actual laptop hardware probe, three-frame 1080p smoke, full capture and export passed. Windows LF fingerprint, harness favicon and FFmpeg metadata fixes verified without changing the forest.

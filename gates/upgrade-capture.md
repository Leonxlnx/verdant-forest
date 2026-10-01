# Capture and runtime gates
- [x] C1 Available runtime and browser capabilities inspected from actual execution.
  EVIDENCE: artifacts/capture-runtime-report.json; production scene and 431 real native frames captured with Chromium 153 / WebGL2 / ANGLE SwiftShader. Cloud software rendering was slow; no hardware GPU claimed.
- [x] C2 Current project dependency/build path established without network-policy bypass.
  EVIDENCE: existing lockfile retained; original production build passed artifacts/upgrade-build.log. Recovery restored the exact approved source commit and installed its 694 locked packages.
- [ ] C3 Reproducible capture script records current-source browser frames at smooth 30-second output.
  EVIDENCE: stopped intentionally at user request after 431/720 native frames (17.958333 seconds at 24 fps). artifacts/upgrade-capture-run.json records partial status. GPU_CAPTURE_HANDOFF.md supplies the requested laptop recording workflow. Full-film completion remains pending.
- [ ] C4 Export duration/frame count/decode and selected frames verified.
  EVIDENCE: the earlier 8-second preview passed verification; resumed frames 367/368 showed no seam in artifacts/capture-resume-seam.jpg/.json. Final 30-second MP4 has not been produced and must be checked on the laptop.
- [x] C5 Portable laptop handoff prepared and cloud recording stopped as requested.
  EVIDENCE: GPU_CAPTURE_HANDOFF.md; direct Node/Vite launcher; installed Chrome/headed selection; source guard; tiny-canvas hardware check before forest loading; software fallback rejection; portable FFmpeg exporter. Syntax/help/source-hash checks passed. Actual laptop GPU/1080p smoke and final capture remain intentionally pending.

# Capture and runtime gates
- [x] C1 Available runtime and browser capabilities inspected from actual execution.
  EVIDENCE: artifacts/capture-runtime-report.json; actual local Chromium WebGL2 probe and production browser canvas artifacts/browser-probe/frame-0000.png.
- [x] C2 Current project dependency/build path established without network-policy bypass.
  EVIDENCE: npm run install:ci completed, 694 packages; existing lockfile retained; root production build passed artifacts/upgrade-build.log.
- [ ] C3 Reproducible capture script records current-source browser frames at smooth 30-second output, or exact blocker recorded with faithful alternative.
  EVIDENCE: pending
- [ ] C4 Export duration/frame count/decode and selected frames verified, or blocker recorded.
  EVIDENCE: pending

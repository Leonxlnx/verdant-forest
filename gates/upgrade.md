# Gates: cinematic upgrade
- [x] U1: White bark has irregular natural surface detail without repeated aligned black stripes, visually checked.
  EVIDENCE: artifacts/upgrade-bark/REVIEW.md, comparison.jpg, audit-upgrade-bark.mjs and actual Chromium final close/wide review.
- [x] U2: Forest floor gains substantial fine detail and visible natural flower color, visually checked close and wide.
  EVIDENCE: artifacts/upgrade-floor-audit.json, upgrade-floor-review.md, upgrade-ground-cover.md; actual Chromium final t8 and t25 images inspected after flower and ground refinements.
- [x] U3: Longer clear view distance and stronger cinematic lighting/shadow separation, visually checked at ground and elevated views.
  EVIDENCE: artifacts/upgrade-lighting-audit.json, upgrade-lighting-review.md; actual Chromium t0,8,11,20,25,28 review; final camera range460m and 7155trees.
- [x] U4: Current source builds and WebGL shader compilation passes; runtime inspected to available capability.
  EVIDENCE: final TypeScript check and npm run build exit0 (artifacts/upgrade-build.log); 43/43 WebGL ES shader programs compile/link; local Chromium WebGL2 runs real production engine with no console errors.
- [x] U5: Exact source preserved and published to existing public Site; deployment terminal success verified.
  EVIDENCE: artifacts/upgrade-publication.json records successful public version 3 publication of source commit 486260a6f94c3fa175620005d2f9e29820e439ba and matching Sites/GitHub source tree a367a10e921d0cdb488f0911c05e804d55e55d5e. The live page loaded the expected engine asset; actual WebGL visual proof uses local Chromium because the supplied cloud browser disables WebGL.
- [ ] U6: Smooth 30-second video from actual browser scene delivered and verified, with capture limits disclosed accurately.
  EVIDENCE: deferred by explicit user scope change. The user requested stopping the slow cloud software capture, preserving source/context/scripts on GitHub main, and continuing the full film on a laptop GPU. GPU_CAPTURE_HANDOFF.md records continuation and final verification. The earlier eight-second preview and partial native frames do not satisfy this gate. No completed 30-second recording is claimed.
- [ ] U7: Revised user scope fulfilled: complete application, meaningful context and capture scripts preserved on GitHub main, with an actionable hardware-GPU laptop handoff.
  EVIDENCE: pending final commit and exact-tree GitHub main readback. README.md, SESSION_CONTEXT.md and GPU_CAPTURE_HANDOFF.md define the continuation. The final synchronization must preserve every committed file path, mode and blob hash; keep its readback receipt outside the public commit.

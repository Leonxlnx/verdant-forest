# Gates: cinematic upgrade
- [x] U1: White bark has irregular natural surface detail without repeated aligned black stripes, visually checked.
  EVIDENCE: artifacts/upgrade-bark/REVIEW.md, comparison.jpg, audit-upgrade-bark.mjs and actual Chromium final close/wide review.
- [x] U2: Forest floor gains substantial fine detail and visible natural flower color, visually checked close and wide.
  EVIDENCE: artifacts/upgrade-floor-audit.json, upgrade-floor-review.md, upgrade-ground-cover.md; actual Chromium final t8 and t25 images inspected after flower and ground refinements.
- [x] U3: Longer clear view distance and stronger cinematic lighting/shadow separation, visually checked at ground and elevated views.
  EVIDENCE: artifacts/upgrade-lighting-audit.json, upgrade-lighting-review.md; actual Chromium t0,8,11,20,25,28 review; final camera range460m and 7155trees.
- [x] U4: Current source builds and WebGL shader compilation passes; runtime inspected to available capability.
  EVIDENCE: final TypeScript check and npm run build exit0 (artifacts/upgrade-build.log); 43/43 WebGL ES shader programs compile/link; local Chromium WebGL2 runs real production engine with no console errors.
- [ ] U5: Exact source preserved and published to existing public Site; deployment terminal success verified.
  EVIDENCE: pending
- [ ] U6: Smooth 30-second video from actual browser scene delivered and verified, with capture limits disclosed accurately.
  EVIDENCE: pending

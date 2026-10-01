# Cinematic lighting and distance upgrade

- [x] L1: Shared lighting/atmosphere constants produce stronger warm sunlight, cool readable shadows, clear layered distance.
  CHECK: node scripts/audit-upgrade-lighting.mjs
  EXPECT: "cameraFar":460
  EVIDENCE: artifacts/upgrade-lighting-constants-audit.json; shared constants, clearer optical transmission, no fade or sun hardcode divergence.
- [x] L2: Trees extend beyond the longer visible range without moving the original grove; distant geometry remains bounded.
  CHECK: node scripts/audit-upgrade-lighting.mjs --scene
  EXPECT: "originalLayoutPreserved":true
  EVIDENCE: artifacts/upgrade-lighting-audit.json and artifacts/upgrade-terrain-preservation.json; 3,808 original tree layouts preserved, 7,155 total trees, 20,000 terrain points unchanged, far geometry 30.37% of prior low tier, 48-view peak 37,322,671 triangles / 696 draws.
- [x] L3: Runtime shader compile validation passes after changes.
  CHECK: node scripts/prepare-qa.mjs && node scripts/export-webgl-shaders.mjs && python scripts/compile-webgl-shaders.py
  EXPECT: 43/43 passed
  EVIDENCE: artifacts/webgl-shader-results.json, 43/43 current GLSL ES programs compile and link; TypeScript check passed.
- [x] L4: Parent performs live visual review and recorded evidence confirms cinematic lighting and clear distance.
  EVIDENCE: artifacts/upgrade-lighting-review.md; inspected actual Chromium/WebGL final-review frames0000/0330/0600/0750 after final bounce/sky tune. Clear atmospheric layers, stronger path/log highlights, colored readable shadows, continuous canopy horizon.

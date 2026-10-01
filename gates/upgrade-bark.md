# Gates: natural birch bark

Scope: Replace the repetitive white-bark dash pattern with detailed, organically varied cream and warm-gray birch bark while preserving other species and WebGL compatibility.

- [x] G1: The birch material no longer produces fixed horizontal rows of evenly sized black dashes.
  CHECK: node scripts/audit-upgrade-bark.mjs
  EXPECT: bark structure audit passed
  EVIDENCE: bark structure audit passed: old row defect reproduced; oak/beech color and normal behavior preserved; per-tree variation present

- [x] G2: Updated materials compile and link under WebGL GLSL ES including the birch material.
  CHECK: bash -lc 'node scripts/export-webgl-shaders.mjs && source /workspace/daybreak-render-runtime/env.sh && python scripts/compile-webgl-shaders.py'
  EXPECT: GLSL ES compile/link: 43/43 passed
  EVIDENCE: Exported 43 WebGL shader programs using Three 180 | GLSL ES compile/link: 43/43 passed

- [x] G3: The new birch surface has irregular tonal fields, fine discontinuous lenticels, subtle peeling detail, and a rough blended lower trunk without changing oak or beech shading.
  EVIDENCE: Actual shader cylinder comparisons inspected at artifacts/upgrade-bark/comparison.jpg and comparison-roots.jpg. New lenticels have irregular spacing, curvature, widths and softer contrast; lower bark transitions into retained bark and moss. Two instance origins show different patterns. Oak/beech albedo and normal parameters pass the preservation audit.

- [x] G4: Adversarial review and a second refinement pass find no unresolved cheap-pattern or compatibility defect in this owned change.
  EVIDENCE: Browser-driven final v5 pass lowers pale albedo roughly 15%, strengthens broad gray/tan fields, reduces lenticel contrast to .42, and fades fine detail over 3–13 metres. Both native comparison sets regenerated and inspected; exact GLSL ES compile/link remains 43/43. Final integrated browser review belongs to parent.

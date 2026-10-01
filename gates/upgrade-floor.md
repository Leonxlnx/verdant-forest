# Gates: richer woodland floor

Scope: Curved woodland flowers and planted, terrain-contacting floor accents in efficient instanced drifts.

- [x] G1: Four distinct flower families use finite, real curved geometry and have bounded per-plant triangle budgets.
  CHECK: node scripts/audit-upgrade-floor.mjs
  EXPECT: flower-geometry PASS
  EVIDENCE: detail-budget PASS | {"desktop":{"wildflowers":9437,"flowerDrifts":172,"flowerFamilies":4,"sorrelPatches":7629,"mossRosettes":3839,"curledLeafPiles":4505,"seedheadClumps":854,"smallPebbles":1899,"inst

- [x] G2: Floor accents have finite indexed geometry and terrain-aligned placements that exclude trunk flares, rocks and fallen logs.
  CHECK: node scripts/audit-upgrade-floor.mjs
  EXPECT: floor-placement PASS
  EVIDENCE: detail-budget PASS | {"desktop":{"wildflowers":9437,"flowerDrifts":172,"flowerFamilies":4,"sorrelPatches":7629,"mossRosettes":3839,"curledLeafPiles":4505,"seedheadClumps":854,"smallPebbles":1899,"inst

- [x] G3: Deterministic flower drifts add color at eye height, while smaller detail is culled at distance within a measured budget.
  CHECK: node scripts/audit-upgrade-floor.mjs
  EXPECT: detail-budget PASS
  EVIDENCE: detail-budget PASS | {"desktop":{"wildflowers":9437,"flowerDrifts":172,"flowerFamilies":4,"sorrelPatches":7629,"mossRosettes":3839,"curledLeafPiles":4505,"seedheadClumps":854,"smallPebbles":1899,"inst

- [x] G4: Integration signatures and one expert improvement pass are documented for the parent.
  EVIDENCE: artifacts/upgrade-floor-review.md records exact integration signatures, three inspection viewpoints, six concrete improvement-pass changes and measured fixture budgets; npx tsc --noEmit --pretty false exited 0.

# Woodland floor upgrade review

## Integration

```ts
import {createWildflowers} from './wildflowers';
import {createFloorDetail} from './floor-detail';

const flowers = createWildflowers(scene, vegetation.treePositions, rocks, coarse);
const floor = createFloorDetail(scene, vegetation.treePositions, rocks, coarse);
// Add before compactGeometryAttributes(scene), alongside details.
// Invoke flowers.update(camera) and floor.update(camera) in the same update path.
// Add flowers.stats and floor.stats to the scene object inventory.
```

Both modules use existing terrain, material shaders and ground exclusion. No new textures, downloads or shader variants are required. Flower and seedhead wind shadows use the same shrub motion as their color materials.

## Design

- Purple-blue bells grow on arching stems with curved tubular blossoms.
- Pink campion has several stems, notched five-petal heads and narrow leaves.
- Buttercups add small gold cups; pale wood anemones create restrained cream accents.
- The path, fallen logs and tree islands receive folded sorrel, star moss, curled ochre leaf piles, fine warm seedheads and small earth-colored pebbles.
- One species dominates each flower drift. Instances vary in yaw, height and tone.
- At the path margin the low detail layer remains visible where existing grass is shortest.

## Inspection waypoints

All y coordinates are offsets above the existing terrain function.

| View | Eye | Target |
|---|---|---|
| Opening flower dolly | `[7.8, .82, 14.1]` | `[6.5, .58, 11.1]` |
| Fern bluebells | `[-5.5, 1.3, 6]` | `[-4.2, .48, 2.1]` |
| Deadwood buttercups | `[9.2, 1.7, -9.3]` | `[7.6, .45, -9.5]` |

## Expert improvement pass

1. Removed the collapsed duplicate petal-root row so blossoms contain no zero-area triangles.
2. Added near/far flower meshes with unchanged seeded dimensions and silhouettes. Far bells retain six-sided curled geometry; lower petal subdivision preserves the flower outline.
3. Expanded geometry bounds to include wind and both levels of detail.
4. Concentrated low sorrel and moss along the short-grass trail edge; avoided burying every new small asset beneath the existing thick grass.
5. Aligned dry litter and pebbles to local terrain slope. Roots share the exact rendered terrain height.
6. Flowers and taller seedheads cast shadows only nearby; tiny details receive shadows and are distance culled.

## Verification

`node scripts/audit-upgrade-floor.mjs` exercises production geometry/placement with a deterministic representative trunk/rock fixture, including deliberately broad trunk flares. It checks every generated root and triangle. It is not a full-scene visual or browser FPS measurement; root performs that separate integration gate.

All checks passed; `npx tsc --noEmit --pretty false` also exited 0.

| Fixture measurement | Desktop | Touch |
|---|---:|---:|
| Flowering plants | 9,437 | 5,064 |
| Colored drifts | 172 | 172 |
| Floor + flower instances | 28,163 | 15,390 |
| Sampled maximum visible accent triangles | 2,273,554 | 843,602 |
| Sampled maximum visible accent draws | 70 | 48 |
| Maximum root error | 0.00000163 m | 0.00000178 m |

Exact production instance totals differ because the production trunk/rock layout differs from this fixture. Measured fixture evidence: `artifacts/upgrade-floor-audit.json`.

## Final browser-driven flower correction

Inspected `artifacts/browser-final-review/frame-0240.png`: squat blue blossoms had polygonal shield silhouettes; nearby pink blossoms looked like flat cut-paper stars.

- Bluebell petals now form a narrow hanging tube, 0.058 m long and approximately 0.028 m wide. Close geometry uses 16 sides and six rings with a subtly lobed rim; far geometry remains six-sided.
- Pink radial reach fell from 0.041 m to 0.027 m. Rounded spoon-shaped surfaces have shallow cupping and a small rounded sinus, replacing the deep angular V-notch.
- Revised violet-blue/pink colors are desaturated 30% in the color helper, retaining floral color without the cobalt patches.
- High topology applies only to close cells. Fixture desktop peak rises about 2%; touch peak falls about 7%. All geometry, exclusion, contact, and budget assertions pass, and TypeScript exits 0.
- Parent owns the final browser comparison of these exact changes.

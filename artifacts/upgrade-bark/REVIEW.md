# Natural birch material review

Source SHA-256: `c87d5f9c0e897b84ec2ed151df4504fea0f530f35501b3936326468995f6a0d0`

This hash identifies the isolated bark comparison before the later ground-cover edit in the same materials file. The ground v3 edit preserves the birch v5 function byte-for-byte; final combined-file provenance is recorded in the browser capture report.

## Change

The original material forced scars into 7.3 fixed rows per metre and 17 angular segments. It is replaced by continuous 3D fields with warped height, independently varied scar scale and per-tree world-origin variation. No angular UV seam or floor-based row placement remains. Cream/gray bark now includes irregular age/stain fields, warm peeling edges and submillimetre relief, with a rough root transition. The original bark texture still supplies surface detail.

The second pass fades fine grain and scar contrast over 3–13 metres, and fades paper relief over 3–12 metres. This prevents the new thin marks becoming unnecessarily sharp noise in distant trunks. Oak and beech albedo logic, normal scale, color and roughness are preserved by the audit.

## Evidence

- `comparison.jpg`: old material versus new, plus a second tree origin, same light and cylinder geometry.
- `comparison-roots.jpg`: corresponding lower-trunk material transition.
- These are native renders of the actual Three material shader hooks on isolated inspection geometry. They are not browser screenshots or a claim about full-scene frame rate.
- `node scripts/audit-upgrade-bark.mjs`: baseline defect reproduced, old fixed rows removed, per-tree variation present, oak/beech behavior preserved.
- `node scripts/export-webgl-shaders.mjs`, then the recovered EGL environment and `python scripts/compile-webgl-shaders.py`: 43/43 unchanged-language GLSL ES 3.00 programs compiled and linked.
- Final full-forest review is owned by the parent integration task.

No new image or texture downloads were introduced.

## Browser-driven final tuning (v5)

Parent inspected `artifacts/browser-probe/frame-0000.png` from the actual browser. The material removed fixed rows, but the integrated distant right-hand trunk still read too pale and finely dotted. Final tuning lowers the pale range by roughly 15%, gives gray/tan age fields greater contrast and broad stains, and reduces lenticel contrast from .59 to .42. Fine detail now fades over 3–13 metres. Updated native comparisons were inspected, and all 43 exact GLSL ES programs compile/link. Materials source is frozen for final integrated browser review by the parent.

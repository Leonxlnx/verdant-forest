# Ground cover material v3

Actual browser review of `artifacts/browser-tour-review/frame-0750.png` and `frame-0840.png` exposed brown bare-looking areas between crowns in elevated views. The previous material measured only horizontal distance and retained too much brown litter after distant grass became subpixel.

`groundMaterial` now uses full 3D view distance, replacing the 18–68m range with 12–48m. Replacement reaches 98.5% off the trail, with a gentle nonlinear transition. Three continuous noise scales produce mottled moss and low-grass greens; the original photographic surface contributes fine luminance variation. The photographic litter remains fully preserved within 12m and the trail center remains brown at every distance.

No geometry or other material behavior changed. Birch bark v5 was checked byte-for-byte unchanged; its function SHA-256 remains `529cb4c54618fa06c5d522ed5b0ccfcfba085e7434859691be82bfee5f34ccaf`.

Validation: `node scripts/export-webgl-shaders.mjs`, recovered EGL environment, then `python scripts/compile-webgl-shaders.py --check-regression` exported 43 exact Three GLSL ES 3.00 shader programs; all 43 compiled and linked, and the original reserved-word bug was correctly rejected.

Final aerial browser review belongs to parent integration. Materials are frozen pending that review.

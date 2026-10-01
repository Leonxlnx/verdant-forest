# Lighting and distance visual review

Reviewed the real Chromium/WebGL capture in `artifacts/browser-final-review/`:

- `frame-0000.png`: the late sunlight forms a clear path highlight without flattening the shaded foliage. The final hemisphere/bounce adjustment keeps fern and grass structure visible in the foreground. Blue/pink flower stands remain separated from the greens.
- `frame-0330.png`: trunks separate across several depth planes; warm yellow flowers and shafts contrast with the cool shaded greens. The shadow-side bark and small ground cover remain readable.
- `frame-0600.png`: side lighting catches moss and the fern edges without a full-frame orange wash.
- `frame-0750.png`: canopy remains geometric into a layered distant tree line, with no exposed terrain edge or clipping wall. The sky bottom is cooler and clearer after the final tune.

A remaining issue outside this lighting leaf is the distant floor surface visible from the aerial camera: grass culling leaves brown patches between crowns. Root was notified to improve the distant ground material. This does not invalidate the longer-distance lighting or boundary tests, but should be included in the final integrated floor review.

Validation is from actual browser render output. The software renderer is slow; these images do not demonstrate interactive hardware frame rates.

# Cinematic forest upgrade

User goal: replace barcode-like white bark, substantially richer forest floor and vegetation, colorful flowers, clearer longer view distance, more cinematic lighting/shadows/contrast, then a smooth 30-second browser recording.

## Ownership contract
- Bark leaf: app/forest/materials.ts only, plus own audit scripts/evidence; coordinate any extra files.
- Ground leaf: new app/forest/wildflowers.ts and app/forest/floor-detail.ts, app/forest/understory.js and app/forest/details.ts. Export additions for root integration; do not edit engine/vegetation/materials/config.
- Capture/runtime leaf: dependency setup, browser capability inspection, new capture scripts and evidence. Do not edit scene modules; report required hooks.
- Root integration: engine.ts, config.ts, atmosphere.ts, volumetrics.ts, vegetation.ts, integration, visual inspection, deployment and GitHub sync.

## Gates
See gates/upgrade.md. Existing source/history gates remain intact.

## Status
- Started with local source revision 144e1dc and existing public Sites project.
- Forest visual upgrades are published as version 3 from source commit 486260a6f94c3fa175620005d2f9e29820e439ba. That published revision was synchronized to GitHub as 2d7ddf6d379ff582ea3b6d10f86e60ef0991764e with an identical tree; the subsequent handoff adds context and capture tooling while preserving app/forest unchanged.
- Actual Chromium WebGL2 inspection and a partial 24 fps native-frame capture were completed. An eight-second preview was supplied, but the full 30-second MP4 has not been delivered.
- Latest user instruction: stop the slow cloud rendering, preserve all source/context/scripts on GitHub main, and hand the remaining recording to a laptop GPU agent. See SESSION_CONTEXT.md and GPU_CAPTURE_HANDOFF.md. Do not restart cloud capture unless the user requests it.

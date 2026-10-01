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
- The cloud software capture stopped after a partial native-frame sequence and an eight-second preview. The laptop continuation subsequently delivered the complete verdant-forest-30s.mp4 on 2026-10-01: fresh Radeon 780M hardware frames, 1920×1080, 24 fps, 720 unique frames, exactly 30 seconds. Full verification, decode, playback and visual review passed; all video gates are complete. See artifacts/upgrade-capture-run.json.
- The latest laptop request was to complete and deliver the film using installed headed Chrome with hardware required, preserve the forest, and push necessary capture fixes and verification documentation to main. See SESSION_CONTEXT.md and GPU_CAPTURE_HANDOFF.md. Do not restart cloud capture unless the user requests it.

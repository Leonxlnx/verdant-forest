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

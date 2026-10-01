# Verdant Forest

A full-screen, real-time temperate woodland. The scene uses actual curved and folded geometry for its vegetation, with shared meshes, instanced placement, distance detail levels and adaptive rendering resolution.

Desktop: drag to look; WASD or arrows to move; Q/E or Space to descend/rise; Shift to move faster; wheel to move along the view direction; R to return to the trail. Double-click captures the mouse and Escape releases it. On touch devices, use the left thumb to move, the right side to look, and the two small flight controls to change height.

The application lives in `app/forest`. `engine.ts` owns rendering and resource lifecycle, `vegetation.ts` builds and updates the vegetation, and the botanical modules generate the geometry. `surfaces.ts`, `details.ts` and `trunk-life.ts` add terrain, decay, litter, roots, moss and climbing ivy. The rendering pipeline combines physically based materials, directional shadows, contact occlusion and depth-bounded atmospheric scattering. Reduced-motion preferences disable wind and drifting particles.

The cinematic upgrade replaces repeated birch markings with irregular cream, gray and tan bark; adds four flower families, sorrel, moss rosettes, curled litter, seedheads and small stones; and extends the woodland to 7,155 trees with a 460 m camera range. Warmer side lighting, cool shaded greens, softer distant haze and stronger contact shadows give the scene more depth. Distant trees use simplified three-dimensional crowns, and distant ground blends into mottled green cover.

Open `?cinematic=1` for a looping 30-second, five-shot camera tour. `?capture=1` exposes a deterministic browser capture hook and pauses automatic animation; the capture scripts sample the same scene, materials, lighting and post-processing at exact times.

This is a Vinext/Vite project hosted with ChatGPT Sites. Keep the starter's build and hosting helpers intact. `npm run build` runs its verified production build; the hosting manifest identifies the existing Site. Public publication uses the Sites lifecycle, with the exact source revision pushed before packaging and saving.

Texture sources and licenses are in `public/credits.txt`. Touch devices load the smaller files under `public/textures/mobile`.

## Verification

The cinematic upgrade is visually checked in a local Chromium WebGL2 browser with SwiftShader. Browser captures use evenly spaced simulation times; their playback frame rate is not a measurement of real-time performance. The separately supplied cloud browser has WebGL disabled. Older native EGL images remain offline scene-data renders, not browser screenshots. The native renderer uses application geometry and exported production shaders, with adaptations for OpenGL texture/depth representation.

The scripts under `scripts` export reproducible geometry/shader inputs, validate camera behavior, report typed-array memory and scene draw budgets, and render the inspection images. Large intermediate geometry and frame sequences are ignored by Git. `PLAN.md`, `GATES.md` and `gates` record implementation and verification evidence, including unresolved environment limits.

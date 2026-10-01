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

## Reproducing the browser film

The forest improvements are live at [Verdant Forest](https://verdant-forest.lexn8.chatgpt.site), with a [cinematic tour](https://verdant-forest.lexn8.chatgpt.site/?cinematic=1). The full 30-second MP4 was intentionally not finished in the cloud: the user requested stopping the slow software render and handing the remaining capture to a laptop GPU. Start with `GPU_CAPTURE_HANDOFF.md` for the exact continuation steps and `SESSION_CONTEXT.md` for the work history and remaining acceptance checks.

The laptop continuation targets a fresh 1920 × 1080 capture with 720 actual browser canvas frames sampled at `n / 24` seconds. The stopped cloud capture was 1280 × 720 and is not mixed into the new recording. Camera movement, wind, lighting and post-processing come from the production engine. The five camera shots cut at frames 192, 336, 480 and 600. The selected method uses no motion interpolation or repeated frames to manufacture the playback cadence.

Use `GPU_CAPTURE_HANDOFF.md` as the single source for laptop installation, hardware-renderer checks and portable capture/encode commands. The capture needs Playwright and Chromium with working hardware WebGL2. Encoding requires FFmpeg with libx264; frame verification requires Python, Pillow and NumPy. The prior cloud job used SwiftShader, but the laptop job must not enable its software renderer flags.

The capture launcher starts the local Vite page and captures its canvas. Rendering and PNG extraction occur in the same synchronous browser evaluation. Every saved frame has a hash and timing record. The capture source manifest prevents mixing different forest source files, resolutions or frame rates, and the source hash is checked periodically. Add `--resume` with the same arguments after an interruption; existing frames are reused only when their saved hashes match. At 24 fps, resumption restores the shot's shadow anchor and latest eight-Hz shadow phase before rendering the next frame.

The delivery encoder converts full-range browser RGB to limited-range BT.709 YUV and tags the result consistently, without an additional transfer-function conversion. Its output is H.264, yuv420p, with fast-start metadata. This film is captured frame by frame and then played at 24 fps; it does not demonstrate real-time 24 fps performance on the capture machine. Software WebGL capture can be substantially slower than playback.

Publication provenance is recorded in `artifacts/upgrade-publication.json`. Final full-film capture, verification and delivery are deferred to the laptop continuation. The cloud capture stopped after 431 native frames (indices 0–430), representing 17.958333 seconds of 24 fps playback. The eight-second checkpoint supplied earlier was a preview only. Partial PNG sequences and downloaded rendering runtimes are excluded from this repository; the capture can be reproduced from the committed source.

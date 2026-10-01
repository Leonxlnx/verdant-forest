// Shared by the browser renderer and the reproducible scene-export tools.
export const FOREST_LIGHTING={
 // Lower late-afternoon sun gives the trunks a readable side light. The
 // blue sky and moss bounce retain colour in the shade instead of crushing it.
 sunColor:'#fff0cf',sunIntensity:4.9,
 skyColor:'#bed9e8',groundColor:'#53603d',hemisphereIntensity:1.9,
 skyTop:'#779fab',skyBottom:'#a5c1c9',
 fogColor:'#91aca9',fogDensity:.0023,exposure:1.13,
 sunDirection:[-52,58,-63] as const,
 volumeStrength:.48,volumeDistance:132,
 hazeStart:220,hazeEnd:435,
 shadowHalfExtent:46,shadowNear:1,shadowFar:205,
 saturation:1.085,
};
// Enlarging the plane at the same 25/26 metre spacing preserves the original
// grove's triangle heights. The extra perimeter is behind the atmospheric fade
// even from the outermost legal free-camera position.
export const FOREST_EXTENT={exploration:95,vegetation:540,terrain:1100,terrainSegments:1144,cameraFar:460,treeFar:450,horizonLOD:150};

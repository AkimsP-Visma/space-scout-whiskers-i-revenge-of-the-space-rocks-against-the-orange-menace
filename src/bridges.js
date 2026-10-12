// =====================================================================
//  ERAS, RESOLUTION, SCREEN FX (read by kit/morph.js and the pixel STYLE hooks)
//  One era per shot, all at 320x180 (6 px per pixel on 1920x1080). Every boundary is a hard cut.
// =====================================================================
const ERA_BG = ERA_LIST.map(() => PAL16.ink);
const ERA_RES = ERA_LIST.map(() => RES);
const ERA_POST = ERA_LIST.map(() => ({ pal: PAL16, scan: 0.16, vignette: 0.35 }));   // a soft CRT: scanlines and dithered corners
function pieceCam() { return null; }   // pixel art moves the world, not the camera
const BRIDGES = [];

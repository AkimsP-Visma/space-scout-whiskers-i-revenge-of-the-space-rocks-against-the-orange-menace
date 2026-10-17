// =====================================================================
//  VIEW - the camera over the play field. The field is CFG.view.to big; the run opens on the film's 320x180 frame,
//  centred in it, and the camera pulls back to the whole field. Objects live in field coordinates; the screen shows
//  the rectangle (ox, oy, w, h) of them. Pure numbers; never draws.
// =====================================================================
const View = {
  // full: a level that does not follow the film starts on the whole field
  at(t, full = false) {
    const V = CFG.view, u = full ? 1 : EZ.io(seg(t, V.delay, V.delay + V.dur));
    const w = Math.round(lerp(V.from[0], V.to[0], u)), h = Math.round(lerp(V.from[1], V.to[1], u));
    return { u, w, h, ox: (V.to[0] - w) / 2, oy: (V.to[1] - h) / 2 };
  },
  of(s) { return View.at(s.t, s.full); },
  // the scout's area: the field's limits, and never outside what the camera shows
  bounds(v) {
    const S = CFG.scout;
    return { minX: Math.max(S.minX, v.ox + S.minX), maxX: Math.min(S.maxX, v.ox + v.w - S.minX), minY: Math.max(S.minY, v.oy + S.minY), maxY: Math.min(S.maxY, v.oy + v.h - S.minY) };
  },
};

// =====================================================================
//  FLOW - draws the first frame of a run (the seam): the play drawing works on the film's art
// =====================================================================
Draw.frame(document.getElementById('c'), Play.create(1, SEAM_START));
if (new URLSearchParams(location.search).has('test')) window.GAME = { state: () => ({ name: 'seam' }) };

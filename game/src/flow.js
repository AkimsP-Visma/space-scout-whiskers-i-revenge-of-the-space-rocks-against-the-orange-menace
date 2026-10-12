// =====================================================================
//  FLOW - draws the film's first frame: the film's code and the game's are joined in one page
// =====================================================================
renderFrame(0, document.getElementById('c'));
if (new URLSearchParams(location.search).has('test')) window.GAME = { state: () => ({ name: 'title' }) };

// =====================================================================
//  BEST SCORE - kept in the browser's localStorage. Storage can be denied (privacy settings, some file:// setups):
//  then the best lasts for this session only, and the failure is logged.
// =====================================================================
const BestScore = {
  // level 1 keeps the original key, so a best set before there were levels survives; level n adds ':n'
  key(level) { return level === 1 ? CFG.score.storageKey : CFG.score.storageKey + ':' + level; },
  load(level = 1) {
    try { return Number(localStorage.getItem(BestScore.key(level))) || 0; }
    catch (e) { console.warn('[best score] could not read localStorage, so the best lasts for this session only:', e); return 0; }
  },
  save(best, level = 1) {
    try { localStorage.setItem(BestScore.key(level), String(best)); }
    catch (e) { console.warn('[best score] could not write localStorage, so the best lasts for this session only:', e); }
  },
};

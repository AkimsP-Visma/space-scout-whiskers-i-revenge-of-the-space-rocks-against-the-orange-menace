// =====================================================================
//  BEST SCORE - kept in the browser's localStorage. Storage can be denied (privacy settings, some file:// setups):
//  then the best lasts for this session only, and the failure is logged.
// =====================================================================
const BestScore = {
  load() {
    try { return Number(localStorage.getItem(CFG.score.storageKey)) || 0; }
    catch (e) { console.warn('[best score] could not read localStorage, so the best lasts for this session only:', e); return 0; }
  },
  save(best) {
    try { localStorage.setItem(CFG.score.storageKey, String(best)); }
    catch (e) { console.warn('[best score] could not write localStorage, so the best lasts for this session only:', e); }
  },
};

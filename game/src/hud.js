// =====================================================================
//  HUD - the screen-fixed pixel UI in the film's font and boxes: the score, shields and log line in play, the title
//  prompt, the pause box, the game-over card and the error card
// =====================================================================
const LOG_LINE = 'LOG 02: BELT AHEAD';
// rows of the 320x180 grid (captionY is in screen px, as the film's captions are)
const HUD_ROW = { scoreY: 10, pipsY: 26, heatY: 36, weaponY: 46, captionY: 900, promptY: 150, pausedY: 74, cardTop: 4, cardScores: 124, cardPrompt: 169, errorY: 60 };
const ERROR_LINE = 48;   // glyphs per line on the error card
const Hud = {
  blinkOn(t, period = 0.5) { return Math.floor(t / period) % 2 === 0; },
  // centred lines of pixel text in one box whose top is row y
  box(lines, y, o = {}) {
    const w = Math.max(...lines.map((l) => pixTextW(l))) + 8, h = lines.length * 10 + 4, x = Math.round((PIX.w - w) / 2);
    pixBox(x, y, w, h, { bg: Q.ink, edge: o.edge ?? Q.orange });
    lines.forEach((l, i) => pixText(l, PIX.w / 2, y + 3 + i * 10, o.fg ?? Q.white, { align: 'center' }));
  },
  // a transparent pass over the finished frame on canvas, in the 320x180 grid (or the camera's, when given)
  overlay(canvas, draw, res = RES) { ctx = canvas.getContext('2d'); lowres(res, draw); },
  // in play: the film's SCOUT 07 tag, the score where the film's RANGE sat, shield pips under it, the log line in the seam
  play(s) {
    hudTag({ at: -1 });
    pixOverlay(() => {
      const txt = 'SCORE ' + String(s.score).padStart(CFG.score.digits, '0'), w = pixTextW(txt) + 6, right = PIX.w - 11;
      pixBox(right - w, HUD_ROW.scoreY, w, 13, { bg: Q.ink, edge: Q.slate });
      pixText(txt, right - w + 3, HUD_ROW.scoreY + 3, Q.ice);
      for (let k = 0; k < CFG.scout.shields; k++) pixBox(right - 7 - k * 9, HUD_ROW.pipsY, 7, 6, { bg: k < s.player.shields ? Q.orange : Q.ink, edge: Q.slate });
      const hot = s.player.overheated, heat = s.player.heat, bw = CFG.hud.heatW;
      pixBox(right - bw, HUD_ROW.heatY, bw, 7, { bg: Q.ink, edge: hot && Hud.blinkOn(s.t, 0.15) ? Q.red : Q.slate });
      prect(right - bw + 2, HUD_ROW.heatY + 2, Math.round((bw - 4) * heat), 3, hot || heat > CFG.hud.heatWarn ? Q.red : Q.yellow);
      if (hot) pixText('HOT', right - bw - 4 - pixTextW('HOT'), HUD_ROW.heatY, Hud.blinkOn(s.t, 0.15) ? Q.red : Q.white);
      if (s.player.weapon !== 'default') {
        const label = (s.player.weapon === 'spread' ? 'SPR' : 'RKT') + ' ' + s.player.ammo;
        const col = s.player.weapon === 'spread' ? Q.yellow : Q.red;
        pixText(label, right - pixTextW(label), HUD_ROW.weaponY, col);
      }
      if (s.boss) {
        const B = s.boss, phase2 = B.hp <= B.maxHp * CFG.boss.phaseAt, col = phase2 ? Q.red : Q.grey;
        const label = 'WARDEN', lw = pixTextW(label), barW = 60;
        const totalW = lw + barW + 8, boxX = Math.round((PIX.w - totalW) / 2);
        pixBox(boxX, HUD_ROW.scoreY, totalW, 13, { bg: Q.ink, edge: col });
        pixText(label, boxX + 3, HUD_ROW.scoreY + 3, col);
        prect(boxX + lw + 6, HUD_ROW.scoreY + 4, Math.max(0, Math.round(barW * B.hp / B.maxHp)), 5, col);
      }
    });
    if (s.t < CFG.seam.logHold) pixCaption(LOG_LINE, { at: 0, dur: CFG.seam.logType, y: HUD_ROW.captionY, fg: Q.white, edge: Q.orange });
  },
  title(t, state) {
    const text = state === 'loading' ? 'LOADING' : state === 'silent' ? 'PRESS ANY KEY (NO SOUND)' : 'PRESS ANY KEY';
    if (state === 'loading' || Hud.blinkOn(t)) pixText(text, PIX.w / 2, HUD_ROW.promptY, Q.white, { align: 'center', shadow: Q.ink });
  },
  paused() { Hud.box(['PAUSED', 'P TO PLAY ON'], HUD_ROW.pausedY); },
  card(score, best, t) {
    const pad = (n) => String(n).padStart(CFG.score.digits, '0');
    Hud.box(['GAME OVER'], HUD_ROW.cardTop, { edge: Q.red });
    Hud.box(['SCORE ' + pad(score), 'BEST  ' + pad(best)], HUD_ROW.cardScores);
    if (Hud.blinkOn(t)) pixText('FIRE OR ENTER TO RESTART', PIX.w / 2, HUD_ROW.cardPrompt, Q.white, { align: 'center', shadow: Q.ink });
  },
  // the level complete card, over the belt's backdrop on the whole field
  levelComplete(score, best, t) {
    const pad = (n) => String(n).padStart(CFG.score.digits, '0');
    Hud.box(['LEVEL COMPLETE'], Math.round(PIX.h * 0.22), { edge: Q.orange });
    Hud.box(['SCORE ' + pad(score), 'BEST  ' + pad(best)], Math.round(PIX.h * 0.42));
    if (Hud.blinkOn(t)) pixText('FIRE OR ENTER TO CONTINUE', PIX.w / 2, PIX.h - 28, Q.white, { align: 'center', shadow: Q.ink });
  },
  // the level select, beside the scout (its marker, drawn by Draw.marker at MENU_X, MENU_Y0 + row * rowGap): a header, a row a
  // level with its best, the chosen one lit, and the start prompt, or a notice (a locked level) in its place
  select(levels, chosen, bests, t, notice) {
    const M = CFG.menu, pad = (n) => String(n).padStart(CFG.score.digits, '0'), x = MENU_X + M.boxGap;
    const rows = levels.map((L, i) => L.id + '  ' + L.name + (L.locked ? '' : '  BEST ' + pad(bests[i])));
    const w = Math.max(...rows.map((r) => pixTextW(r))) + 8, last = MENU_Y0 + (levels.length - 1) * M.rowGap;
    pixBox(x, MENU_Y0 - 38, pixTextW('SELECT LEVEL') + 8, 13, { bg: Q.ink, edge: Q.orange });
    pixText('SELECT LEVEL', x + 4, MENU_Y0 - 35, Q.white);
    levels.forEach((L, i) => {
      const on = i === chosen;
      pixBox(x, MENU_Y0 + i * M.rowGap - 6, w, 13, { bg: Q.ink, edge: on ? Q.orange : Q.slate });
      pixText(rows[i], x + 4, MENU_Y0 + i * M.rowGap - 3, L.locked ? Q.slate : on ? Q.white : Q.ice);
    });
    if (notice) pixText('NOT READY YET', x + w / 2, last + 20, Q.red, { align: 'center', shadow: Q.ink });
    else if (Hud.blinkOn(t)) pixText('FIRE OR ENTER TO START', x + w / 2, last + 20, Q.white, { align: 'center', shadow: Q.ink });
  },
  error(message) {
    const text = String(message).toUpperCase().slice(0, 2 * ERROR_LINE);
    Hud.box(['SOMETHING BROKE', text.slice(0, ERROR_LINE), text.slice(ERROR_LINE)].filter(Boolean), HUD_ROW.errorY, { edge: Q.red });
  },
};

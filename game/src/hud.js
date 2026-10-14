// =====================================================================
//  HUD - the screen-fixed pixel UI in the film's font and boxes: the score, shields and log line in play, the title
//  prompt, the pause box, the game-over card and the error card
// =====================================================================
const LOG_LINE = 'LOG 02: BELT AHEAD';
// rows of the 320x180 grid (captionY is in screen px, as the film's captions are)
const HUD_ROW = { scoreY: 10, pipsY: 26, weaponY: 36, captionY: 900, promptY: 150, pausedY: 74, cardTop: 4, cardScores: 124, cardPrompt: 169, errorY: 60 };
const ERROR_LINE = 48;   // glyphs per line on the error card
const Hud = {
  blinkOn(t, period = 0.5) { return Math.floor(t / period) % 2 === 0; },
  // centred lines of pixel text in one box whose top is row y
  box(lines, y, o = {}) {
    const w = Math.max(...lines.map((l) => pixTextW(l))) + 8, h = lines.length * 10 + 4, x = Math.round((PX_W - w) / 2);
    pixBox(x, y, w, h, { bg: Q.ink, edge: o.edge ?? Q.orange });
    lines.forEach((l, i) => pixText(l, PX_W / 2, y + 3 + i * 10, o.fg ?? Q.white, { align: 'center' }));
  },
  // a transparent pass over the finished frame on canvas, in the 320x180 grid
  overlay(canvas, draw) { ctx = canvas.getContext('2d'); lowres(RES, draw); },
  // in play: the film's SCOUT 07 tag, the score where the film's RANGE sat, shield pips under it, the log line in the seam
  play(s) {
    hudTag({ at: -1 });
    pixOverlay(() => {
      const txt = 'SCORE ' + String(s.score).padStart(CFG.score.digits, '0'), w = pixTextW(txt) + 6, right = PX_W - 11;
      pixBox(right - w, HUD_ROW.scoreY, w, 13, { bg: Q.ink, edge: Q.slate });
      pixText(txt, right - w + 3, HUD_ROW.scoreY + 3, Q.ice);
      for (let k = 0; k < CFG.scout.shields; k++) pixBox(right - 7 - k * 9, HUD_ROW.pipsY, 7, 6, { bg: k < s.player.shields ? Q.orange : Q.ink, edge: Q.slate });
      if (s.player.weapon !== 'default') {
        const secs = Math.max(1, Math.ceil(s.player.weaponUntil - s.t));
        const label = (s.player.weapon === 'spread' ? 'SPR' : 'RKT') + ' ' + secs;
        const col = s.player.weapon === 'spread' ? Q.yellow : Q.red;
        pixText(label, right - pixTextW(label), HUD_ROW.weaponY, col);
      }
      if (s.boss) {
        const B = s.boss, phase2 = B.hp <= B.maxHp * CFG.boss.phaseAt, col = phase2 ? Q.red : Q.grey;
        const label = 'WARDEN', lw = pixTextW(label), barW = 60;
        const totalW = lw + barW + 8, boxX = Math.round((PX_W - totalW) / 2);
        pixBox(boxX, HUD_ROW.scoreY, totalW, 13, { bg: Q.ink, edge: col });
        pixText(label, boxX + 3, HUD_ROW.scoreY + 3, col);
        prect(boxX + lw + 6, HUD_ROW.scoreY + 4, Math.max(0, Math.round(barW * B.hp / B.maxHp)), 5, col);
      }
    });
    if (s.t < CFG.seam.logHold) pixCaption(LOG_LINE, { at: 0, dur: CFG.seam.logType, y: HUD_ROW.captionY, fg: Q.white, edge: Q.orange });
  },
  title(t, state) {
    const text = state === 'loading' ? 'LOADING' : state === 'silent' ? 'PRESS ANY KEY (NO SOUND)' : 'PRESS ANY KEY';
    if (state === 'loading' || Hud.blinkOn(t)) pixText(text, PX_W / 2, HUD_ROW.promptY, Q.white, { align: 'center', shadow: Q.ink });
  },
  paused() { Hud.box(['PAUSED', 'P TO PLAY ON'], HUD_ROW.pausedY); },
  card(score, best, t) {
    const pad = (n) => String(n).padStart(CFG.score.digits, '0');
    Hud.box(['GAME OVER'], HUD_ROW.cardTop, { edge: Q.red });
    Hud.box(['SCORE ' + pad(score), 'BEST  ' + pad(best)], HUD_ROW.cardScores);
    if (Hud.blinkOn(t)) pixText('FIRE OR ENTER TO RESTART', PX_W / 2, HUD_ROW.cardPrompt, Q.white, { align: 'center', shadow: Q.ink });
  },
  error(message) {
    const text = String(message).toUpperCase().slice(0, 2 * ERROR_LINE);
    Hud.box(['SOMETHING BROKE', text.slice(0, ERROR_LINE), text.slice(ERROR_LINE)].filter(Boolean), HUD_ROW.errorY, { edge: Q.red });
  },
};

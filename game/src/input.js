// =====================================================================
//  INPUT - the keyboard: which keys are held (steering, firing) and which were just pressed (one-shot actions).
//  A key held down repeats no one-shot press, so holding Space through a death does not skip the game-over card.
// =====================================================================
const KEY_MAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  fire: ['Space'], skip: ['Enter'], skipEsc: ['Escape'], pause: ['KeyP', 'Escape'], mute: ['KeyM'],
};
const Input = {
  held: new Set(), pressed: [],
  // the steering and firing the held keys ask for
  steerFrom(held) {
    const any = (name) => KEY_MAP[name].some((code) => held.has(code));
    return { x: (any('right') ? 1 : 0) - (any('left') ? 1 : 0), y: (any('down') ? 1 : 0) - (any('up') ? 1 : 0), fire: any('fire') };
  },
  steer() { return Input.steerFrom(Input.held); },
  is(code, name) { return KEY_MAP[name].includes(code); },
  takePressed() { const p = Input.pressed; Input.pressed = []; return p; },
  attach(target) {
    const ours = new Set(Object.values(KEY_MAP).flat());
    target.addEventListener('keydown', (e) => {
      if (!e.repeat) Input.pressed.push(e.code);
      Input.held.add(e.code);
      if (ours.has(e.code)) e.preventDefault();   // arrows and Space would scroll the page
    });
    target.addEventListener('keyup', (e) => Input.held.delete(e.code));
    target.addEventListener('blur', () => Input.held.clear());   // a key released while the window was away would stay held
  },
};

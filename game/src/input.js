// Keyboard + mouse input. Keys are read every frame; actions are one-shot bits the
// main loop consumes with takeActions(). Mouse drag rotates the camera (pointer lock is
// optional — dragging works in a plain window and in headless screenshots).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyE') actions |= ACTION_ENTER;
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseDown(e) {
    if (e.button === 0) {
      actions |= ACTION_SHOOT;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
    }
  }
  function onMouseMove(e) {
    if (!dragging) return;
    lookDX += e.clientX - lastX;
    lookDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  }
  function onMouseUp() { dragging = false; }
  function onBlur() { keys.clear(); dragging = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  // Movement axes, -1..1. Forward is -Z in camera space; the main loop rotates by yaw.
  function move() {
    let x = 0, z = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') };
  }

  return {
    move,
    takeActions() { const a = actions; actions = 0; return a; },
    takeLook() { const d = { dx: lookDX, dy: lookDY }; lookDX = 0; lookDY = 0; return d; },
    isDown(code) { return keys.has(code); },
  };
}

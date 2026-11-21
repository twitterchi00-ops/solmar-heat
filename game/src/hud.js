// DOM HUD: health bar, money, wanted stars, minimap, mission banner, message log,
// crosshair, and the title / pause / game-over screens. All DOM is built here so
// index.html stays small; the minimap is a 2D canvas painted every frame.
import { CITY } from './config.js';

export function createHud() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left">
      <div id="hud-health"><div id="hud-health-fill"></div><span id="hud-health-text">100</span></div>
      <div id="hud-money">$0</div>
    </div>
    <div id="hud-top-right">
      <div id="hud-stars"></div>
      <canvas id="hud-minimap" width="160" height="160"></canvas>
    </div>
    <div id="hud-banner"></div>
    <div id="hud-mission"></div>
    <div id="hud-msg"></div>
    <div id="hud-crosshair">+</div>
    <div id="hud-screen">
      <h1 id="hud-title">SOLMAR HEAT</h1>
      <p id="hud-subtitle">An open-world crime story in Solmar Bay</p>
      <div id="hud-body"></div>
      <button id="hud-button">START</button>
      <p id="hud-controls">WASD move &nbsp;·&nbsp; Mouse drag to look &nbsp;·&nbsp; E enter / exit car &nbsp;·&nbsp; Click shoot &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; P pause</p>
    </div>`;
  const el = (id) => document.getElementById(id);
  const healthFill = el('hud-health-fill');
  const healthText = el('hud-health-text');
  const moneyEl = el('hud-money');
  const starsEl = el('hud-stars');
  const bannerEl = el('hud-banner');
  const missionEl = el('hud-mission');
  const msgEl = el('hud-msg');
  const screenEl = el('hud-screen');
  const titleEl = el('hud-title');
  const bodyEl = el('hud-body');
  const buttonEl = el('hud-button');
  const map = el('hud-minimap');
  const mapCtx = map.getContext('2d');
  let msgTimer = 0;

  function showMessage(text, seconds = 3) {
    msgEl.textContent = text;
    msgTimer = seconds;
  }

  function showScreen(title, body, button, onClick) {
    titleEl.textContent = title;
    bodyEl.innerHTML = body;
    buttonEl.textContent = button;
    screenEl.style.display = 'flex';
    buttonEl.onclick = () => { onClick(); };
  }
  function hideScreen() { screenEl.style.display = 'none'; }

  function drawMinimap(state) {
    const W = 160, S = W / 360;
    mapCtx.fillStyle = '#10131a';
    mapCtx.fillRect(0, 0, W, W);
    // Roads.
    mapCtx.fillStyle = '#3a3f4a';
    for (const c of [-150, -100, -50, 0, 50, 100, 150]) {
      mapCtx.fillRect((c - 5 + 180) * S, 0, 10 * S, W);
      mapCtx.fillRect(0, (c - 5 + 180) * S, W, 10 * S);
    }
    // Ocean + beach.
    mapCtx.fillStyle = '#0e4d6e';
    mapCtx.fillRect(0, (165 + 180) * S, W, W - (165 + 180) * S);
    mapCtx.fillStyle = '#c2a878';
    mapCtx.fillRect(0, (165 + 180) * S, W, 4);
    // Safehouse ring.
    mapCtx.strokeStyle = '#39d98a';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.arc((-125 + 180) * S, (125 + 180) * S, 8 * S, 0, Math.PI * 2);
    mapCtx.stroke();
    // Mission target.
    if (state.target) {
      const pulse = 4 + Math.sin(performance.now() / 200) * 2;
      mapCtx.fillStyle = '#ffd166';
      mapCtx.beginPath();
      mapCtx.arc((state.target.x + 180) * S, (state.target.z + 180) * S, pulse, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Traffic (yellow), cops (blue/red), player (green, with heading tick).
    mapCtx.fillStyle = '#ffd166';
    for (const c of state.traffic) mapCtx.fillRect((c.x + 180) * S - 1, (c.z + 180) * S - 1, 2, 2);
    mapCtx.fillStyle = '#4d8dff';
    for (const c of state.cops) mapCtx.fillRect((c.x + 180) * S - 2, (c.z + 180) * S - 2, 4, 4);
    mapCtx.fillStyle = '#39d98a';
    mapCtx.beginPath();
    mapCtx.arc((state.x + 180) * S, (state.z + 180) * S, 4, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.strokeStyle = '#39d98a';
    mapCtx.beginPath();
    mapCtx.moveTo((state.x + 180) * S, (state.z + 180) * S);
    mapCtx.lineTo((state.x + 180) * S + Math.sin(state.heading) * 9, (state.z + 180) * S + Math.cos(state.heading) * 9);
    mapCtx.stroke();
  }

  function update(state, dt) {
    healthFill.style.width = `${Math.max(0, state.hp)}%`;
    healthFill.style.background = state.hp > 50 ? '#39d98a' : state.hp > 25 ? '#ffd166' : '#ff4d4d';
    healthText.textContent = String(Math.max(0, Math.ceil(state.hp)));
    moneyEl.textContent = `$${state.money}`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    starsEl.textContent = stars;
    starsEl.style.color = state.wanted > 0 ? '#ffd166' : '#5a6272';
    bannerEl.textContent = state.banner || '';
    missionEl.textContent = state.missionText || '';
    if (msgTimer > 0) {
      msgTimer -= dt;
      if (msgTimer <= 0) msgEl.textContent = '';
    }
    drawMinimap(state);
  }

  return { update, showMessage, showScreen, hideScreen };
}

// Procedural WebAudio: engine hum, police siren, gunshots, pickups, crashes.
// Everything is synthesised — no audio assets. Every call is guarded so a headless
// browser (or a muted tab) can never throw.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch { return false; }
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function startEngine() {
    if (!ensure()) return;
    try {
      if (engineOsc) return;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
    } catch { /* silent */ }
  }

  function setEngine(speed01, on) {
    if (!engineOsc || !engineGain) return;
    try {
      engineOsc.frequency.value = 55 + speed01 * 140;
      engineGain.gain.value = on ? 0.03 + speed01 * 0.04 : 0.0;
    } catch { /* silent */ }
  }

  function startSiren() {
    if (!ensure()) return;
    try {
      if (sirenOsc) return;
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain).connect(ctx.destination);
      sirenOsc.start();
    } catch { /* silent */ }
  }

  // Call every frame with the nearest cop distance; the siren wails and fades with it.
  function updateSiren(dt, nearestCop, wanted) {
    if (!sirenOsc || !sirenGain) return;
    try {
      sirenTimer += dt;
      if (sirenTimer > 0.45) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 880 : 660;
      }
      const vol = wanted > 0 && nearestCop < 90 ? Math.max(0, 0.05 * (1 - nearestCop / 90)) : 0;
      sirenGain.gain.value = vol;
    } catch { /* silent */ }
  }

  function blip(freq, dur, vol, type = 'sine') {
    if (!ensure()) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g).connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch { /* silent */ }
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ensure()) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start();
    } catch { /* silent */ }
  }

  return {
    unlock,
    startEngine,
    setEngine,
    startSiren,
    updateSiren,
    shot() { noiseBurst(0.12, 0.25, 2400); },
    crash() { noiseBurst(0.25, 0.3, 300); blip(70, 0.2, 0.2, 'triangle'); },
    pickup() { blip(660, 0.1, 0.15); setTimeout(() => blip(990, 0.14, 0.15), 90); },
    mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.16, 0.15), i * 110)); },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 0.15, 'triangle'), i * 160)); },
  };
}

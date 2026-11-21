// Save / best-money persistence in localStorage. Guarded: private windows and
// headless runs can refuse storage, and the game must keep working.
import { SAVE_KEY, BEST_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 0, missionsDone: 0, muted: false };
    const data = JSON.parse(raw);
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      missionsDone: typeof data.missionsDone === 'number' ? data.missionsDone : 0,
      muted: !!data.muted,
    };
  } catch { return { money: 0, missionsDone: 0, muted: false }; }
}

export function writeSave(save) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function loadBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

export function writeBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* ignore */ }
}

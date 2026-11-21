// The five chained missions. Each mission is a list of stages; a stage completes when the
// player reaches its marker, survives its timer, or enters a car. The module owns the
// beacon mesh (a glowing column at the current target) and the banner text, and reports
// events the main loop turns into money, sound and HUD updates.
import * as THREE from 'three';
import { MISSIONS, SAFEHOUSE } from './config.js';

export function createMissions(scene) {
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd166, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  diamond.visible = false;
  scene.add(diamond);

  let missionIndex = 0;
  let stageIndex = 0;
  let stageTimer = 0;
  let done = false;
  let banner = '';
  let bannerTimer = 0;
  let failedOnce = false;

  function current() { return MISSIONS[missionIndex]; }
  function stage() { return done ? null : MISSIONS[missionIndex].stages[stageIndex]; }

  function showBanner(text, seconds = 3) {
    banner = text;
    bannerTimer = seconds;
  }

  function placeBeacon(x, z) {
    beacon.visible = true;
    beacon.position.set(x, 30, z);
    diamond.visible = true;
    diamond.position.set(x, 8, z);
  }

  function hideBeacon() {
    beacon.visible = false;
    diamond.visible = false;
  }

  function start() {
    missionIndex = 0;
    stageIndex = 0;
    stageTimer = 0;
    done = false;
    showBanner('MISSION 1 — JOYRIDE: steal a car', 4);
    const s = stage();
    if (s && s.type === 'reach') placeBeacon(s.x, s.z);
  }

  function advance(events) {
    stageIndex += 1;
    stageTimer = 0;
    failedOnce = false;
    const m = current();
    if (stageIndex >= m.stages.length) {
      events.push({ type: 'missionComplete', mission: m });
      missionIndex += 1;
      stageIndex = 0;
      if (missionIndex >= MISSIONS.length) {
        done = true;
        hideBeacon();
        return;
      }
      const next = current();
      showBanner(`MISSION ${next.id + 1} — ${next.title}: ${next.text}`, 4);
    }
    const s = stage();
    if (s && s.type === 'reach') placeBeacon(s.x, s.z);
    else if (s && s.type === 'timedReach') placeBeacon(s.x, s.z);
    else hideBeacon();
  }

  // Called every step. ctx: {x, z, inCar, hp, wanted, setWanted}. Returns events.
  function update(dt, ctx) {
    const events = [];
    if (done) return events;
    if (bannerTimer > 0) bannerTimer -= dt;
    diamond.rotation.y += dt * 2;
    const s = stage();
    if (!s) return events;
    stageTimer += dt;

    if (s.type === 'enterCar') {
      if (ctx.inCar) {
        events.push({ type: 'stageDone', text: 'Car stolen!' });
        advance(events);
      }
    } else if (s.type === 'reach') {
      const d = Math.hypot(ctx.x - s.x, ctx.z - s.z);
      if (d < s.radius) {
        events.push({ type: 'stageDone', text: 'Target reached' });
        advance(events);
      }
    } else if (s.type === 'survive') {
      // Wanted is forced at stage start by the main loop (once, via stageTimer small).
      if (stageTimer < 0.1 && s.wanted) ctx.setWanted(s.wanted);
      const d = Math.hypot(ctx.x - SAFEHOUSE.x, ctx.z - SAFEHOUSE.z);
      if (d > SAFEHOUSE.missionRadius + 6) {
        // Left the lot: the clock pauses (it only counts inside the mission radius).
        stageTimer = Math.max(0, stageTimer - dt);
      }
      if (stageTimer >= s.seconds) {
        events.push({ type: 'stageDone', text: 'Survived!' });
        advance(events);
      }
    } else if (s.type === 'timedReach') {
      if (stageTimer < 0.1 && s.wanted) ctx.setWanted(s.wanted);
      const d = Math.hypot(ctx.x - s.x, ctx.z - s.z);
      if (d < s.radius) {
        events.push({ type: 'stageDone', text: 'Made it!' });
        advance(events);
      } else if (stageTimer >= s.seconds) {
        // Out of time: report once, then restart this stage.
        if (!failedOnce) {
          events.push({ type: 'failed', text: 'Too slow — mission failed, try again' });
          failedOnce = true;
        }
        stageTimer = 0;
      }
    }
    return events;
  }

  function target() {
    const s = stage();
    if (!s) return null;
    if (s.type === 'reach' || s.type === 'timedReach') return { x: s.x, z: s.z };
    if (s.type === 'survive') return { x: SAFEHOUSE.x, z: SAFEHOUSE.z };
    return null;
  }

  function progress() {
    const s = stage();
    if (!s) return 0;
    if (s.type === 'survive' || s.type === 'timedReach') return Math.min(1, stageTimer / s.seconds);
    return 0;
  }

  // Test/screenshot helper: jump straight to a mission/stage (used by the safehouse shot).
  function debugJumpTo(mi, si) {
    missionIndex = mi;
    stageIndex = si;
    stageTimer = 0;
    failedOnce = false;
    const m = current();
    showBanner(`MISSION ${m.id + 1} — ${m.title}: ${m.text}`, 4);
    const s = stage();
    if (s && (s.type === 'reach' || s.type === 'timedReach')) placeBeacon(s.x, s.z);
    else hideBeacon();
  }

  return {
    start, update, target, progress, debugJumpTo,
    get done() { return done; },
    get missionIndex() { return missionIndex; },
    get banner() { return bannerTimer > 0 ? banner : ''; },
    get stageText() { const s = stage(); return s ? s.text : (done ? 'Story complete!' : ''); },
    get stageTimer() { return stageTimer; },
  };
}

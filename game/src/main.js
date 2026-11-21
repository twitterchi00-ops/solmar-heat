// SOLMAR HEAT — boot and the one loop. Input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title, play, paused,
// game over. ?seed=N fixes the city. ?shot=start|play|chase|safehouse (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { CITY, SAFEHOUSE, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, resolveCircle } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, ACTION_SHOOT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadBest, loadSave, writeBest, writeSave } from './save.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createCar, makeCarMesh, updatePlayerCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPlayer, createPlayerMesh, nearestCar, updatePlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const BOUNDS = CITY.half;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const { renderer, scene, camera, camState, chase, orbit, draw } = createRenderer(canvas);
const world = createWorld(random);
scene.add(world.group);
const hud = createHud();
const audio = createAudio();
const save = loadSave();
let best = loadBest();

const traffic = createTraffic(random, scene, world.colliders);
const police = createPolice(random, scene, world.colliders);
const missions = createMissions(scene);
const combat = createCombat(scene, camera);

// Parked cars near the spawn, stealable.
const parkedCars = [];
for (const [x, z, color] of [[14, 6, 0xd86a2a], [20, -4, 0x2f5a8a], [-6, 14, 0xc2a23a]]) {
  const mesh = makeCarMesh(color);
  const car = createCar(mesh, x, z, random.range(0, Math.PI * 2), color);
  car.mesh.position.set(x, 0, z);
  scene.add(mesh);
  parkedCars.push(car);
}
const allCars = [...parkedCars, ...traffic.cars];

// Tag meshes so the shooting raycast can tell what it hit.
for (const car of parkedCars) car.mesh.userData.kind = 'parked';
for (const car of traffic.cars) car.mesh.userData.kind = 'traffic';
for (const ped of traffic.peds) ped.mesh.userData.kind = 'ped';
for (const car of police.copCars) car.mesh.userData.kind = 'copCar';
world.group.traverse((o) => {
  if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry' && !o.userData.kind) {
    o.userData.kind = 'building';
  }
});

const playerMesh = createPlayerMesh();
scene.add(playerMesh);
const player = createPlayer(playerMesh, 10, 0);
player.mesh.position.set(10, 0, 0);

let screen = 'title';
let money = save.money;
let missionsDone = save.missionsDone;
let camYaw = 0;
let time = 0;
let orbitTime = 0;

function announce(msg) { status.textContent = msg; }

function playerPos() {
  return player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.x, z: player.z };
}

function enterCar(car) {
  player.inCar = car;
  car.driven = true;
  car.waypoints = null;
  player.mesh.visible = false;
  police.addWanted(1, player.x, player.z);
  hud.showMessage('Car stolen! Wanted +1');
  audio.pickup();
}

function exitCar() {
  const car = player.inCar;
  player.inCar = null;
  player.x = car.x + Math.cos(car.heading + Math.PI / 2) * 2.5;
  player.z = car.z + Math.sin(car.heading + Math.PI / 2) * 2.5;
  const fixed = resolveCircle(player.x, player.z, player.radius, world.colliders);
  player.x = fixed.x; player.z = fixed.z;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
}

function fireShot() {
  const origin = camera.position.clone();
  const aim = combat.aimPoint();
  const hittables = [];
  scene.traverse((o) => { if (o.isMesh) hittables.push(o); });
  combat.shoot(origin, aim, hittables, (hit) => {
    let obj = hit.object;
    while (obj && !obj.userData.kind) obj = obj.parent;
    const kind = obj ? obj.userData.kind : null;
    if (kind === 'copCar' || kind === 'footCop') {
      police.addWanted(1, player.x, player.z);
      hud.showMessage('You shot a cop! Wanted +1');
    } else if (kind === 'ped') {
      traffic.knockDown(hit.point.x, hit.point.z, 2);
      police.addWanted(1, player.x, player.z);
      hud.showMessage('Pedestrian down! Wanted +1');
    }
  });
  audio.shot();
}

function handleMissionEvents(events) {
  for (const e of events) {
    if (e.type === 'missionComplete') {
      money += e.mission.reward;
      missionsDone += 1;
      if (e.mission.id === 2) player.hp = 100; // safehouse stand restores health
      hud.showMessage(`MISSION ${e.mission.id + 1} COMPLETE — +$${e.mission.reward}`);
      announce(`Mission ${e.mission.id + 1} complete. Earned $${e.mission.reward}.`);
      audio.mission();
      writeSave({ money, missionsDone, muted: save.muted });
      if (money > best) { best = money; writeBest(best); }
      if (missions.done) {
        screen = 'over';
        audio.mission();
        hud.showScreen('KING OF SOLMAR', `Story complete! You earned <b>$${money}</b> across 5 missions.<br>Best: $${best}.`, 'PLAY AGAIN', startGame);
        announce('Story complete!');
      }
    } else if (e.type === 'failed') {
      hud.showMessage(e.text);
      police.setWanted(0, player.x, player.z);
    } else if (e.type === 'stageDone') {
      audio.pickup();
    }
  }
}

function startGame() {
  missions.start();
  player.hp = 100;
  player.x = 10; player.z = 0;
  player.inCar = null;
  player.mesh.visible = true;
  player.mesh.position.set(10, 0, 0);
  police.setWanted(0, 10, 0);
  camYaw = 0;
  screen = 'play';
  hud.hideScreen();
  audio.unlock();
  audio.startEngine();
  audio.startSiren();
  announce('Playing. Steal a car and follow the marker.');
}

function endGame(busted) {
  screen = 'over';
  if (busted) {
    audio.busted();
    announce('Busted. Game over.');
  }
  hud.showScreen(
    busted ? 'BUSTED' : 'GAME OVER',
    `You earned <b>$${money}</b> · Missions done: ${missionsDone} · Best: $${best}.`,
    'PLAY AGAIN',
    startGame,
  );
}

function step(dt) {
  time += dt;
  const input = window.__input;
  const move = input.move();
  const look = input.takeLook();
  camYaw += look.dx * 0.004;
  camState.yaw = camYaw;
  const actions = input.takeActions();

  if (actions & ACTION_PAUSE) {
    if (screen === 'play') {
      screen = 'paused';
      hud.showScreen('PAUSED', 'Take a breath. Solmar waits.', 'RESUME', () => { screen = 'play'; hud.hideScreen(); });
    } else if (screen === 'paused') {
      screen = 'play';
      hud.hideScreen();
    }
  }
  if (screen !== 'play') return;

  const pos = playerPos();
  if (actions & ACTION_ENTER) {
    if (player.inCar) exitCar();
    else {
      const car = nearestCar(player, allCars, 4);
      if (car) enterCar(car);
    }
  }
  if (actions & ACTION_SHOOT) fireShot();

  // Drive or walk.
  let hit = false;
  if (player.inCar) {
    hit = updatePlayerCar(player.inCar, dt, move, camYaw, world.colliders, BOUNDS);
    player.x = player.inCar.x; player.z = player.inCar.z;
    // Running over pedestrians is a crime.
    if (Math.abs(player.inCar.speed) > 4 && traffic.knockDown(player.inCar.x, player.inCar.z, 2.2)) {
      police.addWanted(1, player.x, player.z);
      hud.showMessage('Pedestrian hit! Wanted +1');
    }
    // In-car camera follows the car heading.
    camYaw += (player.inCar.heading - camYaw) * Math.min(1, dt * 1.5);
  } else {
    updatePlayer(player, dt, move, camYaw, world.colliders, BOUNDS);
  }
  if (hit) { audio.crash(); }

  // Traffic (skip cars the player drives) and police.
  for (const car of traffic.cars) {
    if (car.driven) continue;
  }
  traffic.update(dt, BOUNDS);
  const dmg = police.update(dt, player.x, player.z, player, BOUNDS, () => audio.crash());
  player.hp -= dmg;

  // Safehouse heal ring: 20 HP/s inside 8 m of the lot centre.
  const dSafe = Math.hypot(player.x - SAFEHOUSE.x, player.z - SAFEHOUSE.z);
  if (dSafe < SAFEHOUSE.healRadius) {
    player.hp = Math.min(100, player.hp + SAFEHOUSE.healRate * dt);
  }

  combat.update(dt);
  const events = missions.update(dt, {
    x: player.x, z: player.z, inCar: !!player.inCar, hp: player.hp,
    wanted: police.wanted,
    setWanted: (n) => police.setWanted(n, player.x, player.z),
  });
  handleMissionEvents(events);

  audio.setEngine(player.inCar ? Math.abs(player.inCar.speed) / 34 : 0, !!player.inCar);
  audio.updateSiren(dt, police.nearestCopDistance(player.x, player.z), police.wanted);

  if (player.hp <= 0) endGame(true);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (screen === 'title') {
    orbitTime += dt;
    orbit(orbitTime);
    traffic.update(dt, BOUNDS);
    draw();
  } else if (screen === 'play' || screen === 'paused') {
    if (screen === 'play') {
      acc += dt;
      while (acc >= STEP) { step(STEP); acc -= STEP; }
    }
    const focus = playerPos();
    chase(focus, player.inCar ? player.inCar.heading : player.heading, !!player.inCar, dt);
    draw();
  } else {
    draw();
  }
  hud.update({
    hp: player.hp, money, wanted: police.wanted,
    banner: missions.banner,
    missionText: missions.done ? 'Story complete!' : `M${missions.missionIndex + 1}: ${missions.stageText}`,
    x: player.x, z: player.z,
    heading: player.inCar ? player.inCar.heading : player.heading,
    target: missions.target(),
    traffic: traffic.cars.map((c) => ({ x: c.x, z: c.z })),
    cops: [...police.copCars.map((c) => ({ x: c.x, z: c.z })), ...police.footCops.map((c) => ({ x: c.x, z: c.z }))],
  }, dt);
}

let last = performance.now();
let acc = 0;

function runShot(name) {
  const G = { player, traffic, police, missions };
  const staged = stageShot(name, G);
  screen = staged.screen;
  hud.hideScreen();
  if (staged.screen === 'title') {
    hud.showScreen('SOLMAR HEAT', '', 'START', () => {});
  }
  let painted = 0;
  function paint() {
    if (staged.orbit) orbit(1.2);
    else {
      const focus = playerPos();
      chase(focus, player.inCar ? player.inCar.heading : player.heading, !!player.inCar, 0.5);
    }
    traffic.update(STEP, BOUNDS);
    draw();
    hud.update({
      hp: player.hp, money, wanted: police.wanted,
      banner: missions.banner,
      missionText: `M${missions.missionIndex + 1}: ${missions.stageText}`,
      x: player.x, z: player.z,
      heading: player.inCar ? player.inCar.heading : player.heading,
      target: missions.target(),
      traffic: traffic.cars.map((c) => ({ x: c.x, z: c.z })),
      cops: [...police.copCars.map((c) => ({ x: c.x, z: c.z })), ...police.footCops.map((c) => ({ x: c.x, z: c.z }))],
    }, STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  window.__input = createInput(canvas);
  hud.showScreen(
    'SOLMAR HEAT',
    `Five missions across Solmar Bay. Steal cars, dodge the law, survive the safehouse stand.<br>Best: $${best}.`,
    'START',
    startGame,
  );
  announce('Solmar Heat. Press Space or click Start.');
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      hud.showScreen('PAUSED', 'Take a breath. Solmar waits.', 'RESUME', () => { screen = 'play'; hud.hideScreen(); });
    }
  });
  requestAnimationFrame(frame);
}

// Test hooks: the playthrough probe and the screenshot driver read these.
window.__game = {
  get screen() { return screen; },
  player, missions, police, traffic, world, parkedCars,
  get money() { return money; },
  startGame, endGame,
  teleport(x, z) { player.x = x; player.z = z; player.mesh.position.set(x, 0, z); },
};

if (shot) runShot(shot);
else runGame();

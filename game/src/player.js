// The player on foot: a capsule character with a cap, WASD movement relative to the
// camera yaw, sprint, and entering/exiting cars with E.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCircle } from './world.js';

export function createPlayerMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4fc3f7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.9, 4, 10), bodyMat);
  body.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
  head.position.y = 1.85;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0xff2d78 }));
  cap.position.y = 2.05;
  g.add(body, head, cap);
  return g;
}

export function createPlayer(mesh, x, z) {
  return {
    mesh, x, z,
    heading: 0,
    hp: PLAYER.maxHp,
    inCar: null, // the car object when driving, else null
    radius: PLAYER.radius,
  };
}

export function updatePlayer(player, dt, move, yaw, colliders, bounds) {
  if (player.inCar) return;
  const speed = move.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  // Camera-relative movement. Camera forward is F=(sin yaw, cos yaw) and camera right
  // is R=(-cos yaw, sin yaw); W (move.z=-1) walks along F, D (move.x=1) along R.
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const wx = (-move.z * sin - move.x * cos) * speed * dt;
  const wz = (-move.z * cos + move.x * sin) * speed * dt;
  let nx = player.x + wx, nz = player.z + wz;
  nx = Math.max(-bounds, Math.min(bounds, nx));
  nz = Math.max(-bounds, Math.min(bounds, nz));
  const fixed = resolveCircle(nx, nz, player.radius, colliders);
  player.x = fixed.x; player.z = fixed.z;
  if (Math.hypot(wx, wz) > 0.001) {
    player.heading = Math.atan2(wx, wz);
  }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  // Walk bob.
  const t = performance.now() / 1000;
  player.mesh.position.y = Math.hypot(wx, wz) > 0.001 ? Math.abs(Math.sin(t * 10)) * 0.06 : 0;
}

// Nearest car within enter range of the player (on foot), or null.
export function nearestCar(player, cars, range = 4) {
  let best = null, bestD = range;
  for (const car of cars) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

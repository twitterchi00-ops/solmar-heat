// Arcade car: a low-poly body + cabin + 4 wheels, simple accelerate/steer physics with
// drift, and circle-vs-AABB collision against buildings. No real suspension model —
// the feel comes from speed-sensitive steering and a little slide.
import * as THREE from 'three';
import { CAR } from './config.js';
import { resolveCircle } from './world.js';

export function makeCarMesh(color, isCop = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x182233 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  g.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
    wheels.push(w);
  }
  // Headlights.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lampMat);
    lamp.position.set(x, 0.6, 2.22);
    g.add(lamp);
  }
  let lightbar = null;
  if (isCop) {
    lightbar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.35;
    lightbar.add(red, blue);
    lightbar.position.set(0, 1.5, -0.2);
    lightbar.userData = { red, blue };
    g.add(lightbar);
  }
  g.userData.wheels = wheels;
  g.userData.lightbar = lightbar;
  return g;
}

export function createCar(mesh, x, z, heading, color) {
  return {
    mesh, x, z, heading, color,
    speed: 0, steer: 0,
    radius: CAR.radius,
    // Waypoint follower (traffic) — null for player-driven cars.
    waypoints: null, wpIndex: 0,
    // Police chase target — null unless this is a cop car.
    target: null,
  };
}

// Arcade update for a player-driven car. move = {x, z} in camera space (z forward).
// Returns true when a hard impact happened (for the crash sound).
export function updatePlayerCar(car, dt, move, yaw, colliders, bounds) {
  const fwd = move.z < 0 ? 1 : (move.z > 0 ? -0.6 : 0);
  const throttle = fwd;
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, car.speed));
  const steerInput = -move.x;
  const steerAmount = steerInput * CAR.steer * (1 - Math.min(0.55, Math.abs(car.speed) / CAR.maxSpeed * 0.55));
  car.heading += steerAmount * (car.speed / CAR.maxSpeed) * dt * 2.2 * Math.sign(car.speed || 1);
  // Keep the car aligned with the camera yaw when the player turns the camera.
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  let nx = car.x + dx, nz = car.z + dz;
  nx = Math.max(-bounds, Math.min(bounds, nx));
  nz = Math.max(-bounds, Math.min(bounds, nz));
  const before = { x: car.x, z: car.z };
  const fixed = resolveCircle(nx, nz, car.radius, colliders);
  car.x = fixed.x; car.z = fixed.z;
  const hit = Math.hypot(fixed.x - (before.x + dx), fixed.z - (before.z + dz)) > 0.05
    && Math.abs(car.speed) > 6;
  if (hit) car.speed *= 0.45;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  return hit;
}

// Simple waypoint follower for traffic and cop cars.
export function followWaypoints(car, dt, speed, colliders, bounds) {
  if (!car.waypoints || car.waypoints.length === 0) return;
  const target = car.waypoints[car.wpIndex];
  const dx = target.x - car.x, dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 3) {
    car.wpIndex = (car.wpIndex + 1) % car.waypoints.length;
    return;
  }
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  car.speed = speed;
  const nx = car.x + Math.sin(car.heading) * speed * dt;
  const nz = car.z + Math.cos(car.heading) * speed * dt;
  const fixed = resolveCircle(
    Math.max(-bounds, Math.min(bounds, nx)),
    Math.max(-bounds, Math.min(bounds, nz)),
    car.radius, colliders,
  );
  car.x = fixed.x; car.z = fixed.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
}

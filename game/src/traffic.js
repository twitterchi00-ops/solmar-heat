// Traffic and pedestrians. Traffic cars loop rectangles of road centrelines; pedestrians
// stroll sidewalk edges and turn at block corners. All motion is deterministic from the
// seeded RNG, so the same seed stages the same street.
import * as THREE from 'three';
import { PED_COUNT, TRAFFIC_COUNT } from './config.js';
import { createCar, followWaypoints, makeCarMesh } from './vehicles.js';

const CAR_COLORS = [0xd8d8d8, 0x2a2d34, 0x8a2f2f, 0x2f5a8a, 0xc2a23a, 0x3a7a4a, 0x7a3a6b, 0xd86a2a];
const PED_COLORS = [0xe8e8e8, 0x4a6b8a, 0x8a4a4a, 0x4a8a5a, 0xd8b13a, 0x7a5a9a];

function roadLoops() {
  // Rectangles on road centrelines, each a loop around one or four blocks.
  const loops = [];
  for (const a of [-125, -75, -25, 25, 75]) {
    for (const b of [-125, -75, -25, 25, 75]) {
      loops.push([
        { x: a, z: b }, { x: a + 50, z: b }, { x: a + 50, z: b + 50 }, { x: a, z: b + 50 },
      ]);
    }
  }
  loops.push([
    { x: -150, z: -150 }, { x: 150, z: -150 }, { x: 150, z: 150 }, { x: -150, z: 150 },
  ]);
  return loops;
}

export function createTraffic(random, scene, colliders) {
  const group = new THREE.Group();
  const loops = roadLoops();
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const loop = random.pick(loops);
    const start = random.pick(loop);
    const mesh = makeCarMesh(random.pick(CAR_COLORS));
    const car = createCar(mesh, start.x, start.z, random.range(0, Math.PI * 2), 0);
    car.waypoints = loop;
    car.wpIndex = random.int(0, loop.length - 1);
    car.speed = random.range(7, 10);
    car.mesh.position.set(car.x, 0, car.z);
    group.add(mesh);
    cars.push(car);
  }

  // Pedestrians: capsule people walking the sidewalk ring of a block.
  const peds = [];
  const pedGeo = new THREE.CapsuleGeometry(0.32, 0.9, 3, 8);
  for (let i = 0; i < PED_COUNT; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: random.pick(PED_COLORS) });
    const mesh = new THREE.Mesh(pedGeo, mat);
    const bx = random.pick([-125, -75, -25, 25, 75, 125]);
    const bz = random.pick([-125, -75, -25, 25, 75, 125]);
    const ped = {
      mesh,
      x: bx + random.range(-18, 18), z: bz + random.range(-18, 18),
      heading: random.range(0, Math.PI * 2),
      speed: random.range(1.1, 1.9),
      turnIn: random.range(2, 6),
      down: false, downTimer: 0,
    };
    mesh.position.set(ped.x, 1.0, ped.z);
    group.add(mesh);
    peds.push(ped);
  }
  scene.add(group);

  return {
    cars, peds,
    update(dt, bounds) {
      for (const car of cars) followWaypoints(car, dt, car.speed, colliders, bounds);
      for (const ped of peds) {
        if (ped.down) {
          ped.downTimer -= dt;
          ped.mesh.rotation.z = Math.PI / 2;
          if (ped.downTimer <= 0) { ped.down = false; ped.mesh.rotation.z = 0; }
          continue;
        }
        ped.turnIn -= dt;
        if (ped.turnIn <= 0) {
          ped.heading += random.range(-1.2, 1.2);
          ped.turnIn = random.range(2, 6);
        }
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
        // Stay inside the city and roughly on sidewalks: bounce off the edges.
        if (Math.abs(ped.x) > bounds || Math.abs(ped.z) > bounds) {
          ped.heading += Math.PI;
          ped.x = Math.max(-bounds, Math.min(bounds, ped.x));
          ped.z = Math.max(-bounds, Math.min(bounds, ped.z));
        }
        ped.mesh.position.set(ped.x, 1.0, ped.z);
        ped.mesh.rotation.y = ped.heading;
      }
    },
    // Knock a pedestrian down (crime). Returns true if one was hit.
    knockDown(x, z, radius) {
      for (const ped of peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - x, ped.z - z) < radius + 0.6) {
          ped.down = true;
          ped.downTimer = 6;
          return true;
        }
      }
      return false;
    },
  };
}

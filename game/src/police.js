// Wanted system and police. Wanted 0-5: cop cars chase and ram, foot cops chase on foot.
// Wanted decays after 12 crime-free seconds. The player is busted at 0 HP.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { createCar, followWaypoints, makeCarMesh } from './vehicles.js';
import { resolveCircle } from './world.js';

export function createPolice(random, scene, colliders) {
  const group = new THREE.Group();
  scene.add(group);
  const copCars = [];
  const footCops = [];
  let wanted = 0;
  let decayTimer = 0;
  let flashTimer = 0;

  function spawnCopCar(x, z) {
    const mesh = makeCarMesh(0x1a1a22, true);
    const car = createCar(mesh, x, z, random.range(0, Math.PI * 2), 0);
    car.target = { x, z };
    group.add(mesh);
    copCars.push(car);
    return car;
  }

  function spawnFootCop(x, z) {
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.9, 4, 10),
      new THREE.MeshLambertMaterial({ color: 0x2244aa }),
    );
    mesh.position.set(x, 1.0, z);
    group.add(mesh);
    const cop = { mesh, x, z, hitCooldown: 0 };
    footCops.push(cop);
    return cop;
  }

  function setWanted(level, px, pz) {
    wanted = Math.max(0, Math.min(WANTED.max, level));
    decayTimer = 0;
    // Match the fleet to the wanted level: one cop car per star, foot cops from 2 up.
    const wantCars = wanted >= 1 ? Math.min(wanted, 3) : 0;
    const wantFoot = wanted >= 2 ? Math.min(wanted - 1, 4) : 0;
    while (copCars.length < wantCars) {
      const a = random.range(0, Math.PI * 2);
      spawnCopCar(px + Math.cos(a) * 30, pz + Math.sin(a) * 30);
    }
    while (footCops.length < wantFoot) {
      const a = random.range(0, Math.PI * 2);
      spawnFootCop(px + Math.cos(a) * 18, pz + Math.sin(a) * 18);
    }
    return wanted;
  }

  function addWanted(n, px, pz) {
    return setWanted(wanted + n, px, pz);
  }

  // dt, player pos, player object (for damage), bounds. Returns damage dealt this frame.
  function update(dt, px, pz, player, bounds, onRam) {
    let damage = 0;
    if (wanted > 0) {
      decayTimer += dt;
      if (decayTimer > WANTED.decaySeconds) {
        setWanted(wanted - 1, px, pz);
        decayTimer = 0;
      }
    }
    flashTimer += dt;
    const flashOn = Math.floor(flashTimer * 4) % 2 === 0;
    for (const car of copCars) {
      // Chase: steer toward the player, ram on contact.
      const dx = px - car.x, dz = pz - car.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
      const speed = dist > 25 ? WANTED.copCarSpeed : WANTED.copCarSpeed * 0.7;
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
      const bar = car.mesh.userData.lightbar;
      if (bar) {
        bar.userData.red.material.color.setHex(flashOn ? 0xff2233 : 0x550000);
        bar.userData.blue.material.color.setHex(flashOn ? 0x001155 : 0x2266ff);
      }
      // Ram: within 2.6 m of the player, deal damage over time.
      if (dist < 2.8) {
        damage += WANTED.ramDamagePerSecond * dt;
        if (onRam) onRam();
      }
    }
    for (const cop of footCops) {
      const dx = px - cop.x, dz = pz - cop.z;
      const dist = Math.hypot(dx, dz);
      cop.hitCooldown -= dt;
      if (dist > 0.5) {
        cop.x += (dx / dist) * WANTED.copFootSpeed * dt;
        cop.z += (dz / dist) * WANTED.copFootSpeed * dt;
      }
      const fixed = resolveCircle(cop.x, cop.z, 0.5, colliders);
      cop.x = fixed.x; cop.z = fixed.z;
      cop.mesh.position.set(cop.x, 1.0, cop.z);
      cop.mesh.rotation.y = Math.atan2(dx, dz);
      if (dist < 1.2 && cop.hitCooldown <= 0) {
        damage += WANTED.touchDamage;
        cop.hitCooldown = 1.0;
      }
    }
    // Trim the fleet when wanted falls.
    const wantCars = wanted >= 1 ? Math.min(wanted, 3) : 0;
    const wantFoot = wanted >= 2 ? Math.min(wanted - 1, 4) : 0;
    while (copCars.length > wantCars) {
      const car = copCars.pop();
      group.remove(car.mesh);
    }
    while (footCops.length > wantFoot) {
      const cop = footCops.pop();
      group.remove(cop.mesh);
    }
    return damage;
  }

  function nearestCopDistance(px, pz) {
    let best = Infinity;
    for (const car of copCars) best = Math.min(best, Math.hypot(car.x - px, car.z - pz));
    for (const cop of footCops) best = Math.min(best, Math.hypot(cop.x - px, cop.z - pz));
    return best;
  }

  return {
    get wanted() { return wanted; },
    copCars, footCops,
    setWanted, addWanted, update, nearestCopDistance,
  };
}

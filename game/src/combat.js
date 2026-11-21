// Hitscan shooting: click fires a ray from the camera through the crosshair. Hitting a
// cop or a pedestrian is a crime (wanted +1). A tracer line and a muzzle flash sell it.
import * as THREE from 'three';

export function createCombat(scene, camera) {
  const raycaster = new THREE.Raycaster();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  let tracer = null;
  let tracerLife = 0;
  let cooldown = 0;
  const flash = new THREE.PointLight(0xffc860, 0, 14);
  scene.add(flash);

  function shoot(origin, targetPoint, hittables, onHit) {
    if (cooldown > 0) return false;
    cooldown = 0.25;
    const dir = new THREE.Vector3().subVectors(targetPoint, origin).normalize();
    raycaster.set(origin, dir);
    raycaster.far = 120;
    const hits = raycaster.intersectObjects(hittables, true);
    let end = targetPoint.clone();
    if (hits.length > 0) {
      end = hits[0].point.clone();
      if (onHit) onHit(hits[0]);
    }
    // Tracer from the camera to the impact point.
    if (tracer) scene.remove(tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([origin.clone(), end]);
    tracer = new THREE.Line(geo, tracerMat);
    scene.add(tracer);
    tracerLife = 0.09;
    flash.position.copy(origin);
    flash.intensity = 60;
    return true;
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (tracerLife > 0) {
      tracerLife -= dt;
      if (tracerLife <= 0 && tracer) {
        scene.remove(tracer);
        tracer.geometry.dispose();
        tracer = null;
      }
    }
    flash.intensity = Math.max(0, flash.intensity - dt * 600);
  }

  // Where the crosshair points: a ray from the camera centre, 60 m out.
  function aimPoint() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return camera.position.clone().add(dir.multiplyScalar(60));
  }

  return { shoot, update, aimPoint };
}

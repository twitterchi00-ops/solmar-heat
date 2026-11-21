// three.js renderer: dusk sky, fog, sun disc, lights, and the chase camera.
// Everything here is deterministic except the camera smoothing, which is visual only.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 90, 320);

  const hemi = new THREE.HemisphereLight(0x8a7bd8, 0x1a1410, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a5c, 1.4);
  sun.position.set(-80, 60, -120);
  scene.add(sun);

  // Sunset disc low on the western horizon + a dim moon.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(18, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sunDisc.position.set(-140, 26, -260);
  sunDisc.lookAt(0, 26, 0);
  scene.add(sunDisc);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 8, 14);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Chase camera: behind the focus point, smoothed. yaw is the camera orbit angle.
  const camState = { yaw: 0, pitch: 0.32, dist: 10, height: 4 };
  function chase(focus, heading, inCar, dt) {
    const dist = inCar ? 11 : 7.5;
    const height = inCar ? 4.6 : 3.6;
    camState.dist += (dist - camState.dist) * Math.min(1, dt * 3);
    camState.height += (height - camState.height) * Math.min(1, dt * 3);
    const a = camState.yaw;
    const tx = focus.x - Math.sin(a) * camState.dist;
    const tz = focus.z - Math.cos(a) * camState.dist;
    const k = 1 - Math.exp(-dt * 7);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (camState.height - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    camera.lookAt(focus.x + Math.sin(a) * 4, 1.6, focus.z + Math.cos(a) * 4);
  }

  // Fixed cinematic camera for the title screen: slow orbit over the plaza.
  function orbit(time) {
    const a = time * 0.05;
    camera.position.set(Math.sin(a) * 90, 42, Math.cos(a) * 90);
    camera.lookAt(0, 4, 0);
  }

  return {
    renderer, scene, camera, camState,
    chase, orbit,
    draw() { renderer.render(scene, camera); },
  };
}

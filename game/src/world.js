// SOLMAR HEAT — the city. A 6x6 grid of blocks on a 50 m pitch, drawn on one procedural
// ground texture (roads, dashes, crosswalks, sidewalks, beach, ocean) with box buildings on
// top. Three blocks are special and get NO buildings: the plaza, the park, and the safehouse
// lot. THE SAFEHOUSE FIX: the safehouse block (-125, 125) is an open paved lot — it is in
// isSpecial, so no building and no collider is ever placed there, and the player can stand
// at (-125, 125) itself (mission radius 7 m, heal radius 8 m). Before this fix the nearest
// reachable point was 14 m away and mission 2 was impossible.
import * as THREE from 'three';
import { BLOCK_CENTRES, CITY, PALETTE, PARK, PLAZA, SAFEHOUSE } from './config.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// Window texture for a building facade: dark glass with a seeded scatter of lit windows.
function windowTexture(random, base) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const cols = 6, rows = 12;
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = random.chance(0.42);
        g.fillStyle = lit ? '#ffd166' : '#141a28';
        g.globalAlpha = lit ? 0.9 : 1;
        g.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
      }
    }
    g.globalAlpha = 1;
  });
}

function neonSignTexture(random, text, color) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#0b0b14';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = color;
    g.font = 'bold 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
  });
}

export function isSpecialBlock(bx, bz) {
  return (bx === SAFEHOUSE.x && bz === SAFEHOUSE.z)
    || (bx === PLAZA.x && bz === PLAZA.z)
    || (bx === PARK.x && bz === PARK.z);
}

export function blockAt(x, z) {
  const bx = BLOCK_CENTRES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const bz = BLOCK_CENTRES.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
  return { bx, bz };
}

// Push a circle (x, z, r) out of every building AABB it overlaps. Returns corrected x/z.
export function resolveCircle(x, z, r, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      z = nz + (dz / d) * r;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const pl = x - (c.minX - r), pr = (c.maxX + r) - x;
      const pt = z - (c.minZ - r), pb = (c.maxZ + r) - z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = c.minX - r;
      else if (m === pr) x = c.maxX + r;
      else if (m === pt) z = c.minZ - r;
      else z = c.maxZ + r;
    }
  }
  return { x, z };
}

export function createWorld(random) {
  const group = new THREE.Group();
  const colliders = [];

  // ---- Ground: one 1024 canvas, city -180..180 mapped to the canvas. ----
  const S = 1024, HALF = 180;
  const cx = (x) => ((x + HALF) / (2 * HALF)) * S;
  const cy = (z) => ((z + HALF) / (2 * HALF)) * S;
  const groundTex = canvasTexture(S, S, (g) => {
    g.fillStyle = '#23262e'; // asphalt base
    g.fillRect(0, 0, S, S);
    // Ocean (south edge) and sand.
    g.fillStyle = '#0e4d6e';
    g.fillRect(0, cy(CITY.oceanZ), S, S - cy(CITY.oceanZ));
    g.fillStyle = '#c2a878';
    g.fillRect(0, cy(CITY.beachZ), S, cy(CITY.oceanZ) - cy(CITY.beachZ));
    // Sidewalk pads for every block.
    for (const bx of BLOCK_CENTRES) {
      for (const bz of BLOCK_CENTRES) {
        g.fillStyle = '#3a3f4a';
        g.fillRect(cx(bx - 20), cy(bz - 20), cx(bx + 20) - cx(bx - 20), cy(bz + 20) - cy(bz - 20));
      }
    }
    // Plaza: warm stone circle. Park: green. Safehouse lot: paved with a painted ring.
    g.fillStyle = '#6b5a44';
    g.beginPath(); g.arc(cx(PLAZA.x), cy(PLAZA.z), 16 * (S / 360), 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2d5a3a';
    g.fillRect(cx(PARK.x - 20), cy(PARK.z - 20), 40 * (S / 360), 40 * (S / 360));
    g.fillStyle = '#4a4f5a';
    g.fillRect(cx(SAFEHOUSE.x - 20), cy(SAFEHOUSE.z - 20), 40 * (S / 360), 40 * (S / 360));
    g.strokeStyle = '#39d98a'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx(SAFEHOUSE.x), cy(SAFEHOUSE.z), 8 * (S / 360), 0, Math.PI * 2); g.stroke();
    // Lane dashes along every road centreline.
    g.fillStyle = '#d8c56a';
    for (const c of [-150, -100, -50, 0, 50, 100, 150]) {
      for (let t = -175; t < 175; t += 12) {
        g.fillRect(cx(c) - 1, cy(t), 2, 6 * (S / 360));
        g.fillRect(cx(t), cy(c) - 1, 6 * (S / 360), 2);
      }
    }
    // Crosswalks at the four central intersections.
    g.fillStyle = 'rgba(238,241,245,0.75)';
    for (const ix of [-50, 0, 50]) {
      for (const iz of [-50, 0, 50]) {
        for (let k = -2; k <= 2; k++) {
          g.fillRect(cx(ix + k * 2.4) - 2, cy(iz - 5), 4, 10 * (S / 360));
        }
      }
    }
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 360),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // Ocean plane beyond the sand (animated by the render loop's time uniform — static here).
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 70),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.1, CITY.oceanZ + 32);
  group.add(ocean);

  // ---- Buildings: 1-4 per normal block, window-textured, neon trim on some. ----
  const wallTexes = [
    windowTexture(random, '#4a4f5e'),
    windowTexture(random, '#5e4a6b'),
    windowTexture(random, '#3d5a6b'),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x22242c });
  const neonMats = PALETTE.neon.map(
    (c) => new THREE.MeshBasicMaterial({ color: c }),
  );
  const signs = ['SOLMAR', 'HEAT', 'PIER 9', '24H TACOS', 'VICE', 'NEON'];
  let signIdx = 0;

  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      if (isSpecialBlock(bx, bz)) continue;
      for (const ox of [-10, 10]) {
        for (const oz of [-10, 10]) {
          if (!random.chance(0.72)) continue;
          const w = random.range(11, 17);
          const d = random.range(11, 17);
          const h = random.range(8, 34);
          const px = bx + ox, pz = bz + oz;
          const wallMat = new THREE.MeshLambertMaterial({ map: random.pick(wallTexes) });
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat],
          );
          mesh.position.set(px, h / 2, pz);
          group.add(mesh);
          colliders.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2 });
          if (random.chance(0.4)) {
            const trim = new THREE.Mesh(
              new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3),
              random.pick(neonMats),
            );
            trim.position.set(px, h + 0.25, pz);
            group.add(trim);
          }
          if (random.chance(0.22)) {
            const text = signs[signIdx++ % signs.length];
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(12, 3),
              new THREE.MeshBasicMaterial({
                map: neonSignTexture(random, text, '#ff2d78'),
                transparent: true,
              }),
            );
            sign.position.set(px, Math.min(h * 0.7, 14), pz + d / 2 + 0.15);
            group.add(sign);
          }
        }
      }
    }
  }

  // ---- Safehouse lot dressing: small house, fence posts, heal ring. ----
  const house = new THREE.Mesh(
    new THREE.BoxGeometry(10, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a6b4a }),
  );
  house.position.set(SAFEHOUSE.x - 8, 2.5, SAFEHOUSE.z - 8);
  group.add(house);
  colliders.push({
    minX: SAFEHOUSE.x - 13, maxX: SAFEHOUSE.x - 3,
    minZ: SAFEHOUSE.z - 12, maxZ: SAFEHOUSE.z - 4,
  });
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, 3, 4),
    new THREE.MeshLambertMaterial({ color: 0x5a2d2d }),
  );
  roof.position.set(SAFEHOUSE.x - 8, 6.5, SAFEHOUSE.z - 8);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(SAFEHOUSE.healRadius - 0.4, SAFEHOUSE.healRadius, 48),
    new THREE.MeshBasicMaterial({ color: PALETTE.heal, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(SAFEHOUSE.x, 0.08, SAFEHOUSE.z);
  ring.name = 'healRing';
  group.add(ring);
  // Fence posts around the lot (visual only, no colliders — the lot must stay open).
  const postGeo = new THREE.BoxGeometry(0.3, 1.2, 0.3);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x6b6f7a });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(SAFEHOUSE.x + Math.cos(a) * 19, 0.6, SAFEHOUSE.z + Math.sin(a) * 19);
    group.add(post);
  }

  // ---- Plaza: fountain disc + benches. Park: trees. ----
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.5, 1, 24),
    new THREE.MeshLambertMaterial({ color: 0x3d6a8a }),
  );
  fountain.position.set(PLAZA.x, 0.5, PLAZA.z);
  group.add(fountain);
  colliders.push({ minX: PLAZA.x - 5, maxX: PLAZA.x + 5, minZ: PLAZA.z - 5, maxZ: PLAZA.z + 5 });

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2d });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2d7a3a });
  function tree(x, z, s = 1) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 3 * s, 6), trunkMat);
    trunk.position.y = 1.5 * s;
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 * s, 0), leafMat);
    leaves.position.y = 3.8 * s;
    t.add(trunk, leaves);
    t.position.set(x, 0, z);
    return t;
  }
  for (let i = 0; i < 8; i++) {
    group.add(tree(PARK.x + random.range(-16, 16), PARK.z + random.range(-16, 16), random.range(0.8, 1.4)));
  }
  // Palms along the beach.
  for (let i = 0; i < 10; i++) {
    const palm = tree(-160 + i * 36 + random.range(-6, 6), 168 + random.range(-2, 2), random.range(1.1, 1.6));
    group.add(palm);
  }

  // ---- Streetlights at intersections (emissive lamps, no real lights for perf). ----
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d34 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const ix of [-100, -50, 0, 50, 100]) {
    for (const iz of [-100, -50, 0, 50, 100]) {
      if (!random.chance(0.6)) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
      pole.position.set(ix + 5.5, 3, iz + 5.5);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp.position.set(ix + 5.5, 6.1, iz + 5.5);
      group.add(pole, lamp);
    }
  }

  return { group, colliders, isSpecial: isSpecialBlock };
}

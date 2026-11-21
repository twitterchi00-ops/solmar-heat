// SOLMAR HEAT — every tuning number and colour in one place.
// The city is a 6x6 grid of blocks. Block centres sit on a 50 m pitch; blocks are 40 m wide,
// so the roads between them are 10 m wide and their centrelines sit on the -150..150 grid.
export const STEP = 1 / 60;

export const CITY = {
  blocks: 6,
  pitch: 50,
  block: 40,
  road: 10,
  half: 175, // city extent: -175..175 on both axes
  beachZ: 165, // south of this is sand, then ocean
  oceanZ: 185,
};

// Block centres, in metres. Safehouse, plaza and park are special blocks (no buildings).
export const BLOCK_CENTRES = [-125, -75, -25, 25, 75, 125];
export const SAFEHOUSE = { x: -125, z: 125, missionRadius: 7, healRadius: 8, healRate: 20 };
export const PLAZA = { x: 25, z: 25 };
export const PARK = { x: -75, z: -75 };

export const PLAYER = {
  walkSpeed: 8.2,
  sprintSpeed: 11,
  radius: 0.6,
  height: 1.8,
  maxHp: 100,
};

export const CAR = {
  accel: 14,
  brake: 26,
  maxSpeed: 34,
  reverseSpeed: 10,
  steer: 1.9,
  grip: 6,
  radius: 1.6,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 22;

export const WANTED = {
  max: 5,
  decaySeconds: 12,
  copCarSpeed: 26,
  copFootSpeed: 4.6,
  ramDamagePerSecond: 8,
  touchDamage: 5,
};

export const MISSIONS = [
  {
    id: 0, title: 'JOYRIDE', reward: 200,
    text: 'Steal a car and drive to the pier marker.',
    stages: [
      { type: 'enterCar', text: 'Steal any car (press E near one)' },
      { type: 'reach', x: 140, z: 155, radius: 8, text: 'Drive to the pier' },
    ],
  },
  {
    id: 1, title: 'COURIER', reward: 350,
    text: 'Pick up the package up north, drop it at the marina.',
    stages: [
      { type: 'reach', x: 0, z: -150, radius: 8, text: 'Pick up the package (north gate)' },
      { type: 'reach', x: 150, z: 0, radius: 8, text: 'Deliver to the marina (east)' },
    ],
  },
  {
    id: 2, title: 'SAFEHOUSE STAND', reward: 800,
    text: 'Reach the safehouse and survive 20 seconds inside the heal ring.',
    stages: [
      { type: 'reach', x: SAFEHOUSE.x, z: SAFEHOUSE.z, radius: SAFEHOUSE.missionRadius, text: 'Reach the safehouse lot' },
      { type: 'survive', seconds: 20, wanted: 3, text: 'Survive 20s in the ring — keep moving!' },
    ],
  },
  {
    id: 3, title: 'GETAWAY', reward: 600,
    text: 'Wanted level 4. Reach the tunnel in 45 seconds — do not get busted.',
    stages: [
      { type: 'timedReach', x: -150, z: -150, radius: 8, seconds: 45, wanted: 4, text: 'Reach the tunnel (45s)' },
    ],
  },
  {
    id: 4, title: 'KING OF SOLMAR', reward: 1000,
    text: 'Wanted level 5. Survive 30 seconds, then reach the beach.',
    stages: [
      { type: 'survive', seconds: 30, wanted: 5, text: 'Survive 30s at 5 stars' },
      { type: 'reach', x: 0, z: 160, radius: 8, text: 'Reach the beach' },
    ],
  },
];

export const PALETTE = {
  sky: 0x2b1a4e,
  fog: 0x2b1a4e,
  sun: 0xff8c42,
  ground: 0x1c1f26,
  road: 0x23262e,
  sidewalk: 0x3a3f4a,
  sand: 0xc2a878,
  ocean: 0x0e4d6e,
  building: [0x4a4f5e, 0x5e4a6b, 0x3d5a6b, 0x6b4a3d, 0x44506b],
  windowLit: 0xffd166,
  windowDark: 0x1a2233,
  neon: [0xff2d78, 0x00e5ff, 0xffd166, 0x7c4dff],
  player: 0x4fc3f7,
  cop: 0x2266ff,
  copLight: 0xff2233,
  marker: 0xffd166,
  heal: 0x39d98a,
  text: '#eef1f5',
  muted: '#9aa3b2',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmar-heat.save.v1';
export const BEST_KEY = 'solmar-heat.best.v1';

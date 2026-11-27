import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import "./style.css";
import { buildBattlefieldTerrain, getTerrainHeight, getTerrainNormal } from "./terrain";
import { createDesertSkyTexture, createSoftGlowTexture } from "./textures";
import {
  buildAllyCar,
  buildAllyDrone,
  buildEnemyMech,
  buildEnergyCore,
  buildMissilePod,
  buildPlayerMech,
  type EnemyRig,
} from "./models";
import { IronwoodAudio } from "./audio";

// ── 1. Renderer, Scene, Smart Integrated-GPU Auto-Detection & Bloom Pipeline ─
const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});

// Detect integrated GPUs (e.g. Intel UHD 620) or <=8GB RAM so the game boots silky-smooth with zero hitching!
function detectIntegratedGPU(): boolean {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const gpuStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
    if (/intel|uhd|hd graphics|iris|swiftshader|llvmpipe|basic render/i.test(gpuStr)) return true;
    if (mem <= 8) return true;
  } catch {
    return true;
  }
  return false;
}

let ecoMode = detectIntegratedGPU();
const initDpr = ecoMode ? 1.0 : Math.min(window.devicePixelRatio, 1.5);
renderer.setPixelRatio(initDpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
// Dusty mauve-amber desert storm atmospheric fog (exact Ironwood mood!)
scene.fog = new THREE.FogExp2(0x7c6866, 0.0092);

const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.52;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.25, 320);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(initDpr);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2)),
  0.34,
  0.58,
  0.82
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const studioControls = new OrbitControls(camera, renderer.domElement);
studioControls.enableDamping = true;
studioControls.dampingFactor = 0.07;
studioControls.maxPolarAngle = Math.PI * 0.48;
studioControls.minDistance = 5;
studioControls.maxDistance = 42;
studioControls.enabled = false;

// Sky dome
const skyMat = new THREE.MeshBasicMaterial({ map: createDesertSkyTexture(), side: THREE.BackSide, fog: false });
scene.add(new THREE.Mesh(new THREE.SphereGeometry(230, 24, 16), skyMat));

// Low-angle warm desert key sun + cool lavender-slate overcast fill (long dramatic shadows like poster.jpg!)
const hemi = new THREE.HemisphereLight(0xa99ba6, 0x6e4a30, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffcb94, 3.1);
sun.position.set(-48, 28, -32);
sun.castShadow = true;
const initShadowRes = ecoMode ? 1024 : 2048;
sun.shadow.mapSize.set(initShadowRes, initShadowRes);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
const sc = sun.shadow.camera;
sc.near = 4;
sc.far = 160;
sc.left = -46;
sc.right = 46;
sc.top = 46;
sc.bottom = -46;
scene.add(sun, sun.target);

// ── 2. Battlefield Terrain, Mesas & Craters ──────────────────────────────────
const terrain = buildBattlefieldTerrain(scene);
const audio = new IronwoodAudio();
const glowTex = createSoftGlowTexture();

// ── 3. Weapon Styles (G / H / J / K / L) ─────────────────────────────────────
type WeaponDef = {
  id: string;
  name: string;
  cooldown: number;
  damage: number;
  speed: number;
  heat: number;
  color: number;
  dual: boolean;
  splash: number;
  spread: number;
  trauma: number;
  length: number;
};

const WEAPONS: WeaponDef[] = [
  { id: "G", name: "AEGIS", cooldown: 0.11, damage: 11, speed: 125, heat: 3.4, color: 0xffd27a, dual: false, splash: 0, spread: 0.018, trauma: 0.06, length: 2.2 },
  { id: "H", name: "BULWARK", cooldown: 0.24, damage: 24, speed: 115, heat: 5.2, color: 0xf59e0b, dual: false, splash: 0, spread: 0.012, trauma: 0.12, length: 2.8 },
  { id: "J", name: "TWIN FIRE", cooldown: 0.14, damage: 12, speed: 138, heat: 4.8, color: 0x7dd3fc, dual: true, splash: 0, spread: 0.022, trauma: 0.09, length: 2.5 },
  { id: "K", name: "HAMMERFALL", cooldown: 0.62, damage: 64, speed: 210, heat: 16.5, color: 0xfef08a, dual: false, splash: 2.4, spread: 0.004, trauma: 0.34, length: 7.5 },
  { id: "L", name: "QUAKE", cooldown: 0.78, damage: 52, speed: 78, heat: 18.0, color: 0xfb923c, dual: false, splash: 7.5, spread: 0.015, trauma: 0.38, length: 2.0 },
];

// ── 4. Player Rig & Battlefield State ────────────────────────────────────────
const playerRig = buildPlayerMech();
scene.add(playerRig.root);

const player = {
  x: 0,
  z: 12,
  vx: 0,
  vz: 0,
  yaw: 0, // 0 = facing -Z (north toward dunes!)
  camYaw: 0,
  camPitch: 0.42, // Iconic elevated Ironwood tactical view over the desert dunes!
  camZoom: 16.5,
  morph: 0, // 0 = mech, 1 = car
  targetMorph: 0,
  siege: 0,
  stance: "strider" as "strider" | "siege" | "car",
  weaponSlot: 0,
  hull: 140,
  maxHull: 140,
  plate: 100,
  maxPlate: 100,
  heat: 0,
  overheated: false,
  cells: 6,
  maxCells: 8,
  cellRegen: 0,
  fireCd: 0,
  missileCd: 0,
  squadCd: 0,
  podCd: 0,
  dashTimer: 0,
  dashDirX: 0,
  dashDirZ: 0,
  walkCycle: 0,
  barrelSide: 0 as 0 | 1,
  recoilL: 0,
  recoilR: 0,
  shots: 0,
  kills: 0,
  score: 0,
  cores: 0,
  coresNeeded: 4,
  tier: 1,
  wave: 1,
  upRail: 1,
  upPods: 1,
  upPlate: 1,
  trauma: 0,
  shakeMult: 1.0,
  hitStop: 0,
  studioMode: false,
  freezeEnemies: false,
  paused: false,
};

// ── 5. Entities: Enemies, Allies, Pods, Cores, Projectiles, Particles, Debris ─
type Enemy = {
  id: number;
  rig: EnemyRig;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  heavy: boolean;
  fireCd: number;
  walkCycle: number;
  strafeDir: number;
  hitFlash: number;
  hpEl: HTMLDivElement;
  fillEl: HTMLDivElement;
};

type AllyCar = {
  rig: ReturnType<typeof buildAllyCar>;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  fireCd: number;
  orbitAngle: number;
  life: number;
};

type AllyDrone = {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  orbitAngle: number;
  fireCd: number;
  life: number;
};

type MissilePod = {
  rig: ReturnType<typeof buildMissilePod>;
  x: number;
  z: number;
  fireCd: number;
  life: number;
};

type EnergyCore = {
  rig: ReturnType<typeof buildEnergyCore>;
  x: number;
  z: number;
  bob: number;
};

type Projectile = {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  splash: number;
  friendly: boolean;
  homingTarget: Enemy | null;
  isMissile: boolean;
  gravity: number;
  life: number;
};

type Particle = {
  sprite: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
};

type DebrisChunk = {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  life: number;
};

const enemies: Enemy[] = [];
const allyCars: AllyCar[] = [];
const allyDrones: AllyDrone[] = [];
const missilePods: MissilePod[] = [];
const energyCores: EnergyCore[] = [];
const projectiles: Projectile[] = [];
const particles: Particle[] = [];
const debris: DebrisChunk[] = [];

let nextEnemyId = 1;
let lockedEnemyId: number | null = null;

// ── 6. Zero-GC Pre-Allocated VFX, Projectile & Debris Pools (NO mid-fight GC or shader stalls!) ──
const tracerGeo = new THREE.BoxGeometry(0.16, 0.16, 1.0);
const missileGeo = new THREE.CylinderGeometry(0.1, 0.14, 1.15, 6);
missileGeo.rotateX(Math.PI / 2);
const debrisGeo = new THREE.DodecahedronGeometry(0.32, 0);
const debrisMat = new THREE.MeshStandardMaterial({ color: 0x201d22, roughness: 0.65, metalness: 0.7 });

// Cached projectile materials by color hex (never allocated/disposed per shot!)
const projMatCache = new Map<number, THREE.MeshBasicMaterial>();
function getProjMat(hex: number) {
  let m = projMatCache.get(hex);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: hex });
    projMatCache.set(hex, m);
  }
  return m;
}
// Pre-warm all projectile colors
for (const c of [0xffd27a, 0xf59e0b, 0x7dd3fc, 0xfef08a, 0xfb923c, 0xffb347, 0xff4040, 0x4ade80, 0x86efac]) {
  getProjMat(c);
}

// Pre-allocated Particle Pools (90 additive sparks/flashes + 32 normal dust puffs = 0 runtime allocations!)
const addSpritePool: THREE.Sprite[] = [];
const normSpritePool: THREE.Sprite[] = [];
for (let i = 0; i < 90; i++) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  s.visible = false;
  scene.add(s);
  addSpritePool.push(s);
}
for (let i = 0; i < 32; i++) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xa68462,
      transparent: true,
      opacity: 0.85,
      blending: THREE.NormalBlending,
      depthWrite: false,
    })
  );
  s.visible = false;
  scene.add(s);
  normSpritePool.push(s);
}

// Pre-allocated Projectile Mesh Pools (64 tracers + 24 missiles)
const tracerPool: THREE.Mesh[] = [];
const missilePool: THREE.Mesh[] = [];
for (let i = 0; i < 64; i++) {
  const m = new THREE.Mesh(tracerGeo, getProjMat(0xffd27a));
  m.visible = false;
  scene.add(m);
  tracerPool.push(m);
}
for (let i = 0; i < 24; i++) {
  const m = new THREE.Mesh(missileGeo, getProjMat(0xffb347));
  m.visible = false;
  scene.add(m);
  missilePool.push(m);
}

// Pre-allocated Debris Chunk Pool (32 chunks, no shadow-casting overhead on tiny bits!)
const debrisPool: THREE.Mesh[] = [];
for (let i = 0; i < 32; i++) {
  const m = new THREE.Mesh(debrisGeo, debrisMat);
  m.visible = false;
  scene.add(m);
  debrisPool.push(m);
}

function releaseParticle(pt: Particle) {
  pt.sprite.visible = false;
  if (pt.sprite.material.blending === THREE.AdditiveBlending) addSpritePool.push(pt.sprite);
  else normSpritePool.push(pt.sprite);
}

function releaseProjectile(pr: Projectile) {
  pr.mesh.visible = false;
  if (pr.isMissile) missilePool.push(pr.mesh);
  else tracerPool.push(pr.mesh);
}

function releaseDebris(db: DebrisChunk) {
  db.mesh.visible = false;
  debrisPool.push(db.mesh);
}

function spawnParticle(
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  colorHex: number,
  startScale: number,
  endScale: number,
  life: number,
  gravity = 0,
  additive = true
) {
  const pool = additive ? addSpritePool : normSpritePool;
  let sprite = pool.pop();
  if (!sprite) {
    // Recycle oldest active particle of matching blending type
    const idx = particles.findIndex(
      (pt) => (pt.sprite.material.blending === THREE.AdditiveBlending) === additive
    );
    if (idx === -1) return;
    sprite = particles.splice(idx, 1)[0].sprite;
  }
  sprite.material.color.setHex(colorHex);
  sprite.material.opacity = 0.92;
  sprite.position.set(x, y, z);
  sprite.scale.set(startScale, startScale, 1);
  sprite.visible = true;
  particles.push({ sprite, vx, vy, vz, gravity, life, maxLife: life, startScale, endScale });
}

function spawnSparkBurst(x: number, y: number, z: number, count: number, colorHex = 0xffcf70, speed = 12) {
  const n = ecoMode ? Math.max(3, Math.ceil(count * 0.6)) : count;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.4 + Math.random() * 0.9);
    spawnParticle(
      x,
      y,
      z,
      Math.cos(a) * sp,
      2 + Math.random() * sp * 0.75,
      Math.sin(a) * sp,
      colorHex,
      0.55,
      0.12,
      0.28 + Math.random() * 0.35,
      -18,
      true
    );
  }
}

function spawnExplosion(x: number, y: number, z: number, big = false) {
  audio.playExplosion(big);
  terrain.spawnCrater(x, z, big ? 4.4 : 2.6);
  player.trauma = Math.min(1, player.trauma + (big ? 0.52 : 0.22));

  // Core fireball flash
  spawnParticle(x, y + 0.8, z, 0, 1.5, 0, 0xffe49e, big ? 4.5 : 2.4, big ? 9.5 : 5.2, 0.32, 0, true);
  spawnParticle(x, y + 0.6, z, 0, 2.2, 0, 0xff6b2b, big ? 3.2 : 1.8, big ? 7.8 : 4.2, 0.48, 0, true);

  // Dusty desert shockwave plume
  const dustCount = big ? 6 : 3;
  for (let i = 0; i < dustCount; i++) {
    const a = (i / dustCount) * Math.PI * 2 + Math.random() * 0.5;
    spawnParticle(
      x + Math.cos(a) * 1.2,
      y + 0.5,
      z + Math.sin(a) * 1.2,
      Math.cos(a) * (big ? 5.5 : 3.2),
      2.2 + Math.random() * 2.5,
      Math.sin(a) * (big ? 5.5 : 3.2),
      0x8c7056,
      big ? 2.4 : 1.5,
      big ? 7.2 : 4.2,
      0.95 + Math.random() * 0.4,
      -1.2,
      false
    );
  }

  spawnSparkBurst(x, y + 0.9, z, big ? 16 : 8, 0xffc864, big ? 18 : 11);

  // Flying charred metal debris chunks from pre-allocated pool!
  const chunks = big ? 8 : 3;
  for (let i = 0; i < chunks; i++) {
    let m = debrisPool.pop();
    if (!m) {
      if (debris.length === 0) break;
      m = debris.shift()!.mesh;
    }
    m.position.set(x, y + 1.0, z);
    m.scale.set(0.6 + Math.random() * 1.1, 0.5 + Math.random() * 0.9, 0.7 + Math.random() * 1.1);
    m.visible = true;
    const a = Math.random() * Math.PI * 2;
    const sp = (big ? 12 : 7) * (0.4 + Math.random() * 0.8);
    debris.push({
      mesh: m,
      vx: Math.cos(a) * sp,
      vy: 6 + Math.random() * (big ? 11 : 6),
      vz: Math.sin(a) * sp,
      rx: (Math.random() - 0.5) * 9,
      ry: (Math.random() - 0.5) * 9,
      life: 4.5 + Math.random() * 2.0,
    });
  }
}

function spawnProjectile(opts: {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  speed: number;
  damage: number;
  color: number;
  friendly: boolean;
  splash?: number;
  length?: number;
  isMissile?: boolean;
  homingTarget?: Enemy | null;
  gravity?: number;
}) {
  const isMissile = opts.isMissile ?? false;
  const pool = isMissile ? missilePool : tracerPool;
  let mesh = pool.pop();
  if (!mesh) {
    const idx = projectiles.findIndex((pr) => pr.isMissile === isMissile);
    if (idx === -1) return;
    mesh = projectiles.splice(idx, 1)[0].mesh;
  }
  mesh.material = getProjMat(opts.color);
  if (!isMissile) mesh.scale.set(1, 1, opts.length ?? 2.4);
  else mesh.scale.set(1, 1, 1);
  mesh.position.set(opts.x, opts.y, opts.z);
  mesh.lookAt(opts.x + opts.dirX, opts.y + opts.dirY, opts.z + opts.dirZ);
  mesh.visible = true;

  projectiles.push({
    mesh,
    x: opts.x,
    y: opts.y,
    z: opts.z,
    vx: opts.dirX * opts.speed,
    vy: opts.dirY * opts.speed,
    vz: opts.dirZ * opts.speed,
    damage: opts.damage,
    splash: opts.splash ?? 0,
    friendly: opts.friendly,
    homingTarget: opts.homingTarget ?? null,
    isMissile,
    gravity: opts.gravity ?? 0,
    life: isMissile ? 4.2 : 2.2,
  });
}

// ── 7. HUD Element References & Helpers ──────────────────────────────────────
const enemyBarsEl = document.getElementById("enemy-bars")!;
const reticleEl = document.getElementById("reticle")!;
const waveNumEl = document.getElementById("wave-num")!;
const waveSubEl = document.getElementById("wave-sub")!;
const calloutEl = document.getElementById("callout")!;
const plateFillEl = document.getElementById("plate-fill")!;
const plateValEl = document.getElementById("plate-val")!;
const heatFillEl = document.getElementById("heat-fill")!;
const heatValEl = document.getElementById("heat-val")!;
const cellsGridEl = document.getElementById("cells-grid")!;
const cellsValEl = document.getElementById("cells-val")!;
const hullFillEl = document.getElementById("hull-fill")!;
const hullValEl = document.getElementById("hull-val")!;
const shotsValEl = document.getElementById("shots-val")!;
const tierNumEl = document.getElementById("tier-num")!;
const coresValEl = document.getElementById("cores-val")!;
const killsValEl = document.getElementById("kills-val")!;
const scoreValEl = document.getElementById("score-val")!;
const squadSubEl = document.getElementById("squad-sub")!;
const podSubEl = document.getElementById("pod-sub")!;
const btnSquad = document.getElementById("btn-squad")!;
const btnPod = document.getElementById("btn-pod")!;
const btnDrive = document.getElementById("btn-drive")!;
const btnStance = document.getElementById("btn-stance")!;
const btnStudio = document.getElementById("btn-studio")!;
const perfBadgeEl = document.getElementById("perf-badge")!;
const aimHintEl = document.getElementById("aim-hint")!;
const settingsModal = document.getElementById("settings-modal")!;

// Build cell pips & upgrade pips once
for (let i = 0; i < player.maxCells; i++) {
  const pip = document.createElement("div");
  pip.className = "cell-pip";
  cellsGridEl.appendChild(pip);
}
for (const id of ["up-rail", "up-pods", "up-plate"]) {
  const el = document.getElementById(id)!;
  for (let i = 0; i < 5; i++) {
    const p = document.createElement("div");
    p.className = "up-pip";
    el.appendChild(p);
  }
}

let calloutTimer = 0;
function showCallout(msg: string) {
  calloutEl.textContent = msg;
  calloutEl.classList.add("show");
  window.clearTimeout(calloutTimer);
  calloutTimer = window.setTimeout(() => calloutEl.classList.remove("show"), 2300);
}

// ── 8. Spawners: Waves, Energy Cores, Support Squad & Missile Pod ────────────
const WAVE_TITLES = ["Skirmish line", "Dune vanguard", "Crimson flank", "Iron legion", "Siege breaker"];

function spawnCore(x: number, z: number) {
  if (energyCores.length >= 6) {
    const old = energyCores.shift()!;
    scene.remove(old.rig.group);
  }
  const rig = buildEnergyCore();
  rig.group.position.set(x, getTerrainHeight(x, z), z);
  scene.add(rig.group);
  energyCores.push({ rig, x, z, bob: Math.random() * Math.PI * 2 });
}

function spawnWave(waveNum: number) {
  const count = Math.min(9, 4 + waveNum);
  for (let i = 0; i < count; i++) {
    const heavy = waveNum >= 2 && i % 3 === 0;
    const rig = buildEnemyMech(heavy);
    // Fan out along the distant northern dunes (just like poster.jpg!)
    const spreadAng = ((i / Math.max(1, count - 1)) - 0.5) * 1.35;
    const dist = 46 + Math.random() * 24;
    const ex = Math.sin(spreadAng) * dist;
    const ez = -Math.cos(spreadAng) * dist + 10;
    const ey = getTerrainHeight(ex, ez);
    rig.group.position.set(ex, ey, ez);
    scene.add(rig.group);

    const hpEl = document.createElement("div");
    hpEl.className = "enemy-hp";
    const fillEl = document.createElement("div");
    fillEl.className = "fill";
    hpEl.appendChild(fillEl);
    enemyBarsEl.appendChild(hpEl);

    const maxHp = (heavy ? 115 : 68) + (waveNum - 1) * 16;
    enemies.push({
      id: nextEnemyId++,
      rig,
      x: ex,
      z: ez,
      yaw: Math.PI,
      hp: maxHp,
      maxHp,
      heavy,
      fireCd: 1.4 + Math.random() * 1.8,
      walkCycle: Math.random() * 6,
      strafeDir: i % 2 === 0 ? 1 : -1,
      hitFlash: 0,
      hpEl,
      fillEl,
    });
  }
  if (enemies.length > 0) lockedEnemyId = enemies[Math.floor(enemies.length / 2)].id;
  const label = WAVE_TITLES[(waveNum - 1) % WAVE_TITLES.length];
  waveNumEl.textContent = String(waveNum);
  waveSubEl.textContent = `${label} · ${enemies.length} on the field`;
  showCallout(`WAVE ${waveNum} // ${label.toUpperCase()}`);
}

function spawnAllyCarAt(x: number, z: number, life = 38) {
  const rig = buildAllyCar();
  rig.group.position.set(x, getTerrainHeight(x, z), z);
  scene.add(rig.group);
  allyCars.push({
    rig,
    x,
    z,
    yaw: 0,
    speed: 0,
    fireCd: 0.6 + Math.random() * 0.5,
    orbitAngle: Math.random() * Math.PI * 2,
    life,
  });
}

function deploySupportSquad() {
  if (player.squadCd > 0) return;
  audio.unlock();
  audio.playDeploy();
  player.squadCd = Math.max(18, 30 - player.upPods * 2.5);

  // Deploy 3 allied 6-wheel cars + 2 hover combat drones!
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + player.yaw;
    const cx = player.x + Math.cos(ang) * 9;
    const cz = player.z + Math.sin(ang) * 9;
    spawnAllyCarAt(cx, cz, 34);
    spawnSparkBurst(cx, getTerrainHeight(cx, cz) + 0.8, cz, 8, 0x4ade80, 9);
  }
  for (let i = 0; i < 2; i++) {
    const mesh = buildAllyDrone();
    const dx = player.x + (i === 0 ? -5.5 : 5.5);
    const dz = player.z - 2;
    const dy = getTerrainHeight(dx, dz) + 6.5;
    mesh.position.set(dx, dy, dz);
    scene.add(mesh);
    allyDrones.push({ mesh, x: dx, y: dy, z: dz, orbitAngle: i * Math.PI, fireCd: 0.4, life: 30 });
  }
  showCallout("SUPPORT SQUAD DEPLOYED · 2 DRONES + 3 CARS");
}

function deployMissilePod() {
  if (player.podCd > 0) return;
  audio.unlock();
  audio.playDeploy();
  player.podCd = Math.max(16, 26 - player.upPods * 2);

  const px = player.x + Math.cos(player.yaw) * 4.5;
  const pz = player.z - Math.sin(player.yaw) * 4.5;
  const rig = buildMissilePod();
  rig.group.position.set(px, getTerrainHeight(px, pz), pz);
  scene.add(rig.group);
  missilePods.push({ rig, x: px, z: pz, fireCd: 0.6, life: 20 });
  spawnSparkBurst(px, getTerrainHeight(px, pz) + 0.6, pz, 12, 0xffb94a, 10);
  showCallout("MISSILE POD ONLINE · 20S DEPLOYMENT");
}

function resetBattlefield() {
  // Clear all dynamic entities
  for (const e of enemies) {
    scene.remove(e.rig.group);
    e.hpEl.remove();
  }
  enemies.length = 0;
  for (const c of allyCars) scene.remove(c.rig.group);
  allyCars.length = 0;
  for (const d of allyDrones) scene.remove(d.mesh);
  allyDrones.length = 0;
  for (const p of missilePods) scene.remove(p.rig.group);
  missilePods.length = 0;
  for (const co of energyCores) scene.remove(co.rig.group);
  energyCores.length = 0;
  for (const pr of projectiles) releaseProjectile(pr);
  projectiles.length = 0;
  for (const pt of particles) releaseParticle(pt);
  particles.length = 0;
  for (const db of debris) releaseDebris(db);
  debris.length = 0;
  terrain.clearCraters();
  terrain.spawnCrater(1.5, -12, 3.6);
  terrain.spawnCrater(-9, -24, 2.8);

  Object.assign(player, {
    x: 0,
    z: 12,
    vx: 0,
    vz: 0,
    yaw: 0,
    camYaw: 0,
    camPitch: 0.42,
    camZoom: 16.5,
    morph: 0,
    targetMorph: 0,
    siege: 0,
    stance: "strider",
    weaponSlot: 0,
    hull: 140,
    maxHull: 140,
    plate: 100,
    maxPlate: 100,
    heat: 0,
    overheated: false,
    cells: 6,
    fireCd: 0,
    missileCd: 0,
    squadCd: 0,
    podCd: 0,
    dashTimer: 0,
    shots: 0,
    kills: 0,
    score: 0,
    cores: 0,
    coresNeeded: 4,
    tier: 1,
    wave: 1,
    upRail: 1,
    upPods: 1,
    upPlate: 1,
    trauma: 0,
    hitStop: 0,
  });

  // Iconic opening scene: 1 wingman 6-wheel green-core car right beside you + 1 green Core on the left flank!
  spawnAllyCarAt(7.2, 10.4, 999);
  spawnCore(-11.5, 11.2);
  spawnWave(1);
  updateWeaponSlotsUI();
  updateStanceButtonsUI();
}

// ── 9. Input Handling & Actions ──────────────────────────────────────────────
const keys = new Set<string>();
let firing = false;
let bracing = false;
let pointerLocked = false;

function selectWeapon(slot: number) {
  player.weaponSlot = Math.max(0, Math.min(WEAPONS.length - 1, slot));
  updateWeaponSlotsUI();
  showCallout(`WEAPON // ${WEAPONS[player.weaponSlot].name}`);
}

function updateWeaponSlotsUI() {
  document.querySelectorAll<HTMLButtonElement>(".loadout-slot").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.slot) === player.weaponSlot);
  });
}

function updateStanceButtonsUI() {
  btnDrive.classList.toggle("active", player.stance === "car");
  btnStance.classList.toggle("active", player.stance === "siege");
  btnStance.innerHTML = player.stance === "siege" ? "Siege · <kbd>X</kbd>" : "Strider · <kbd>Z</kbd>";
  btnStudio.classList.toggle("active", player.studioMode);
}

function setStance(next: "strider" | "siege" | "car") {
  audio.unlock();
  if (next === "car" && player.stance === "car") next = "strider";
  const wasCar = player.stance === "car";
  player.stance = next;
  player.targetMorph = next === "car" ? 1 : 0;
  if ((next === "car") !== wasCar) {
    audio.playTransform(next === "car");
    spawnSparkBurst(player.x, getTerrainHeight(player.x, player.z) + 1.4, player.z, 12, next === "car" ? 0x4ade80 : 0xffc864, 10);
    showCallout(next === "car" ? "TRANSFORM // 6x6 COMBAT CAR" : "TRANSFORM // HEAVY WAR MECH");
  } else {
    showCallout(next === "siege" ? "STANCE // SIEGE MODE (+45% FIREPOWER)" : "STANCE // STRIDER MODE");
  }
  updateStanceButtonsUI();
}

function cycleTarget() {
  if (enemies.length === 0) return;
  const idx = enemies.findIndex((e) => e.id === lockedEnemyId);
  const next = enemies[(idx + 1) % enemies.length];
  lockedEnemyId = next.id;
  audio.playHit(false);
}

function fireHomingSalvo() {
  if (player.missileCd > 0 || player.cells < 2) {
    if (player.cells < 2) showCallout("LOW CELLS · RECHARGING");
    return;
  }
  audio.unlock();
  audio.playMissile();
  player.cells -= 2;
  player.missileCd = 1.6;
  player.trauma = Math.min(1, player.trauma + 0.22);

  const target = getLockedEnemy() ?? enemies[0] ?? null;
  const salvoCount = 2 + Math.min(3, player.upPods);
  const baseY = getTerrainHeight(player.x, player.z) + (player.morph > 0.5 ? 1.8 : 4.2);

  for (let i = 0; i < salvoCount; i++) {
    const spread = (i - (salvoCount - 1) / 2) * 0.42;
    const launchYaw = player.camYaw + spread;
    spawnProjectile({
      x: player.x - Math.sin(launchYaw) * 1.2,
      y: baseY,
      z: player.z - Math.cos(launchYaw) * 1.2,
      dirX: -Math.sin(launchYaw) * 0.72,
      dirY: 0.68,
      dirZ: -Math.cos(launchYaw) * 0.72,
      speed: 44,
      damage: 42 + player.upPods * 8,
      color: 0xffb347,
      friendly: true,
      splash: 5.5,
      isMissile: true,
      homingTarget: target,
    });
  }
  showCallout(`MISSILE SALVO · ${salvoCount} ROCKETS AWAY`);
}

function triggerSideRoll(dirSign: -1 | 1) {
  if (player.dashTimer > 0 || player.cells < 1) return;
  audio.unlock();
  audio.playDash();
  player.cells -= 1;
  player.dashTimer = 0.28;
  // Right vector relative to camYaw (forward = (-sin, -cos), right = (cos, -sin))
  player.dashDirX = Math.cos(player.camYaw) * dirSign;
  player.dashDirZ = -Math.sin(player.camYaw) * dirSign;
  player.trauma = Math.min(1, player.trauma + 0.16);
  spawnSparkBurst(player.x, getTerrainHeight(player.x, player.z) + 1.0, player.z, 14, 0xff9a3c, 13);
}

function toggleSettings(force?: boolean) {
  const open = force ?? settingsModal.classList.contains("hidden");
  settingsModal.classList.toggle("hidden", !open);
  player.paused = open;
  if (open && document.pointerLockElement) document.exitPointerLock();
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "escape") {
    toggleSettings();
    return;
  }
  if (player.paused) return;
  keys.add(k);
  audio.unlock();

  if (!e.repeat) {
    if (k === "g") selectWeapon(0);
    else if (k === "h") selectWeapon(1);
    else if (k === "j") selectWeapon(2);
    else if (k === "k") selectWeapon(3);
    else if (k === "l") selectWeapon(4);
    else if (k === "t") setStance(player.stance === "car" ? "strider" : "car");
    else if (k === "x") setStance("siege");
    else if (k === "z") setStance("strider");
    else if (k === "q") cycleTarget();
    else if (k === "f") fireHomingSalvo();
    else if (k === "4") deploySupportSquad();
    else if (k === "5") deployMissilePod();
    else if (k === "p") {
      player.freezeEnemies = !player.freezeEnemies;
      syncSettingsUI();
      showCallout(player.freezeEnemies ? "ENEMIES FROZEN" : "ENEMIES RESUMED");
    } else if (k === "i") {
      player.studioMode = !player.studioMode;
      studioControls.enabled = player.studioMode;
      if (player.studioMode) {
        if (document.pointerLockElement) document.exitPointerLock();
        studioControls.target.set(player.x, getTerrainHeight(player.x, player.z) + 2.2, player.z);
        showCallout("STUDIO ORBIT CAMERA · DRAG TO INSPECT");
      }
      updateStanceButtonsUI();
    } else if (e.shiftKey && (k === "a" || k === "arrowleft")) {
      triggerSideRoll(-1);
    } else if (e.shiftKey && (k === "d" || k === "arrowright")) {
      triggerSideRoll(1);
    }
  }
});

window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

canvas.addEventListener("mousedown", (e) => {
  if (player.paused) return;
  audio.unlock();
  if (e.button === 0) {
    firing = true;
    if (!player.studioMode && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  } else if (e.button === 2) {
    bracing = true;
  }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) firing = false;
  if (e.button === 2) bracing = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  aimHintEl.classList.toggle("hidden", pointerLocked);
});

window.addEventListener("mousemove", (e) => {
  if (player.paused || player.studioMode) return;
  if (pointerLocked) {
    player.camYaw -= e.movementX * 0.0024;
    player.camPitch = THREE.MathUtils.clamp(player.camPitch + e.movementY * 0.002, -0.05, 0.72);
  }
});

window.addEventListener(
  "wheel",
  (e) => {
    if (player.studioMode) return;
    player.camZoom = THREE.MathUtils.clamp(player.camZoom + e.deltaY * 0.012, 8.5, 28);
  },
  { passive: true }
);

// Wire HUD buttons
document.querySelectorAll<HTMLButtonElement>(".loadout-slot").forEach((b) => {
  b.addEventListener("click", () => selectWeapon(Number(b.dataset.slot)));
});
btnSquad.addEventListener("click", deploySupportSquad);
btnPod.addEventListener("click", deployMissilePod);
btnDrive.addEventListener("click", () => setStance(player.stance === "car" ? "strider" : "car"));
btnStance.addEventListener("click", () => setStance(player.stance === "siege" ? "strider" : "siege"));
btnStudio.addEventListener("click", () => {
  player.studioMode = !player.studioMode;
  studioControls.enabled = player.studioMode;
  if (player.studioMode) {
    studioControls.target.set(player.x, getTerrainHeight(player.x, player.z) + 2.2, player.z);
  }
  updateStanceButtonsUI();
});
document.getElementById("btn-restart")!.addEventListener("click", resetBattlefield);
document.getElementById("btn-modal-restart")!.addEventListener("click", () => {
  resetBattlefield();
  toggleSettings(false);
});
document.getElementById("btn-pause")!.addEventListener("click", () => toggleSettings(true));
document.getElementById("btn-close-settings")!.addEventListener("click", () => toggleSettings(false));
document.getElementById("btn-resume")!.addEventListener("click", () => toggleSettings(false));
document.getElementById("btn-fs")!.addEventListener("click", () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});

// ── start.ng Integration: Pilot Profile, Score Sharing on X, Leaderboard Save & Touch ──
type StartNgPlayer = {
  id?: number;
  name?: string;
  account?: string;
  face?: string;
};
type StartNgReply = {
  user?: StartNgPlayer | null;
  guest?: StartNgPlayer | null;
};
type StartNgKit = {
  getPlayer?: () => Promise<StartNgReply | null>;
  onPlayerChange?: (fn: (reply: StartNgReply | null) => void) => void;
  signIn?: () => void;
  saveRun?: (stats: Record<string, number>) => Promise<{ ok?: boolean; result?: { best?: number; improved?: boolean; rank?: number } } | null>;
  share?: (opts: { score?: number }) => void;
};

const touchMove = { up: false, down: false, left: false, right: false };

function shareOnX() {
  const gameUrl = location.hostname.endsWith(".start.ng")
    ? `https://start.ng/games/${location.hostname.replace(/\.start\.ng$/, "")}`
    : location.href;
  const text = `I reached Wave ${player.wave} with ${player.score.toLocaleString()} pts (${player.kills} mechs destroyed) in IRONWOOD on start.ng! Can you beat my score?`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(gameUrl)}`;
  window.open(url, "_blank", "noopener");
}

document.getElementById("btn-share")!.addEventListener("click", shareOnX);
document.getElementById("btn-go-share")!.addEventListener("click", shareOnX);

const gameOverModal = document.getElementById("gameover-modal")!;
const goScoreEl = document.getElementById("go-score")!;
const goWaveEl = document.getElementById("go-wave")!;
const goKillsEl = document.getElementById("go-kills")!;
const goRankEl = document.getElementById("go-rank")!;

document.getElementById("btn-play-again")!.addEventListener("click", () => {
  gameOverModal.classList.add("hidden");
  player.paused = false;
  resetBattlefield();
});

const pilotFaceEl = document.getElementById("pilot-face") as HTMLImageElement;
const pilotNameEl = document.getElementById("pilot-name")!;
const pilotAccountEl = document.getElementById("pilot-account")!;
const pilotSigninBtn = document.getElementById("pilot-signin")!;

function renderPilotCard(reply: StartNgReply | null) {
  const active = reply?.user ?? reply?.guest;
  if (!active) return;
  if (active.face) {
    pilotFaceEl.src = active.face;
    pilotFaceEl.hidden = false;
  }
  pilotNameEl.textContent = active.name || "Guest Pilot";
  pilotAccountEl.textContent = reply?.user?.account ? `@${reply.user.account} · start.ng` : "Guest · start.ng";
  const skipSignIn = new URLSearchParams(location.search).has("guest");
  pilotSigninBtn.hidden = !!reply?.user || skipSignIn;
}

pilotSigninBtn.addEventListener("click", () => {
  const kit = (window as unknown as { startng?: StartNgKit }).startng;
  if (kit?.signIn) {
    kit.signIn();
  } else {
    location.href = `https://start.ng/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
  }
});

function initStartNg() {
  const kit = (window as unknown as { startng?: StartNgKit }).startng;
  if (!kit) return;
  kit.getPlayer?.().then(renderPilotCard).catch(() => {});
  kit.onPlayerChange?.(renderPilotCard);
}
window.addEventListener("load", initStartNg);
initStartNg();

// Mobile touch controls (D-pad + Fire/Car/Missile/Squad + swipe-to-aim)
document.querySelectorAll<HTMLButtonElement>("[data-m]").forEach((btn) => {
  const act = btn.dataset.m!;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    audio.unlock();
    if (act === "up" || act === "down" || act === "left" || act === "right") touchMove[act] = true;
    else if (act === "fire") firing = true;
    else if (act === "car") setStance(player.stance === "car" ? "strider" : "car");
    else if (act === "missile") fireHomingSalvo();
    else if (act === "squad") deploySupportSquad();
  });
  const release = () => {
    if (act === "up" || act === "down" || act === "left" || act === "right") touchMove[act] = false;
    else if (act === "fire") firing = false;
  };
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("pointerleave", release);
});

let touchAimId: number | null = null;
let touchLastX = 0;
let touchLastY = 0;
canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch" || player.paused || player.studioMode) return;
  touchAimId = e.pointerId;
  touchLastX = e.clientX;
  touchLastY = e.clientY;
});
window.addEventListener("pointermove", (e) => {
  if (touchAimId !== e.pointerId || player.paused || player.studioMode) return;
  const dx = e.clientX - touchLastX;
  const dy = e.clientY - touchLastY;
  touchLastX = e.clientX;
  touchLastY = e.clientY;
  player.camYaw -= dx * 0.0055;
  player.camPitch = THREE.MathUtils.clamp(player.camPitch + dy * 0.004, -0.05, 0.72);
});
window.addEventListener("pointerup", (e) => {
  if (touchAimId === e.pointerId) touchAimId = null;
});

const btnGfx = document.getElementById("btn-gfx")!;
const toggleQualityBtn = document.getElementById("toggle-quality")!;
const toggleAudioBtn = document.getElementById("toggle-audio")!;
const toggleFreezeBtn = document.getElementById("toggle-freeze")!;
const toggleShakeBtn = document.getElementById("toggle-shake")!;

function syncSettingsUI() {
  toggleQualityBtn.textContent = ecoMode ? "Eco (Fast GPU)" : "High PBR + Bloom";
  toggleQualityBtn.classList.toggle("active", !ecoMode);
  btnGfx.textContent = ecoMode ? "Eco GPU" : "Bloom PBR";
  btnGfx.classList.toggle("active", !ecoMode);
  toggleAudioBtn.textContent = audio.enabled ? "Sound On" : "Muted";
  toggleAudioBtn.classList.toggle("active", audio.enabled);
  toggleFreezeBtn.textContent = player.freezeEnemies ? "Frozen" : "Active AI";
  toggleFreezeBtn.classList.toggle("active", player.freezeEnemies);
  toggleShakeBtn.textContent = `${Math.round(player.shakeMult * 100)}%`;
  toggleShakeBtn.classList.toggle("active", player.shakeMult > 0);
}

function flipGraphicsPreset() {
  ecoMode = !ecoMode;
  const pr = ecoMode ? 1.0 : Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  sun.shadow.mapSize.set(ecoMode ? 1024 : 2048, ecoMode ? 1024 : 2048);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  syncSettingsUI();
  showCallout(ecoMode ? "ECO GPU · DIRECT RENDER + 1024 SHADOWS" : "HIGH PBR · BLOOM + 2048 SHADOWS");
}

toggleQualityBtn.addEventListener("click", flipGraphicsPreset);
btnGfx.addEventListener("click", flipGraphicsPreset);
toggleAudioBtn.addEventListener("click", () => {
  audio.setEnabled(!audio.enabled);
  syncSettingsUI();
});
toggleFreezeBtn.addEventListener("click", () => {
  player.freezeEnemies = !player.freezeEnemies;
  syncSettingsUI();
});
toggleShakeBtn.addEventListener("click", () => {
  player.shakeMult = player.shakeMult === 1 ? 0.35 : player.shakeMult > 0 ? 0 : 1;
  syncSettingsUI();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2));
});

// ── 10. Helpers: Target Lock, Damage & Solid Collision Push-Out ──────────────
function getLockedEnemy(): Enemy | null {
  if (lockedEnemyId === null) return null;
  return enemies.find((e) => e.id === lockedEnemyId) ?? null;
}

function pushOutOfMesas(x: number, z: number, radius: number): [number, number] {
  for (const m of terrain.mesas) {
    const dx = x - m.x;
    const dz = z - m.z;
    const minDist = m.radius + radius;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDist * minDist && dSq > 1e-6) {
      const d = Math.sqrt(dSq);
      x = m.x + (dx / d) * minDist;
      z = m.z + (dz / d) * minDist;
    }
  }
  const dist = Math.hypot(x, z);
  if (dist > terrain.arenaRadius) {
    x = (x / dist) * terrain.arenaRadius;
    z = (z / dist) * terrain.arenaRadius;
  }
  return [x, z];
}

function damageEnemy(e: Enemy, amount: number) {
  e.hp -= amount;
  e.hitFlash = 0.12;
  if (e.hp <= 0) {
    const ey = getTerrainHeight(e.x, e.z);
    spawnExplosion(e.x, ey, e.z, true);
    audio.playHit(true);
    player.kills += 1;
    player.score += e.heavy ? 250 : 140;
    spawnCore(e.x, e.z);

    scene.remove(e.rig.group);
    e.hpEl.remove();
    const idx = enemies.indexOf(e);
    if (idx !== -1) enemies.splice(idx, 1);

    if (lockedEnemyId === e.id) {
      lockedEnemyId = enemies[0]?.id ?? null;
    }

    if (enemies.length === 0) {
      player.wave += 1;
      player.hull = Math.min(player.maxHull, player.hull + 30);
      spawnWave(player.wave);
    } else {
      const label = WAVE_TITLES[(player.wave - 1) % WAVE_TITLES.length];
      waveSubEl.textContent = `${label} · ${enemies.length} on the field`;
    }
  } else {
    audio.playHit(false);
  }
}

function damagePlayer(amount: number) {
  const mitigated = bracing ? amount * 0.3 : amount;
  if (player.plate > 0) {
    const absorb = Math.min(player.plate, mitigated * 0.72);
    player.plate -= absorb;
    player.hull -= mitigated - absorb;
  } else {
    player.hull -= mitigated;
  }
  player.trauma = Math.min(1, player.trauma + 0.18);
  if (player.hull <= 0 && !player.paused) {
    player.hull = 0;
    player.paused = true;
    firing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    spawnExplosion(player.x, getTerrainHeight(player.x, player.z), player.z, true);

    const runStats = {
      score: Math.max(0, Math.round(player.score)),
      waves: Math.max(1, Math.round(player.wave)),
      kills: Math.max(0, Math.round(player.kills)),
    };
    goScoreEl.textContent = runStats.score.toLocaleString();
    goWaveEl.textContent = String(runStats.waves);
    goKillsEl.textContent = String(runStats.kills);
    goRankEl.textContent = "Saving run to start.ng leaderboard...";
    gameOverModal.classList.remove("hidden");

    const kit = (window as unknown as { startng?: StartNgKit }).startng;
    if (kit?.saveRun) {
      kit
        .saveRun(runStats)
        .then((res) => {
          if (res?.ok && res.result) {
            goRankEl.textContent = `Leaderboard Rank #${res.result.rank ?? "-"} · Best ${res.result.best ?? runStats.score}`;
          } else {
            goRankEl.textContent = "Sign in on start.ng to save your best run to the leaderboard.";
          }
        })
        .catch(() => {
          goRankEl.textContent = "Sign in on start.ng to save your best run to the leaderboard.";
        });
    } else {
      goRankEl.textContent = "Play on start.ng to save your best run to the global leaderboard.";
    }
  }
}

// Initialize opening skirmish & pre-warm all WebGL shaders once at startup (eliminates first-explosion hitch!)
resetBattlefield();
syncSettingsUI();
renderer.compile(scene, camera);
window.setTimeout(() => aimHintEl.classList.add("hidden"), 4500);
Object.assign(window, { renderer, scene, camera, __ironwood: { player, enemies, allyCars, terrain } });

// ── 11. Main Simulation & Rendering Loop (THREE.Timer + Real-Time Shake) ─────
const timer = new THREE.Timer();
timer.connect(document);

const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpAim = new THREE.Vector3();
const tmpNorm = new THREE.Vector3();
const upVec = new THREE.Vector3(0, 1, 0);
const carTiltQ = new THREE.Quaternion();
const yawQ = new THREE.Quaternion();
const camPosTarget = new THREE.Vector3();
const camLook = new THREE.Vector3();

let elapsed = 0;
let realTime = 0;
let fpsFrames = 0;
let fpsAccum = 0;

renderer.setAnimationLoop(() => {
  timer.update();
  const realDt = Math.min(Math.max(timer.getDelta(), 0), 0.1);
  realTime += realDt;

  // FPS & accurate triangle readout
  fpsFrames++;
  fpsAccum += realDt;
  if (fpsAccum >= 0.5) {
    const fps = Math.round(fpsFrames / fpsAccum);
    const tris = Math.round(renderer.info.render.triangles / 1000);
    perfBadgeEl.textContent = `R180 · WEBGL · ${fps} FPS · ${tris}k TRIS`;
    fpsFrames = 0;
    fpsAccum = 0;
  }

  // Hit-stop scales simulation dt while keeping camera shake decaying in real time!
  let simDt = player.paused ? 0 : realDt;
  if (player.hitStop > 0 && !player.paused) {
    player.hitStop = Math.max(0, player.hitStop - realDt);
    simDt *= 0.08;
  }
  elapsed += simDt;

  if (!player.paused) {
    // ── A. Player Movement, Stance Morph & Car Physics ──
    player.morph += (player.targetMorph - player.morph) * (1 - Math.exp(-8.5 * simDt));
    const targetSiege = player.stance === "siege" ? 1 : 0;
    player.siege += (targetSiege - player.siege) * (1 - Math.exp(-9 * simDt));

    const fwdIn =
      (keys.has("w") || keys.has("arrowup") || touchMove.up ? 1 : 0) -
      (keys.has("s") || keys.has("arrowdown") || touchMove.down ? 1 : 0);
    const rightIn =
      (keys.has("d") || keys.has("arrowright") || touchMove.right ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") || touchMove.left ? 1 : 0);

    const isCar = player.morph > 0.5;
    const baseSpeed = isCar ? 27.5 : player.stance === "siege" ? 6.5 : 13.5;

    let wantVx = 0;
    let wantVz = 0;
    if (player.dashTimer > 0) {
      player.dashTimer = Math.max(0, player.dashTimer - simDt);
      wantVx = player.dashDirX * 34;
      wantVz = player.dashDirZ * 34;
      if (Math.random() < 0.7) {
        spawnParticle(player.x, getTerrainHeight(player.x, player.z) + 0.8, player.z, 0, 0.8, 0, 0xffa63d, 0.9, 0.15, 0.25, -4, true);
      }
    } else if (fwdIn !== 0 || rightIn !== 0) {
      const fX = -Math.sin(player.camYaw);
      const fZ = -Math.cos(player.camYaw);
      const rX = Math.cos(player.camYaw);
      const rZ = -Math.sin(player.camYaw);
      const len = Math.hypot(fwdIn, rightIn) || 1;
      wantVx = ((fX * fwdIn + rX * rightIn) / len) * baseSpeed;
      wantVz = ((fZ * fwdIn + rZ * rightIn) / len) * baseSpeed;
    }

    const accel = isCar ? 5.2 : 10.5;
    player.vx += (wantVx - player.vx) * (1 - Math.exp(-accel * simDt));
    player.vz += (wantVz - player.vz) * (1 - Math.exp(-accel * simDt));
    player.x += player.vx * simDt;
    player.z += player.vz * simDt;

    [player.x, player.z] = pushOutOfMesas(player.x, player.z, isCar ? 2.4 : 1.85);

    const speed = Math.hypot(player.vx, player.vz);
    if (speed > 0.7) {
      const moveYaw = Math.atan2(-player.vx, -player.vz);
      const targetBodyYaw = isCar ? moveYaw : player.camYaw;
      const diff = Math.atan2(Math.sin(targetBodyYaw - player.yaw), Math.cos(targetBodyYaw - player.yaw));
      player.yaw += diff * (1 - Math.exp(-(isCar ? 7.5 : 10) * simDt));
      player.walkCycle += simDt * speed * 0.72;

      // Kick up desert dust & occasional hot sparks beneath mech feet / 6x6 car tyres!
      if (Math.random() < (isCar ? 0.55 : 0.25)) {
        const py = getTerrainHeight(player.x, player.z);
        spawnParticle(
          player.x + (Math.random() - 0.5) * 1.6,
          py + 0.35,
          player.z + (Math.random() - 0.5) * 1.6,
          -player.vx * 0.15,
          1.2 + Math.random() * 1.1,
          -player.vz * 0.15,
          0xa68462,
          0.9,
          2.8,
          0.65,
          -0.6,
          false
        );
      }
    } else if (!isCar) {
      const diff = Math.atan2(Math.sin(player.camYaw - player.yaw), Math.cos(player.camYaw - player.yaw));
      player.yaw += diff * (1 - Math.exp(-7 * simDt));
    }

    // Cooldowns, Heat dissipation, Plate & Cell regeneration
    player.fireCd = Math.max(0, player.fireCd - simDt);
    player.missileCd = Math.max(0, player.missileCd - simDt);
    player.squadCd = Math.max(0, player.squadCd - simDt);
    player.podCd = Math.max(0, player.podCd - simDt);
    player.recoilL = Math.max(0, player.recoilL - simDt * 6.5);
    player.recoilR = Math.max(0, player.recoilR - simDt * 6.5);

    const coolRate = player.overheated ? 26 : firing ? 8 : 34;
    player.heat = Math.max(0, player.heat - coolRate * simDt);
    if (player.overheated && player.heat <= 28) player.overheated = false;

    const plateRegen = (player.weaponSlot === 1 ? 14 : 6.5) + player.upPlate * 1.5;
    if (!bracing) player.plate = Math.min(player.maxPlate, player.plate + plateRegen * simDt);

    if (player.cells < player.maxCells) {
      player.cellRegen += simDt;
      if (player.cellRegen >= 2.2) {
        player.cellRegen = 0;
        player.cells++;
      }
    }

    // Compute world aim point (auto-assists softly toward locked enemy if within crosshair cone!)
    const locked = getLockedEnemy();
    const camDirX = -Math.sin(player.camYaw) * Math.cos(player.camPitch);
    const camDirY = -Math.sin(player.camPitch);
    const camDirZ = -Math.cos(player.camYaw) * Math.cos(player.camPitch);
    tmpAim.set(
      player.x + camDirX * 85,
      Math.max(getTerrainHeight(player.x + camDirX * 60, player.z + camDirZ * 60) + 1.4, getTerrainHeight(player.x, player.z) + 3.2 + camDirY * 60),
      player.z + camDirZ * 85
    );
    if (locked) {
      const ly = getTerrainHeight(locked.x, locked.z) + 2.4;
      tmpV1.set(locked.x - player.x, ly - (getTerrainHeight(player.x, player.z) + 3.2), locked.z - player.z).normalize();
      const dot = tmpV1.x * camDirX + tmpV1.y * camDirY + tmpV1.z * camDirZ;
      if (dot > 0.86) tmpAim.set(locked.x, ly, locked.z);
    }

    // ── B. Primary Weapon Firing (LMB) ──
    if (firing && !player.overheated && player.fireCd <= 0 && !player.studioMode) {
      const w = WEAPONS[player.weaponSlot];
      const siegeMult = player.stance === "siege" ? 1.45 : 1.0;
      const tierMult = 1 + (player.tier - 1) * 0.18 + (player.upRail - 1) * 0.1;

      player.fireCd = w.cooldown / siegeMult;
      player.heat = Math.min(100, player.heat + w.heat * (player.stance === "siege" ? 0.78 : 1));
      if (player.heat >= 100) {
        player.overheated = true;
        showCallout("WEAPONS OVERHEATED · VENTING");
      }
      player.shots++;
      player.trauma = Math.min(1, player.trauma + w.trauma);
      audio.playGun(player.weaponSlot);

      const sides: (0 | 1)[] = w.dual ? [0, 1] : [player.barrelSide];
      player.barrelSide = player.barrelSide === 0 ? 1 : 0;

      for (const s of sides) {
        if (s === 0) player.recoilL = 1;
        else player.recoilR = 1;

        playerRig.getMuzzleWorldPos(s, tmpV1);
        tmpV2.copy(tmpAim).sub(tmpV1).normalize();
        tmpV2.x += (Math.random() - 0.5) * w.spread;
        tmpV2.y += (Math.random() - 0.5) * w.spread;
        tmpV2.z += (Math.random() - 0.5) * w.spread;
        tmpV2.normalize();

        spawnProjectile({
          x: tmpV1.x,
          y: tmpV1.y,
          z: tmpV1.z,
          dirX: tmpV2.x,
          dirY: tmpV2.y,
          dirZ: tmpV2.z,
          speed: w.speed,
          damage: w.damage * siegeMult * tierMult,
          color: w.color,
          friendly: true,
          splash: w.splash,
          length: w.length,
          gravity: player.weaponSlot === 4 ? -28 : 0,
        });
      }
    }

    // ── C. Update Player 3D Rig on Dunes (Car conforms to dune slope!) ──
    const py = getTerrainHeight(player.x, player.z);
    playerRig.root.position.set(player.x, py, player.z);
    yawQ.setFromAxisAngle(upVec, player.yaw);
    if (player.morph > 0.05) {
      getTerrainNormal(player.x, player.z, tmpNorm);
      carTiltQ.setFromUnitVectors(upVec, tmpNorm).multiply(yawQ);
      playerRig.root.quaternion.copy(yawQ).slerp(carTiltQ, player.morph);
    } else {
      playerRig.root.quaternion.copy(yawQ);
    }

    const aimOffset = Math.atan2(Math.sin(player.camYaw - player.yaw), Math.cos(player.camYaw - player.yaw));
    playerRig.updateVisuals({
      morph: player.morph,
      siege: player.siege,
      walkCycle: player.walkCycle,
      moveAmt: Math.min(1, speed / 10),
      speed,
      aimYawOffset: aimOffset,
      aimPitch: -player.camPitch * 0.65,
      bracing,
      dashTimer: player.dashTimer,
      recoilL: player.recoilL,
      recoilR: player.recoilR,
      dt: simDt,
    });

    // ── D. Enemy War Robots AI, Firing & Solid Collision (Zero Clipping!) ──
    for (const e of enemies) {
      const dxP = player.x - e.x;
      const dzP = player.z - e.z;
      const distP = Math.hypot(dxP, dzP) || 1;

      if (!player.freezeEnemies) {
        // Turn toward player & advance to optimal combat range (~26–38m), strafing tactically
        const targetYaw = Math.atan2(-dxP, -dzP);
        const yDiff = Math.atan2(Math.sin(targetYaw - e.yaw), Math.cos(targetYaw - e.yaw));
        e.yaw += yDiff * (1 - Math.exp(-3.6 * simDt));

        const moveSpd = e.heavy ? 4.4 : 6.2;
        const approach = distP > 34 ? 1 : distP < 18 ? -0.55 : 0.1;
        const fwdX = dxP / distP;
        const fwdZ = dzP / distP;
        const stX = -fwdZ * e.strafeDir * 0.45;
        const stZ = fwdX * e.strafeDir * 0.45;
        e.x += (fwdX * approach + stX) * moveSpd * simDt;
        e.z += (fwdZ * approach + stZ) * moveSpd * simDt;
        e.walkCycle += simDt * moveSpd * 0.7;

        // Fire crimson laser/cannon bursts at player when in range
        e.fireCd -= simDt;
        if (e.fireCd <= 0 && distP < 78) {
          e.fireCd = (e.heavy ? 1.45 : 1.85) + Math.random() * 0.7;
          e.rig.muzzle.getWorldPosition(tmpV1);
          tmpV2.set(player.x - tmpV1.x, py + 2.1 - tmpV1.y, player.z - tmpV1.z).normalize();
          tmpV2.x += (Math.random() - 0.5) * 0.06;
          tmpV2.z += (Math.random() - 0.5) * 0.06;
          tmpV2.normalize();
          spawnProjectile({
            x: tmpV1.x,
            y: tmpV1.y,
            z: tmpV1.z,
            dirX: tmpV2.x,
            dirY: tmpV2.y,
            dirZ: tmpV2.z,
            speed: 58,
            damage: e.heavy ? 13 : 8,
            color: 0xff4040,
            friendly: false,
            length: 2.6,
          });
        }
      }

      [e.x, e.z] = pushOutOfMesas(e.x, e.z, e.heavy ? 2.4 : 1.9);

      // Solid collision with Player (high-speed Car ramming deals massive damage + knockback!)
      const pMinDist = (isCar ? 2.5 : 2.1) + (e.heavy ? 2.2 : 1.8);
      const pdx = player.x - e.x;
      const pdz = player.z - e.z;
      const pd = Math.hypot(pdx, pdz);
      if (pd < pMinDist && pd > 1e-4) {
        const push = pMinDist - pd;
        const nx = pdx / pd;
        const nz = pdz / pd;
        player.x += nx * push * 0.55;
        player.z += nz * push * 0.55;
        e.x -= nx * push * 0.45;
        e.z -= nz * push * 0.45;
        if (isCar && speed > 14) {
          damageEnemy(e, 34);
          spawnSparkBurst((player.x + e.x) * 0.5, py + 1.4, (player.z + e.z) * 0.5, 14, 0xffd27a, 14);
          player.trauma = Math.min(1, player.trauma + 0.28);
          e.x -= nx * 3.2;
          e.z -= nz * 3.2;
        }
      }

      // Enemy-to-enemy solid separation
      for (const other of enemies) {
        if (other === e) continue;
        const odx = e.x - other.x;
        const odz = e.z - other.z;
        const od = Math.hypot(odx, odz);
        if (od < 4.4 && od > 1e-4) {
          const push = (4.4 - od) * 0.5;
          e.x += (odx / od) * push;
          e.z += (odz / od) * push;
        }
      }

      e.rig.group.position.set(e.x, getTerrainHeight(e.x, e.z), e.z);
      e.rig.group.rotation.y = e.yaw;
      const sw = Math.sin(e.walkCycle) * 0.48;
      e.rig.leftLeg.rotation.x = sw;
      e.rig.rightLeg.rotation.x = -sw;
      e.hitFlash = Math.max(0, e.hitFlash - simDt);
    }

    // ── E. Allied 6-Wheel Combat Cars, Hover Drones & Missile Pods ──
    for (let i = allyCars.length - 1; i >= 0; i--) {
      const c = allyCars[i];
      c.life -= simDt;
      if (c.life <= 0) {
        scene.remove(c.rig.group);
        allyCars.splice(i, 1);
        continue;
      }
      c.orbitAngle += simDt * 0.42;
      const targetX = player.x + Math.cos(c.orbitAngle) * 11.5;
      const targetZ = player.z + Math.sin(c.orbitAngle) * 11.5;
      const dx = targetX - c.x;
      const dz = targetZ - c.z;
      const dist = Math.hypot(dx, dz);
      const wantSpd = dist > 3 ? Math.min(18, dist * 1.4) : 0;
      c.speed += (wantSpd - c.speed) * (1 - Math.exp(-4 * simDt));
      if (dist > 0.5) {
        const tyaw = Math.atan2(-dx, -dz);
        const yd = Math.atan2(Math.sin(tyaw - c.yaw), Math.cos(tyaw - c.yaw));
        c.yaw += yd * (1 - Math.exp(-5 * simDt));
      }
      c.x -= Math.sin(c.yaw) * c.speed * simDt;
      c.z -= Math.cos(c.yaw) * c.speed * simDt;
      [c.x, c.z] = pushOutOfMesas(c.x, c.z, 2.3);

      // Solid separation from player so wingman car never clips through you!
      const pdx = c.x - player.x;
      const pdz = c.z - player.z;
      const pd = Math.hypot(pdx, pdz);
      if (pd < 4.6 && pd > 1e-4) {
        c.x += (pdx / pd) * (4.6 - pd);
        c.z += (pdz / pd) * (4.6 - pd);
      }

      const cy = getTerrainHeight(c.x, c.z);
      c.rig.group.position.set(c.x, cy, c.z);
      getTerrainNormal(c.x, c.z, tmpNorm);
      yawQ.setFromAxisAngle(upVec, c.yaw);
      c.rig.group.quaternion.setFromUnitVectors(upVec, tmpNorm).multiply(yawQ);
      for (const w of c.rig.wheels) w.rotation.x -= (c.speed / 0.52) * simDt;

      // Auto-engage nearest enemy mech!
      c.fireCd -= simDt;
      if (c.fireCd <= 0 && enemies.length > 0) {
        const target = enemies[i % enemies.length];
        if (Math.hypot(target.x - c.x, target.z - c.z) < 75) {
          c.fireCd = 0.72;
          tmpV2.set(target.x - c.x, getTerrainHeight(target.x, target.z) + 2.2 - (cy + 1.5), target.z - c.z).normalize();
          spawnProjectile({
            x: c.x,
            y: cy + 1.5,
            z: c.z,
            dirX: tmpV2.x,
            dirY: tmpV2.y,
            dirZ: tmpV2.z,
            speed: 95,
            damage: 11,
            color: 0x4ade80,
            friendly: true,
            length: 2.2,
          });
        }
      }
    }

    for (let i = allyDrones.length - 1; i >= 0; i--) {
      const d = allyDrones[i];
      d.life -= simDt;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        allyDrones.splice(i, 1);
        continue;
      }
      d.orbitAngle += simDt * 1.15;
      const tx = player.x + Math.cos(d.orbitAngle) * 7.5;
      const tz = player.z + Math.sin(d.orbitAngle) * 7.5;
      d.x += (tx - d.x) * (1 - Math.exp(-3.5 * simDt));
      d.z += (tz - d.z) * (1 - Math.exp(-3.5 * simDt));
      d.y = getTerrainHeight(d.x, d.z) + 6.4 + Math.sin(elapsed * 3.5 + i) * 0.45;
      d.mesh.position.set(d.x, d.y, d.z);
      d.mesh.rotation.y = -d.orbitAngle;

      d.fireCd -= simDt;
      if (d.fireCd <= 0 && enemies.length > 0) {
        const target = enemies[0];
        d.fireCd = 0.48;
        tmpV2.set(target.x - d.x, getTerrainHeight(target.x, target.z) + 2.2 - d.y, target.z - d.z).normalize();
        spawnProjectile({
          x: d.x,
          y: d.y - 0.2,
          z: d.z,
          dirX: tmpV2.x,
          dirY: tmpV2.y,
          dirZ: tmpV2.z,
          speed: 110,
          damage: 9,
          color: 0x86efac,
          friendly: true,
          length: 2.4,
        });
      }
    }

    for (let i = missilePods.length - 1; i >= 0; i--) {
      const pod = missilePods[i];
      pod.life -= simDt;
      if (pod.life <= 0) {
        scene.remove(pod.rig.group);
        missilePods.splice(i, 1);
        continue;
      }
      pod.rig.turret.rotation.y += simDt * 1.4;
      pod.fireCd -= simDt;
      if (pod.fireCd <= 0 && enemies.length > 0) {
        pod.fireCd = 1.35;
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        audio.playMissile();
        spawnProjectile({
          x: pod.x,
          y: getTerrainHeight(pod.x, pod.z) + 1.8,
          z: pod.z,
          dirX: (Math.random() - 0.5) * 0.4,
          dirY: 0.92,
          dirZ: (Math.random() - 0.5) * 0.4,
          speed: 42,
          damage: 34 + player.upPods * 6,
          color: 0xf59e0b,
          friendly: true,
          splash: 4.5,
          isMissile: true,
          homingTarget: target,
        });
      }
    }

    // ── F. Glowing Emerald Energy Core Pickups (Tier & Upgrade Progression!) ──
    for (let i = energyCores.length - 1; i >= 0; i--) {
      const co = energyCores[i];
      co.bob += simDt * 3.0;
      co.rig.cube.rotation.y += simDt * 2.2;
      co.rig.cube.position.y = 0.95 + Math.sin(co.bob) * 0.22;

      const dist = Math.hypot(player.x - co.x, player.z - co.z);
      // Gentle magnetic pull within 7m
      if (dist < 7.5 && dist > 0.1) {
        co.x += ((player.x - co.x) / dist) * 14 * simDt;
        co.z += ((player.z - co.z) / dist) * 14 * simDt;
        co.rig.group.position.set(co.x, getTerrainHeight(co.x, co.z), co.z);
      }
      if (dist < 2.9) {
        audio.playCorePickup();
        scene.remove(co.rig.group);
        energyCores.splice(i, 1);
        player.cores++;
        player.score += 75;
        player.hull = Math.min(player.maxHull, player.hull + 15);
        player.cells = Math.min(player.maxCells, player.cells + 2);
        spawnSparkBurst(player.x, py + 1.8, player.z, 10, 0x4ade80, 9);

        if (player.cores >= player.coresNeeded) {
          player.cores = 0;
          player.tier = Math.min(5, player.tier + 1);
          player.coresNeeded = 4 + player.tier;
          player.upRail = Math.min(5, player.upRail + 1);
          player.upPods = Math.min(5, player.upPods + 1);
          player.upPlate = Math.min(5, player.upPlate + 1);
          player.maxHull += 20;
          player.hull = player.maxHull;
          player.maxPlate += 15;
          player.plate = player.maxPlate;
          showCallout(`TIER ${player.tier} REACHED · RAIL, PODS & PLATE UPGRADED`);
        }
      }
    }

    // ── G. Projectiles, Homing Missiles & Splash Craters ──
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= simDt;

      // Homing missile steering + smoke trail
      if (p.isMissile) {
        if (p.homingTarget && enemies.includes(p.homingTarget)) {
          const ty = getTerrainHeight(p.homingTarget.x, p.homingTarget.z) + 2.2;
          tmpV1.set(p.homingTarget.x - p.x, ty - p.y, p.homingTarget.z - p.z).normalize();
          const curSpd = Math.hypot(p.vx, p.vy, p.vz) || 42;
          p.vx += (tmpV1.x * curSpd - p.vx) * (1 - Math.exp(-5.5 * simDt));
          p.vy += (tmpV1.y * curSpd - p.vy) * (1 - Math.exp(-5.5 * simDt));
          p.vz += (tmpV1.z * curSpd - p.vz) * (1 - Math.exp(-5.5 * simDt));
        }
        if (Math.random() < 0.75) {
          spawnParticle(p.x, p.y, p.z, 0, 0.5, 0, 0xffd28a, 0.6, 1.8, 0.28, 0, true);
        }
      }

      p.vy += p.gravity * simDt;
      p.x += p.vx * simDt;
      p.y += p.vy * simDt;
      p.z += p.vz * simDt;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);

      let hit = false;
      const groundY = getTerrainHeight(p.x, p.z);

      // Hit terrain
      if (p.y <= groundY + 0.15) {
        hit = true;
        if (p.splash > 0) spawnExplosion(p.x, groundY, p.z, p.splash > 5);
        else spawnSparkBurst(p.x, groundY + 0.2, p.z, 4, 0xffcc70, 7);
      }

      // Hit mesa rock cover
      if (!hit) {
        for (const m of terrain.mesas) {
          if (Math.hypot(p.x - m.x, p.z - m.z) < m.radius && p.y < getTerrainHeight(m.x, m.z) + m.height) {
            hit = true;
            spawnSparkBurst(p.x, p.y, p.z, 5, 0xffd27a, 8);
            break;
          }
        }
      }

      // Hit enemies (friendly projectiles)
      if (!hit && p.friendly) {
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
          const e = enemies[ei];
          const ey = getTerrainHeight(e.x, e.z) + 2.2;
          const r = e.heavy ? 2.6 : 2.1;
          if (Math.hypot(p.x - e.x, p.z - e.z) < r && Math.abs(p.y - ey) < 2.6) {
            hit = true;
            if (p.splash > 0) {
              spawnExplosion(p.x, p.y, p.z, p.splash > 5);
            } else {
              spawnSparkBurst(p.x, p.y, p.z, 7, 0xffcf70, 10);
              damageEnemy(e, p.damage);
            }
            break;
          }
        }
      } else if (!hit && !p.friendly) {
        // Enemy projectile hitting player
        const playerY = py + (isCar ? 1.0 : 2.3);
        if (Math.hypot(p.x - player.x, p.z - player.z) < 2.3 && Math.abs(p.y - playerY) < 2.3) {
          hit = true;
          spawnSparkBurst(p.x, p.y, p.z, 8, bracing ? 0xf5b942 : 0xff5544, 9);
          damagePlayer(p.damage);
        }
      }

      // Splash AoE blast damage
      if (hit && p.friendly && p.splash > 0) {
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
          const e = enemies[ei];
          const d = Math.hypot(p.x - e.x, p.z - e.z);
          if (d < p.splash) {
            damageEnemy(e, p.damage * (1 - (d / p.splash) * 0.5));
          }
        }
      }

      if (hit || p.life <= 0) {
        releaseProjectile(p);
        projectiles.splice(i, 1);
      }
    }

    // ── H. Particles & Bouncing Debris Physics (Zero-GC Pooled) ──
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life -= simDt;
      if (pt.life <= 0) {
        releaseParticle(pt);
        particles.splice(i, 1);
        continue;
      }
      pt.vy += pt.gravity * simDt;
      pt.sprite.position.x += pt.vx * simDt;
      pt.sprite.position.y += pt.vy * simDt;
      pt.sprite.position.z += pt.vz * simDt;
      const t = 1 - pt.life / pt.maxLife;
      const scVal = THREE.MathUtils.lerp(pt.startScale, pt.endScale, t);
      pt.sprite.scale.set(scVal, scVal, 1);
      pt.sprite.material.opacity = (1 - t) * 0.92;
    }

    for (let i = debris.length - 1; i >= 0; i--) {
      const db = debris[i];
      db.life -= simDt;
      if (db.life <= 0) {
        releaseDebris(db);
        debris.splice(i, 1);
        continue;
      }
      db.vy -= 24 * simDt;
      db.mesh.position.x += db.vx * simDt;
      db.mesh.position.y += db.vy * simDt;
      db.mesh.position.z += db.vz * simDt;
      db.mesh.rotation.x += db.rx * simDt;
      db.mesh.rotation.y += db.ry * simDt;
      const gy = getTerrainHeight(db.mesh.position.x, db.mesh.position.z) + 0.22;
      if (db.mesh.position.y < gy) {
        db.mesh.position.y = gy;
        db.vy *= -0.35;
        db.vx *= 0.62;
        db.vz *= 0.62;
        db.rx *= 0.5;
        db.ry *= 0.5;
      }
    }
  }

  // ── I. Camera Follow + Smooth Real-Time Summed-Sine Trauma Shake ──
  player.trauma = Math.max(0, player.trauma - realDt * 1.45);
  const shake = player.trauma * player.trauma * player.shakeMult * 0.45;
  const shX = shake * Math.sin(realTime * 46);
  const shY = shake * Math.sin(realTime * 61);

  const playerGroundY = getTerrainHeight(player.x, player.z);
  if (player.studioMode) {
    studioControls.update();
  } else {
    const dist = player.camZoom + (player.morph > 0.5 ? 2.4 : 0);
    const height = 4.4 + Math.sin(player.camPitch) * dist;
    const horiz = Math.cos(player.camPitch) * dist;
    camPosTarget.set(
      player.x + Math.sin(player.camYaw) * horiz,
      Math.max(getTerrainHeight(player.x + Math.sin(player.camYaw) * horiz, player.z + Math.cos(player.camYaw) * horiz) + 2.2, playerGroundY + height),
      player.z + Math.cos(player.camYaw) * horiz
    );
    camera.position.lerp(camPosTarget, 1 - Math.exp(-10 * realDt));
    camera.position.x += shX;
    camera.position.y += shY;

    // Look downrange past the mech so the hero sits cleanly in the lower-mid foreground just like Ironwood!
    camLook.set(
      player.x - Math.sin(player.camYaw) * 14,
      playerGroundY + 1.8 - Math.sin(player.camPitch - 0.35) * 10,
      player.z - Math.cos(player.camYaw) * 14
    );
    camera.lookAt(camLook);
  }

  // Dramatic low-angle side-raking desert sunlight for sweeping dune shadows!
  sun.target.position.set(player.x, playerGroundY, player.z - 14);
  sun.position.set(player.x - 62, playerGroundY + 23, player.z - 22);

  // ── J. Project 3D Enemy HP Bars & Golden Target Lock Brackets ──
  const wHalf = window.innerWidth * 0.5;
  const hHalf = window.innerHeight * 0.5;
  let lockedOnScreen = false;

  for (const e of enemies) {
    tmpV1.set(e.x, getTerrainHeight(e.x, e.z) + (e.heavy ? 5.3 : 4.5), e.z).project(camera);
    if (tmpV1.z > 1) {
      e.hpEl.style.display = "none";
      continue;
    }
    const sx = tmpV1.x * wHalf + wHalf;
    const sy = -tmpV1.y * hHalf + hHalf;
    e.hpEl.style.display = "block";
    e.hpEl.style.left = `${sx}px`;
    e.hpEl.style.top = `${sy}px`;
    e.hpEl.classList.toggle("locked", e.id === lockedEnemyId);
    e.fillEl.style.width = `${Math.max(0, (e.hp / e.maxHp) * 100)}%`;

    if (e.id === lockedEnemyId) {
      tmpV2.set(e.x, getTerrainHeight(e.x, e.z) + 2.4, e.z).project(camera);
      if (tmpV2.z <= 1) {
        lockedOnScreen = true;
        reticleEl.style.left = `${tmpV2.x * wHalf + wHalf}px`;
        reticleEl.style.top = `${-tmpV2.y * hHalf + hHalf}px`;
      }
    }
  }

  reticleEl.classList.toggle("locked", lockedOnScreen);
  if (!lockedOnScreen) {
    reticleEl.style.left = "50%";
    reticleEl.style.top = "45%";
  }

  // ── K. Sync Minimalist Ironwood HUD Counters ──
  plateFillEl.style.width = `${(player.plate / player.maxPlate) * 100}%`;
  plateValEl.textContent = String(Math.round(player.plate));
  heatFillEl.style.width = `${player.heat}%`;
  heatValEl.textContent = `${Math.round(player.heat)}%`;
  cellsValEl.textContent = String(player.cells);
  for (let i = 0; i < cellsGridEl.children.length; i++) {
    cellsGridEl.children[i].classList.toggle("on", i < player.cells);
  }
  hullFillEl.style.width = `${Math.max(0, (player.hull / player.maxHull) * 100)}%`;
  hullValEl.textContent = `${Math.max(0, Math.round(player.hull))} / ${player.maxHull}`;
  shotsValEl.textContent = String(player.shots);
  tierNumEl.textContent = String(player.tier);
  coresValEl.textContent = `${player.cores} / ${player.coresNeeded}`;
  killsValEl.textContent = String(player.kills);
  scoreValEl.textContent = player.score.toLocaleString();

  squadSubEl.textContent = player.squadCd > 0 ? `Recharging · ${Math.ceil(player.squadCd)}s` : "2 drones + 3 cars ready";
  btnSquad.classList.toggle("cooling", player.squadCd > 0);
  podSubEl.textContent = player.podCd > 0 ? `Recharging · ${Math.ceil(player.podCd)}s` : "Ready · 20s deployment";
  btnPod.classList.toggle("cooling", player.podCd > 0);

  const upRailEl = document.getElementById("up-rail")!;
  const upPodsEl = document.getElementById("up-pods")!;
  const upPlateEl = document.getElementById("up-plate")!;
  for (let i = 0; i < 5; i++) {
    upRailEl.children[i].classList.toggle("on", i < player.upRail);
    upPodsEl.children[i].classList.toggle("on", i < player.upPods);
    upPlateEl.children[i].classList.toggle("on", i < player.upPlate);
  }

  // ── L. Render Frame (High PBR Bloom vs Eco Fast Pass) ──
  renderer.info.reset();
  if (ecoMode) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }
});

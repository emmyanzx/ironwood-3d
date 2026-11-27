import * as THREE from "three";
import { createArmorPlateTextures, createContactShadowTexture, createSoftGlowTexture } from "./textures";

let sharedShadowMat: THREE.MeshBasicMaterial | null = null;
function makeShadow(w: number, l: number) {
  if (!sharedShadowMat) {
    sharedShadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), sharedShadowMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.07;
  return m;
}

const glowTex = createSoftGlowTexture();
const heroTex = createArmorPlateTextures("#3d3834", "#9a7c5a", 101);
const carTex = createArmorPlateTextures("#1d2024", "#475569", 202);
const enemyTex = createArmorPlateTextures("#2c292d", "#7f1d1d", 303);

export const mats = {
  heroArmor: new THREE.MeshStandardMaterial({
    map: heroTex.map,
    bumpMap: heroTex.bumpMap,
    bumpScale: 0.06,
    roughness: 0.48,
    metalness: 0.72,
  }),
  heroBronze: new THREE.MeshStandardMaterial({
    color: 0x6e5b47,
    map: heroTex.map,
    roughness: 0.42,
    metalness: 0.68,
  }),
  darkJoint: new THREE.MeshStandardMaterial({ color: 0x1b1a1e, roughness: 0.65, metalness: 0.55 }),
  barrelSteel: new THREE.MeshStandardMaterial({ color: 0x26282e, roughness: 0.34, metalness: 0.85 }),
  carBody: new THREE.MeshPhysicalMaterial({
    map: carTex.map,
    bumpMap: carTex.bumpMap,
    bumpScale: 0.04,
    color: 0x252a30,
    roughness: 0.36,
    metalness: 0.78,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
  }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.92, metalness: 0.08 }),
  enemyDark: new THREE.MeshStandardMaterial({
    map: enemyTex.map,
    bumpMap: enemyTex.bumpMap,
    bumpScale: 0.05,
    roughness: 0.52,
    metalness: 0.68,
  }),
  enemyRed: new THREE.MeshStandardMaterial({
    color: 0xa62020,
    roughness: 0.42,
    metalness: 0.55,
  }),
  visorAmber: new THREE.MeshStandardMaterial({
    color: 0xffd27a,
    emissive: 0xff9d2e,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  }),
  visorRed: new THREE.MeshStandardMaterial({
    color: 0xff4444,
    emissive: 0xff2222,
    emissiveIntensity: 2.6,
    roughness: 0.2,
  }),
  coreGreen: new THREE.MeshStandardMaterial({
    color: 0x86efac,
    emissive: 0x22c55e,
    emissiveIntensity: 2.8,
    roughness: 0.15,
  }),
  thrusterFlame: new THREE.MeshBasicMaterial({
    color: 0xff9a3c,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
};

function makeWheel(r: number, w: number) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), mats.tyre);
  t.rotation.z = Math.PI / 2;
  t.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.52, r * 0.52, w + 0.04, 8), mats.barrelSteel);
  hub.rotation.z = Math.PI / 2;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, r * 0.72, 0.08), mats.heroBronze);
  g.add(t, hub, spoke);
  return g;
}

/** Twin tall shoulder-mounted 6-barrel rotary miniguns (signature Ironwood silhouette!) */
function makeShoulderCannon(side: -1 | 1) {
  const g = new THREE.Group();
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.62), mats.darkJoint);
  pylon.position.set(0, -0.32, 0.15);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.68, 1.48), mats.heroArmor);
  housing.position.y = 0.12;
  housing.castShadow = true;
  const ammoDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.56, 10), mats.heroBronze);
  ammoDrum.rotation.z = Math.PI / 2;
  ammoDrum.position.set(side * 0.4, -0.1, 0.25);

  // Tall exposed 6-barrel gatling cluster jutting proudly upward & forward!
  const barrelCluster = new THREE.Group();
  barrelCluster.position.set(0, 0.22, -0.74);
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * Math.PI * 2;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.048, 2.45, 7), mats.barrelSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14, -1.2);
    barrel.castShadow = true;
    barrelCluster.add(barrel);
  }
  for (const cz of [-0.65, -1.75]) {
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.14, 10), mats.heroBronze);
    clamp.rotation.x = Math.PI / 2;
    clamp.position.set(0, 0, cz);
    barrelCluster.add(clamp);
  }

  // Muzzle flash sprite
  const flashMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffd07a,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });
  const flash = new THREE.Sprite(flashMat);
  flash.position.set(0, 0.22, -3.25);
  flash.scale.set(1.75, 1.75, 1);

  g.add(pylon, housing, ammoDrum, barrelCluster, flash);
  return { group: g, barrelCluster, flash, flashMat };
}

export type PlayerRig = {
  root: THREE.Group;
  mechGroup: THREE.Group;
  carGroup: THREE.Group;
  upperBody: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftCannon: ReturnType<typeof makeShoulderCannon>;
  rightCannon: ReturnType<typeof makeShoulderCannon>;
  braceShield: THREE.Mesh;
  thrusterLeft: THREE.Mesh;
  thrusterRight: THREE.Mesh;
  carWheels: THREE.Object3D[];
  carMuzzles: THREE.Object3D[];
  getMuzzleWorldPos: (side: 0 | 1, out: THREE.Vector3) => THREE.Vector3;
  updateVisuals: (opts: {
    morph: number; // 0 = bipedal mech, 1 = 6-wheel combat car
    siege: number; // 0..1 siege stance crouch
    walkCycle: number;
    moveAmt: number;
    speed: number;
    aimYawOffset: number;
    aimPitch: number;
    bracing: boolean;
    dashTimer: number;
    recoilL: number;
    recoilR: number;
    dt: number;
  }) => void;
};

/**
 * Hero Ironwood War Mech ("AEGIS") that dynamically transforms into the sleek 6-Wheel Combat Car!
 * Matches the center twin-minigun war robot AND right-side 6-wheel green-core car in Ironwood.
 */
export function buildPlayerMech(): PlayerRig {
  const root = new THREE.Group();
  root.add(makeShadow(4.2, 4.8));

  // ── A. BIPEDAL HEAVY WAR MECH RIG ──
  const mechGroup = new THREE.Group();
  root.add(mechGroup);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.62, 1.2), mats.darkJoint);
  pelvis.position.y = 2.05;
  pelvis.castShadow = true;
  mechGroup.add(pelvis);

  const upperBody = new THREE.Group();
  upperBody.position.y = 2.4;
  mechGroup.add(upperBody);

  // Heavy beveled chest hull
  const chest = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.38, 1.55), mats.heroArmor);
  chest.position.y = 0.68;
  chest.castShadow = true;
  chest.receiveShadow = true;
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.96, 1.72), mats.heroBronze);
  chestPlate.position.set(0, 0.72, -0.04);
  chestPlate.castShadow = true;

  // Armored head sensor pod + amber optic slit
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.56, 0.88), mats.heroArmor);
  head.position.set(0, 1.62, -0.1);
  head.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.16, 0.14), mats.visorAmber);
  visor.position.set(0, 1.64, -0.52);

  // Multi-tiered armored dorsal spine, cooling heat-sinks & compact amber reactor vent (sculpted AAA rear view!)
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.02, 0.56), mats.heroArmor);
  backpack.position.set(0, 0.82, 0.88);
  backpack.castShadow = true;
  const spineRidge = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.18, 0.36), mats.heroBronze);
  spineRidge.position.set(0, 0.84, 1.12);
  spineRidge.castShadow = true;
  for (const sx of [-0.46, 0.46]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.58, 0.24), mats.darkJoint);
    vent.position.set(sx, 0.94, 1.12);
    const thrusterPod = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.36, 8), mats.barrelSteel);
    thrusterPod.rotation.x = 0.45;
    thrusterPod.position.set(sx, 0.36, 1.16);
    upperBody.add(vent, thrusterPod);
  }
  const reactorCore = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.08), mats.visorAmber);
  reactorCore.position.set(0, 0.84, 1.32);

  // Broad angular beveled pauldrons + spiked elbow guards + heavy forearms
  for (const s of [-1, 1] as const) {
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 1.48), mats.heroBronze);
    pauldron.position.set(s * 1.52, 1.04, 0);
    pauldron.rotation.z = -s * 0.18;
    pauldron.castShadow = true;
    const shoulderCap = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.28, 1.24), mats.darkJoint);
    shoulderCap.position.set(s * 1.56, 1.44, 0.04);
    shoulderCap.rotation.z = -s * 0.18;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.08, 0.72), mats.heroArmor);
    arm.position.set(s * 1.62, 0.2, -0.18);
    arm.castShadow = true;
    upperBody.add(pauldron, shoulderCap, arm);
  }

  // Twin tall shoulder-mounted rotary cannons (raised proudly above pauldrons like Ironwood poster!)
  const leftCannon = makeShoulderCannon(-1);
  leftCannon.group.position.set(-1.46, 1.88, -0.06);
  const rightCannon = makeShoulderCannon(1);
  rightCannon.group.position.set(1.46, 1.88, -0.06);

  // Translucent amber energy Brace Shield (RMB)
  const shieldGeo = new THREE.CylinderGeometry(2.6, 2.6, 2.6, 14, 1, true, Math.PI * 0.72, Math.PI * 0.56);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0xf5b942,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const braceShield = new THREE.Mesh(shieldGeo, shieldMat);
  braceShield.position.set(0, 0.6, -0.4);

  upperBody.add(chest, chestPlate, head, visor, backpack, spineRidge, reactorCore, leftCannon.group, rightCannon.group, braceShield);

  // Articulated heavy armored legs + blazing orange ankle thruster jets (like Ironwood poster!)
  const makeLeg = (side: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.78, 2.02, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.05, 0.82), mats.heroArmor);
    thigh.position.set(0, -0.45, -0.05);
    thigh.rotation.x = 0.18;
    thigh.castShadow = true;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.15, 0.94), mats.heroBronze);
    shin.position.set(0, -1.35, 0.12);
    shin.rotation.x = -0.12;
    shin.castShadow = true;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.34, 1.38), mats.darkJoint);
    foot.position.set(0, -1.85, -0.06);
    foot.castShadow = true;
    // Rear calf thruster nozzle + glowing flame cone!
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.34, 8), mats.barrelSteel);
    nozzle.rotation.x = Math.PI / 2.6;
    nozzle.position.set(0, -1.32, 0.62);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 8), mats.thrusterFlame);
    flame.rotation.x = Math.PI / 2.2;
    flame.position.set(0, -1.48, 1.05);
    leg.add(thigh, shin, foot, nozzle, flame);
    return { leg, flame };
  };
  const lLeg = makeLeg(-1);
  const rLeg = makeLeg(1);
  mechGroup.add(lLeg.leg, rLeg.leg);

  // ── B. SLEEK 6-WHEEL ARMORED BATMOBILE / COMBAT CAR RIG (matches Ironwood right-hand vehicle!) ──
  const carGroup = new THREE.Group();
  carGroup.visible = false;
  root.add(carGroup);

  const carChassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.58, 5.1), mats.carBody);
  carChassis.position.set(0, 0.72, 0.05);
  carChassis.castShadow = true;
  carChassis.receiveShadow = true;

  // Sloped stealth wedge cockpit canopy
  const carCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.48, 2.15), mats.carBody);
  carCanopy.position.set(0, 1.18, 0.32);
  carCanopy.rotation.x = -0.1;
  carCanopy.castShadow = true;

  // Tapered aggressive armored nose wedge + side cowl fins
  const carNose = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.36, 2.1), mats.carBody);
  carNose.position.set(0, 0.84, -1.78);
  carNose.rotation.x = 0.16;
  carNose.castShadow = true;

  const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.38, 1.45), mats.darkJoint);
  rearDeck.position.set(0, 1.1, 1.65);
  rearDeck.rotation.x = 0.14;

  // Signature glowing emerald-green dorsal reactor core recessed on roof!
  const carCore = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.56), mats.coreGreen);
  carCore.position.set(0, 1.44, 0.25);

  // Swept armored wheel-arch cowls & twin rear aero fins
  for (const sx of [-1.22, 1.22]) {
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 4.65), mats.carBody);
    fender.position.set(sx, 0.94, 0.05);
    fender.castShadow = true;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 1.15), mats.barrelSteel);
    fin.position.set(sx * 0.92, 1.3, 1.92);
    carGroup.add(fender, fin);
  }
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.1, 0.46), mats.barrelSteel);
  spoiler.position.set(0, 1.46, 2.38);

  // Twin low-profile hood autocannons in Car mode
  const carMuzzles: THREE.Object3D[] = [];
  for (const sx of [-0.64, 0.64]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.35, 8), mats.barrelSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(sx, 1.05, -2.05);
    const tip = new THREE.Object3D();
    tip.position.set(sx, 1.05, -2.75);
    carGroup.add(barrel, tip);
    carMuzzles.push(tip);
  }

  // 6 heavy armored wheels (3 per side — rugged wide 6x6 silhouette!)
  const carWheels: THREE.Object3D[] = [];
  for (const sx of [-1.36, 1.36]) {
    for (const wz of [-1.68, 0.08, 1.72]) {
      const w = makeWheel(0.62, 0.48);
      w.position.set(sx, 0.62, wz);
      carGroup.add(w);
      carWheels.push(w);
    }
  }

  carGroup.add(carChassis, carCanopy, carNose, rearDeck, carCore, spoiler);

  let currentMorph = 0;

  return {
    root,
    mechGroup,
    carGroup,
    upperBody,
    leftLeg: lLeg.leg,
    rightLeg: rLeg.leg,
    leftCannon,
    rightCannon,
    braceShield,
    thrusterLeft: lLeg.flame,
    thrusterRight: rLeg.flame,
    carWheels,
    carMuzzles,
    getMuzzleWorldPos(side: 0 | 1, out: THREE.Vector3) {
      if (currentMorph > 0.5) {
        return carMuzzles[side].getWorldPosition(out);
      }
      const c = side === 0 ? leftCannon : rightCannon;
      return c.flash.getWorldPosition(out);
    },
    updateVisuals(opts) {
      currentMorph = opts.morph;

      // Smooth mechanical transformation morph (0 = mech, 1 = 6-wheel car)
      const mechScale = Math.max(0.001, 1 - Math.max(0, (opts.morph - 0.18) / 0.72));
      const carScale = Math.max(0.001, Math.min(1, (opts.morph - 0.15) / 0.72));

      mechGroup.visible = opts.morph < 0.92;
      carGroup.visible = opts.morph > 0.12;

      // Squash/fold mech down into chassis during transform!
      mechGroup.scale.set(
        THREE.MathUtils.lerp(1, 1.18, opts.morph),
        mechScale,
        THREE.MathUtils.lerp(1, 1.45, opts.morph)
      );
      mechGroup.position.y = -opts.siege * 0.48 - opts.morph * 0.65;

      // Unfold 6-wheel car up from chassis
      carGroup.scale.set(carScale, THREE.MathUtils.lerp(0.35, 1, carScale), carScale);

      // Mech walking stride & Siege stance wide-brace
      const stride = Math.sin(opts.walkCycle) * 0.52 * opts.moveAmt * (1 - opts.siege * 0.7);
      lLeg.leg.rotation.x = stride;
      rLeg.leg.rotation.x = -stride;
      lLeg.leg.position.x = -0.78 - opts.siege * 0.25;
      rLeg.leg.position.x = 0.78 + opts.siege * 0.25;

      // Subtle mechanical torso bob
      upperBody.position.y = 2.4 + Math.abs(Math.cos(opts.walkCycle)) * 0.12 * opts.moveAmt;
      upperBody.rotation.y = THREE.MathUtils.clamp(opts.aimYawOffset, -0.75, 0.75);

      // Pitch shoulder cannons proudly forward/upward toward aim target + recoil kickback + spinning barrels!
      const pitch = THREE.MathUtils.clamp(opts.aimPitch + 0.24, -0.35, 0.58);
      leftCannon.group.rotation.x = pitch;
      rightCannon.group.rotation.x = pitch;
      leftCannon.group.position.z = -0.12 + opts.recoilL * 0.34;
      rightCannon.group.position.z = -0.12 + opts.recoilR * 0.34;

      if (opts.recoilL > 0.05) leftCannon.barrelCluster.rotation.z += opts.dt * 28;
      if (opts.recoilR > 0.05) rightCannon.barrelCluster.rotation.z -= opts.dt * 28;
      leftCannon.flashMat.opacity = opts.recoilL > 0.45 ? 0.95 : 0;
      rightCannon.flashMat.opacity = opts.recoilR > 0.45 ? 0.95 : 0;

      // Ankle thruster flare intensifies when moving or side-rolling!
      const thrustScale = opts.dashTimer > 0 ? 1.85 : opts.moveAmt > 0.15 ? 0.75 + Math.random() * 0.35 : 0.22;
      lLeg.flame.scale.set(1, thrustScale, 1);
      rLeg.flame.scale.set(1, thrustScale, 1);

      // Brace energy shield fade
      const sm = braceShield.material as THREE.MeshBasicMaterial;
      sm.opacity = THREE.MathUtils.lerp(sm.opacity, opts.bracing ? 0.38 : 0, 1 - Math.exp(-12 * opts.dt));

      // Spin 6 car wheels proportional to forward speed
      const wSpin = (opts.speed / 0.58) * opts.dt;
      for (const w of carWheels) w.rotation.x -= wSpin;
    },
  };
}

export type EnemyRig = {
  group: THREE.Group;
  upper: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  muzzle: THREE.Object3D;
  bodyMeshes: THREE.Mesh[];
};

/** Crimson & Gunmetal Enemy War Robot (matches distant red-armored enemy mechs in Ironwood!) */
export function buildEnemyMech(heavy = false): EnemyRig {
  const group = new THREE.Group();
  const s = heavy ? 1.24 : 1.0;
  group.scale.setScalar(s);
  group.add(makeShadow(3.6, 3.6));

  const bodyMeshes: THREE.Mesh[] = [];
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.05), mats.darkJoint);
  pelvis.position.y = 1.95;
  group.add(pelvis);

  const upper = new THREE.Group();
  upper.position.y = 2.25;
  group.add(upper);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.28, 1.38), mats.enemyDark);
  torso.position.y = 0.65;
  torso.castShadow = true;
  const redChest = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.82, 1.48), mats.enemyRed);
  redChest.position.y = 0.74;
  redChest.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.2), mats.visorRed);
  visor.position.set(0, 1.48, -0.58);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.48, 0.85), mats.enemyDark);
  head.position.set(0, 1.48, -0.1);
  head.castShadow = true;

  for (const side of [-1, 1] as const) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 1.15), mats.enemyRed);
    sh.position.set(side * 1.28, 0.92, 0);
    sh.castShadow = true;
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.8, 8), mats.barrelSteel);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(side * 1.32, 0.45, -0.95);
    gun.castShadow = true;
    upper.add(sh, gun);
    bodyMeshes.push(sh);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.6, -1.9);
  upper.add(torso, redChest, head, visor, muzzle);
  bodyMeshes.push(torso, redChest);

  const makeLeg = (side: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.68, 1.9, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.0, 0.7), mats.enemyDark);
    thigh.position.y = -0.45;
    thigh.castShadow = true;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.05, 0.78), mats.enemyRed);
    shin.position.set(0, -1.3, 0.08);
    shin.castShadow = true;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.3, 1.15), mats.darkJoint);
    foot.position.set(0, -1.78, -0.05);
    leg.add(thigh, shin, foot);
    return leg;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  group.add(leftLeg, rightLeg);

  return { group, upper, leftLeg, rightLeg, muzzle, bodyMeshes };
}

/** Allied 6-Wheel Robotic Combat Car (sleek low-slung dark Batmobile silhouette + green core!) */
export function buildAllyCar() {
  const group = new THREE.Group();
  group.add(makeShadow(3.8, 5.6));
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.54, 4.75), mats.carBody);
  hull.position.y = 0.66;
  hull.castShadow = true;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.34, 1.95), mats.carBody);
  nose.position.set(0, 0.78, -1.68);
  nose.rotation.x = 0.16;
  nose.castShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.44, 1.95), mats.carBody);
  top.position.set(0, 1.1, 0.25);
  top.rotation.x = -0.08;
  top.castShadow = true;
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.52), mats.coreGreen);
  core.position.set(0, 1.34, 0.22);
  for (const sx of [-1.14, 1.14]) {
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 4.3), mats.carBody);
    cowl.position.set(sx, 0.88, 0.04);
    cowl.castShadow = true;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.95), mats.barrelSteel);
    fin.position.set(sx * 0.9, 1.22, 1.82);
    group.add(cowl, fin);
  }
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.45, 8), mats.barrelSteel);
  gun.rotation.x = Math.PI / 2;
  gun.position.set(0, 1.18, -1.35);

  const wheels: THREE.Object3D[] = [];
  for (const sx of [-1.26, 1.26]) {
    for (const wz of [-1.52, 0.06, 1.56]) {
      const w = makeWheel(0.56, 0.42);
      w.position.set(sx, 0.56, wz);
      group.add(w);
      wheels.push(w);
    }
  }
  group.add(hull, nose, top, core, gun);
  return { group, wheels };
}

/** Allied Hover Combat Drone (spawned by [4] Support Squad) */
export function buildAllyDrone() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), mats.carBody);
  body.scale.set(1.2, 0.55, 1.4);
  body.castShadow = true;
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.42), mats.darkJoint);
  wingL.position.set(0, 0.05, 0);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mats.coreGreen);
  eye.position.set(0, 0.1, -0.58);
  group.add(body, wingL, eye);
  return group;
}

/** Deployable Autonomous Missile Pod ([5] Missile Pod) */
export function buildMissilePod() {
  const group = new THREE.Group();
  group.add(makeShadow(2.4, 2.4));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.65, 8), mats.darkJoint);
  base.position.y = 0.32;
  base.castShadow = true;
  const turret = new THREE.Group();
  turret.position.y = 1.05;
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.15), mats.heroBronze);
  rack.castShadow = true;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mats.visorAmber);
  beacon.position.y = 0.56;
  turret.add(rack, beacon);
  group.add(base, turret);
  return { group, turret };
}

/** Radiant Glowing Emerald Energy Core Loot Drop (just like the glowing green square on left of Ironwood poster!) */
export function buildEnergyCore() {
  const group = new THREE.Group();
  const cube = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), mats.coreGreen);
  cube.position.y = 0.9;
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x4ade80,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.position.y = 0.9;
  halo.scale.set(3.2, 3.2, 1);
  group.add(cube, halo);
  return { group, cube };
}

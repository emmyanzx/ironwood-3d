import * as THREE from "three";
import { createDesertSandTextures, createMesaRockTextures, createScorchCraterTexture } from "./textures";

export type MesaCollider = {
  x: number;
  z: number;
  radius: number;
  height: number;
};

export type TerrainHandles = {
  mesh: THREE.Mesh;
  mesas: MesaCollider[];
  arenaRadius: number;
  spawnCrater: (x: number, z: number, radius?: number) => void;
  clearCraters: () => void;
};

/**
 * Smooth multi-octave windswept desert dune heightfield.
 * Keeps a playable tactical basin near origin while rolling into dramatic dunes around it.
 */
export function getTerrainHeight(x: number, z: number): number {
  const d1 = Math.sin(x * 0.032 + z * 0.018) * 2.6;
  const d2 = Math.cos(z * 0.044 - x * 0.014) * 1.9;
  const ridge = Math.sin((x * 0.065 + z * 0.048) + Math.cos(x * 0.025) * 1.4) * 0.95;
  const micro = Math.sin(x * 0.14 - z * 0.11) * 0.22;

  const dist = Math.hypot(x, z);
  // Gently lift outer canyon rim past 110m so the battlefield feels nestled in a massive dune basin
  const rim = dist > 100 ? Math.pow((dist - 100) * 0.045, 1.8) * 3.8 : 0;
  // Slightly calm the spawn area around (0, 0)
  const calm = Math.min(1, 0.42 + dist / 45);

  return (d1 + d2 + ridge + micro) * calm + rim;
}

const _tmpN = new THREE.Vector3();
export function getTerrainNormal(x: number, z: number, target = _tmpN): THREE.Vector3 {
  const e = 0.65;
  const hL = getTerrainHeight(x - e, z);
  const hR = getTerrainHeight(x + e, z);
  const hD = getTerrainHeight(x, z - e);
  const hU = getTerrainHeight(x, z + e);
  return target.set(hL - hR, 2 * e, hD - hU).normalize();
}

export function buildBattlefieldTerrain(scene: THREE.Scene): TerrainHandles {
  const size = 340;
  const segs = 80; // Smooth rolling dunes at <half the GPU vertex/shadow cost on UHD 620!
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cTrough = new THREE.Color(0x8a654a);
  const cCrest = new THREE.Color(0xdba979);
  const tmpC = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);

    const t = THREE.MathUtils.clamp((y + 4.5) / 10.5, 0, 1);
    tmpC.copy(cTrough).lerp(cCrest, t);
    colors[i * 3] = tmpC.r;
    colors[i * 3 + 1] = tmpC.g;
    colors[i * 3 + 2] = tmpC.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const sand = createDesertSandTextures();
  const terrainMat = new THREE.MeshStandardMaterial({
    map: sand.map,
    bumpMap: sand.bumpMap,
    bumpScale: 0.14,
    roughnessMap: sand.roughnessMap,
    roughness: 0.96,
    metalness: 0.03,
    vertexColors: true,
  });

  const mesh = new THREE.Mesh(geo, terrainMat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Ancient Monolithic Desert Mesas & Ruined Outcrops (matching Ironwood's left & distant canyon silhouettes!)
  const rock = createMesaRockTextures();
  const rockMat = new THREE.MeshStandardMaterial({
    map: rock.map,
    bumpMap: rock.bumpMap,
    bumpScale: 0.35,
    roughness: 0.92,
    metalness: 0.06,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xb59573,
    map: rock.map,
    roughness: 0.95,
  });

  const mesaSpecs: { x: number; z: number; rx: number; rz: number; h: number; rot: number }[] = [
    // Prominent left-flank ancient ruins/mesas visible right at spawn (just like Ironwood poster!)
    { x: -29, z: -18, rx: 5.5, rz: 4.8, h: 4.8, rot: 0.3 },
    { x: -42, z: -38, rx: 7.4, rz: 6.0, h: 7.6, rot: -0.4 },
    { x: -34, z: -64, rx: 8.8, rz: 7.2, h: 9.2, rot: 0.65 },
    { x: -58, z: -86, rx: 12.0, rz: 9.5, h: 13.5, rot: 0.2 },
    // Right flank & distant battlefield cover
    { x: 38, z: -34, rx: 6.4, rz: 5.2, h: 6.4, rot: -0.25 },
    { x: 52, z: -72, rx: 10.5, rz: 8.4, h: 11.2, rot: 0.45 },
    { x: 18, z: -92, rx: 11.0, rz: 7.5, h: 10.5, rot: -0.5 },
    { x: -16, z: 46, rx: 6.8, rz: 5.8, h: 6.8, rot: 0.7 },
    { x: 44, z: 32, rx: 7.2, rz: 6.2, h: 7.4, rot: -0.35 },
    { x: -54, z: 16, rx: 8.5, rz: 7.0, h: 8.8, rot: 0.12 },
  ];

  const mesas: MesaCollider[] = [];
  for (const m of mesaSpecs) {
    const group = new THREE.Group();
    const baseY = getTerrainHeight(m.x, m.z);
    group.position.set(m.x, baseY - 1.2, m.z);
    group.rotation.y = m.rot;

    // Sculpted craggy ancient desert monolith (angular fractured cliff blocks + flat ruin slab!)
    const baseGeo = new THREE.BoxGeometry(m.rx * 1.85, m.h * 0.64, m.rz * 1.7, 3, 2, 3);
    const bp = baseGeo.attributes.position as THREE.BufferAttribute;
    for (let vi = 0; vi < bp.count; vi++) {
      const vx = bp.getX(vi);
      const vy = bp.getY(vi);
      const vz = bp.getZ(vi);
      const taper = vy > 0 ? 0.86 : 1.12;
      const crag = Math.sin(vx * 1.3 + vz * 0.9) * 0.42;
      bp.setXYZ(vi, vx * taper + crag, vy, vz * taper - crag * 0.7);
    }
    baseGeo.computeVertexNormals();
    const baseTier = new THREE.Mesh(baseGeo, rockMat);
    baseTier.position.y = m.h * 0.32;
    baseTier.castShadow = true;
    baseTier.receiveShadow = true;

    const upperTier = new THREE.Mesh(new THREE.BoxGeometry(m.rx * 1.48, m.h * 0.42, m.rz * 1.38), rockMat);
    upperTier.position.set(0.3, m.h * 0.78, -0.2);
    upperTier.rotation.y = 0.08;
    upperTier.castShadow = true;
    upperTier.receiveShadow = true;

    // Flat weathered sand-dusted ruin plateau cap + fractured corner bastions
    const cap = new THREE.Mesh(new THREE.BoxGeometry(m.rx * 1.56, 0.36, m.rz * 1.46), capMat);
    cap.position.set(0.3, m.h * 1.0, -0.2);
    cap.rotation.y = 0.08;
    cap.receiveShadow = true;

    const parapet = new THREE.Mesh(new THREE.BoxGeometry(m.rx * 0.95, 0.85, 0.65), rockMat);
    parapet.position.set(0.2, m.h * 1.08, m.rz * 0.42);
    parapet.castShadow = true;

    group.add(baseTier, upperTier, cap, parapet);
    scene.add(group);

    mesas.push({
      x: m.x,
      z: m.z,
      radius: Math.max(m.rx, m.rz) * 0.96,
      height: m.h,
    });
  }

  // Scattered small desert rock outcrops & dark metallic battlefield debris (InstancedMesh = 1 draw call!)
  const boulderGeo = new THREE.DodecahedronGeometry(0.65, 0);
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x262428, roughness: 0.62, metalness: 0.65 });
  const rockCount = 28;
  const metalCount = 14;
  const rockInst = new THREE.InstancedMesh(boulderGeo, rockMat, rockCount);
  const metalInst = new THREE.InstancedMesh(boulderGeo, debrisMat, metalCount);
  const dummy = new THREE.Object3D();
  let rIdx = 0;
  let mIdx = 0;
  for (let i = 0; i < 42; i++) {
    const ang = (i * 2.39996) % (Math.PI * 2);
    const dist = 8 + ((i * 19.7) % 88);
    const bx = Math.cos(ang) * dist;
    const bz = Math.sin(ang) * dist;
    const by = getTerrainHeight(bx, bz);
    const s = 0.45 + (i % 5) * 0.22;
    dummy.position.set(bx, by + s * 0.25, bz);
    dummy.scale.set(s * 1.2, s * 0.55, s);
    dummy.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    dummy.updateMatrix();
    if (i % 3 === 0 && mIdx < metalCount) {
      metalInst.setMatrixAt(mIdx++, dummy.matrix);
    } else if (rIdx < rockCount) {
      rockInst.setMatrixAt(rIdx++, dummy.matrix);
    }
  }
  rockInst.instanceMatrix.needsUpdate = true;
  metalInst.instanceMatrix.needsUpdate = true;
  scene.add(rockInst, metalInst);

  // Pre-allocated scorched crater pool (ZERO runtime allocations or GC spikes on explosions!)
  const craterTex = createScorchCraterTexture();
  const craterMat = new THREE.MeshBasicMaterial({
    map: craterTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    opacity: 0.86,
  });
  const craterGeo = new THREE.PlaneGeometry(1, 1);
  craterGeo.rotateX(-Math.PI / 2);
  const craterPool: THREE.Mesh[] = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(craterGeo, craterMat);
    m.visible = false;
    scene.add(m);
    craterPool.push(m);
  }
  let craterCursor = 0;
  const up = new THREE.Vector3(0, 1, 0);
  const nVec = new THREE.Vector3();

  function spawnCrater(x: number, z: number, radius = 3.2) {
    const m = craterPool[craterCursor];
    craterCursor = (craterCursor + 1) % craterPool.length;
    const y = getTerrainHeight(x, z);
    getTerrainNormal(x, z, nVec);
    m.position.set(x, y + 0.08, z);
    m.quaternion.setFromUnitVectors(up, nVec);
    m.rotateY(Math.random() * Math.PI * 2);
    m.scale.set(radius * 2, 1, radius * 2);
    m.visible = true;
  }

  function clearCraters() {
    for (const m of craterPool) m.visible = false;
    craterCursor = 0;
  }

  // Seed 2 subtle battle-worn craters ahead of spawn so the battlefield already feels lived-in!
  spawnCrater(1.5, -12, 3.6);
  spawnCrater(-9, -24, 2.8);

  return {
    mesh,
    mesas,
    arenaRadius: 118,
    spawnCrater,
    clearCraters,
  };
}

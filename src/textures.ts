import * as THREE from "three";

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function toTex(canvas: HTMLCanvasElement, isColor = true, repX = 1, repY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1K Windswept Ironwood Desert Sand Dunes (directional wind ripples + ochre/amber-umber tonal depth!) */
export function createDesertSandTextures() {
  const W = 512;
  const H = 512;
  const rand = mulberry32(7104);

  const col = makeCanvas(W, H);
  const bump = makeCanvas(W, H);
  const rough = makeCanvas(W, H);

  const colImg = col.ctx.createImageData(W, H);
  const bumpImg = bump.ctx.createImageData(W, H);
  const roughImg = rough.ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    const ny = (y / H) * Math.PI * 2;
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * Math.PI * 2;

      // Organic windswept curved desert sand ripples (subtle AAA grain — NO harsh zebra stripes!)
      const warp = Math.sin(nx * 1 + ny * 2) * 1.15 + Math.cos(nx * 2 - ny * 1) * 0.85;
      const r1 = Math.sin(ny * 7 + nx * 1.5 + warp * 1.6);
      const r2 = Math.sin(ny * 15 - nx * 2 + warp * 2.4) * 0.28;
      const macro = Math.sin(nx * 1 + ny * 1) * 0.45 + Math.cos(nx * 2 - ny * 2) * 0.35;
      const ripple = Math.max(0, Math.min(1, 0.5 + r1 * 0.22 + r2 * 0.1));

      const grain = (rand() - 0.5) * 16;
      // Rich Ironwood warm ochre-bronze sand with smooth organic tonal variation
      const cr = Math.min(255, Math.max(0, 152 + ripple * 26 + macro * 18 + grain));
      const cg = Math.min(255, Math.max(0, 110 + ripple * 20 + macro * 14 + grain * 0.85));
      const cb = Math.min(255, Math.max(0, 74 + ripple * 13 + macro * 9 + grain * 0.7));

      const bVal = Math.min(255, Math.max(0, Math.floor(110 + ripple * 115 + grain * 0.7)));
      // Subtle sparkling quartz sand micro-sheen
      const rgVal = Math.min(255, Math.max(165, Math.floor(236 - ripple * 34 + grain * 0.5)));

      const idx = (y * W + x) * 4;
      colImg.data[idx] = cr;
      colImg.data[idx + 1] = cg;
      colImg.data[idx + 2] = cb;
      colImg.data[idx + 3] = 255;

      bumpImg.data[idx] = bVal;
      bumpImg.data[idx + 1] = bVal;
      bumpImg.data[idx + 2] = bVal;
      bumpImg.data[idx + 3] = 255;

      roughImg.data[idx] = rgVal;
      roughImg.data[idx + 1] = rgVal;
      roughImg.data[idx + 2] = rgVal;
      roughImg.data[idx + 3] = 255;
    }
  }

  col.ctx.putImageData(colImg, 0, 0);
  bump.ctx.putImageData(bumpImg, 0, 0);
  rough.ctx.putImageData(roughImg, 0, 0);

  return {
    map: toTex(col.c, true, 14, 14),
    bumpMap: toTex(bump.c, false, 14, 14),
    roughnessMap: toTex(rough.c, false, 14, 14),
  };
}

/** Weathered stratified desert mesa sandstone / ancient ruin stone */
export function createMesaRockTextures() {
  const W = 512;
  const H = 512;
  const rand = mulberry32(4291);
  const col = makeCanvas(W, H);
  const bump = makeCanvas(W, H);

  col.ctx.fillStyle = "#6c6258";
  col.ctx.fillRect(0, 0, W, H);
  bump.ctx.fillStyle = "#808080";
  bump.ctx.fillRect(0, 0, W, H);

  // Geological strata layers
  for (let y = 0; y < H; y += 6) {
    const h = 4 + rand() * 14;
    const tone = 82 + Math.floor(rand() * 44);
    col.ctx.fillStyle = `rgb(${tone + 14}, ${tone + 6}, ${tone - 2})`;
    col.ctx.fillRect(0, y, W, h);
    const bv = 70 + Math.floor(rand() * 120);
    bump.ctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bump.ctx.fillRect(0, y, W, h);
  }

  // Cracks, chiseled masonry seams & sand-blown crevices
  for (let i = 0; i < 65; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const w = 16 + rand() * 88;
    const h = 8 + rand() * 34;
    col.ctx.fillStyle = rand() > 0.45 ? "rgba(42, 36, 34, 0.35)" : "rgba(182, 146, 108, 0.28)";
    col.ctx.fillRect(x, y, w, h);
    bump.ctx.strokeStyle = "rgba(30, 30, 30, 0.65)";
    bump.ctx.lineWidth = 2;
    bump.ctx.strokeRect(x, y, w, h);
  }

  // Wind-blown sand dust settling on upper strata
  const topDust = col.ctx.createLinearGradient(0, 0, 0, 120);
  topDust.addColorStop(0, "rgba(196, 152, 104, 0.62)");
  topDust.addColorStop(1, "rgba(196, 152, 104, 0)");
  col.ctx.fillStyle = topDust;
  col.ctx.fillRect(0, 0, W, 120);

  return {
    map: toTex(col.c, true, 2, 2),
    bumpMap: toTex(bump.c, false, 2, 2),
  };
}

/** Brushed military gunmetal armor plate texture with riveted panel lines & subtle desert dust */
export function createArmorPlateTextures(baseHex = "#343236", accentHex = "#574c42", seed = 88) {
  const W = 256;
  const H = 256;
  const rand = mulberry32(seed);
  const col = makeCanvas(W, H);
  const bump = makeCanvas(W, H);

  col.ctx.fillStyle = baseHex;
  col.ctx.fillRect(0, 0, W, H);
  bump.ctx.fillStyle = "#888888";
  bump.ctx.fillRect(0, 0, W, H);

  // Subtle metallic wear panels
  for (let i = 0; i < 18; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const w = 32 + rand() * 90;
    const h = 24 + rand() * 68;
    col.ctx.fillStyle = rand() > 0.5 ? "rgba(255,245,230,0.06)" : "rgba(10,10,12,0.16)";
    col.ctx.fillRect(x, y, w, h);
  }

  // Recessed armored plate seams & rivets
  col.ctx.strokeStyle = "rgba(12, 11, 14, 0.72)";
  col.ctx.lineWidth = 3;
  bump.ctx.strokeStyle = "#262626";
  bump.ctx.lineWidth = 4;
  for (const [px, py, pw, ph] of [
    [12, 12, 110, 110],
    [134, 12, 110, 110],
    [12, 134, 232, 110],
  ]) {
    col.ctx.strokeRect(px, py, pw, ph);
    bump.ctx.strokeRect(px, py, pw, ph);
    // Subtle edge highlight
    col.ctx.strokeStyle = accentHex;
    col.ctx.globalAlpha = 0.25;
    col.ctx.lineWidth = 1.5;
    col.ctx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
    col.ctx.globalAlpha = 1;
    col.ctx.strokeStyle = "rgba(12, 11, 14, 0.72)";
    col.ctx.lineWidth = 3;

    // Corner rivets
    for (const [rx, ry] of [
      [px + 8, py + 8],
      [px + pw - 8, py + 8],
      [px + 8, py + ph - 8],
      [px + pw - 8, py + ph - 8],
    ]) {
      bump.ctx.fillStyle = "#e6e6e6";
      bump.ctx.beginPath();
      bump.ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      bump.ctx.fill();
    }
  }

  // Light ochre sand scratches
  for (let i = 0; i < 240; i++) {
    col.ctx.fillStyle = `rgba(190, 146, 98, ${0.04 + rand() * 0.08})`;
    col.ctx.fillRect(rand() * W, rand() * H, 2 + rand() * 10, 1.5);
  }

  return {
    map: toTex(col.c, true),
    bumpMap: toTex(bump.c, false),
  };
}

/** Moody dusty overcast desert storm sky (matches Ironwood poster atmosphere!) */
export function createDesertSkyTexture() {
  const { c, ctx } = makeCanvas(64, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, "#3a3542"); // slate-violet storm zenith
  g.addColorStop(0.24, "#5d5260"); // dusty lavender-grey clouds
  g.addColorStop(0.41, "#8c7570"); // warm sandstorm haze
  g.addColorStop(0.51, "#b49178"); // sunlit amber-dust horizon
  g.addColorStop(0.57, "#694d38"); // dune bounce
  g.addColorStop(1.0, "#3b2a1e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft circular glow / smoke / spark sprite texture */
export function createSoftGlowTexture() {
  const { c, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.32, "rgba(255,244,225,0.68)");
  g.addColorStop(0.68, "rgba(255,220,185,0.18)");
  g.addColorStop(1, "rgba(255,200,160,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft radial ground contact shadow texture */
export function createContactShadowTexture() {
  const { c, ctx } = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 18, 128, 128, 122);
  g.addColorStop(0, "rgba(18, 12, 10, 0.78)");
  g.addColorStop(0.55, "rgba(18, 12, 10, 0.4)");
  g.addColorStop(1, "rgba(18, 12, 10, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Scorched battlefield blast crater decal */
export function createScorchCraterTexture() {
  const { c, ctx } = makeCanvas(256, 256);
  const rand = mulberry32(9912);
  const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 118);
  g.addColorStop(0, "rgba(18, 15, 14, 0.88)");
  g.addColorStop(0.45, "rgba(38, 30, 24, 0.56)");
  g.addColorStop(0.78, "rgba(72, 54, 38, 0.22)");
  g.addColorStop(1, "rgba(72, 54, 38, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Radial blast soot streaks
  ctx.save();
  ctx.translate(128, 128);
  for (let i = 0; i < 24; i++) {
    const a = rand() * Math.PI * 2;
    const len = 55 + rand() * 62;
    ctx.strokeStyle = `rgba(20, 16, 14, ${0.15 + rand() * 0.25})`;
    ctx.lineWidth = 2 + rand() * 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

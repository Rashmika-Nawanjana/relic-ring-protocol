import * as THREE from "three";

/** Procedural banded planet texture (Solar-System-3D style when JPGs unavailable). */
export function createPlanetTexture(
  baseColor: string,
  seed: number,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const base = new THREE.Color(baseColor);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  for (let y = 0; y < size; y++) {
    const lat = y / size;
    for (let x = 0; x < size; x++) {
      const noise =
        Math.sin(x * 0.04 + seed) * 0.5 +
        Math.sin(y * 0.08 + seed * 2) * 0.3 +
        Math.sin((x + y) * 0.02 + seed * 3) * 0.2;
      const l = THREE.MathUtils.clamp(hsl.l + noise * 0.12 - lat * 0.08, 0.05, 0.95);
      const c = new THREE.Color().setHSL(hsl.h, hsl.s * 0.85, l);
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBumpTexture(seed: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + Math.sin(i * 0.01 + seed) * 40;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export function createSunTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "#fffef0");
  g.addColorStop(0.35, "#ffe066");
  g.addColorStop(0.7, "#ff9500");
  g.addColorStop(1, "#cc4400");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

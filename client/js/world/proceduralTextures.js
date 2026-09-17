import * as THREE from 'three';

// All textures here are drawn procedurally on an off-screen canvas at load time -
// no external image files, so the game's look stays fully original.

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function makeBuildingFacadeTexture(baseColorHex, seed = 0) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const base = new THREE.Color(baseColorHex);

  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  // Subtle vertical panel seams for wall texture.
  ctx.strokeStyle = `rgba(0,0,0,0.08)`;
  ctx.lineWidth = 1;
  for (let x = 0; x <= size; x += size / 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  // Window grid - some lit (warm), most dark/reflective, a few blinds-closed.
  const cols = 6;
  const rows = 10;
  const padX = size / cols;
  const padY = size / rows;
  let rng = seed * 9301 + 49297;
  const rand = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const wx = col * padX + padX * 0.18;
      const wy = r * padY + padY * 0.22;
      const ww = padX * 0.64;
      const wh = padY * 0.56;
      const roll = rand();
      let color;
      if (roll < 0.12) color = 'rgba(255, 214, 130, 0.95)'; // lit window
      else if (roll < 0.24) color = 'rgba(180, 210, 225, 0.55)'; // reflective sky
      else color = 'rgba(10, 16, 22, 0.55)'; // dark glass
      ctx.fillStyle = color;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx, wy, ww, wh);
    }
  }

  // Slight AO darkening toward the base.
  const grad = ctx.createLinearGradient(0, size * 0.7, 0, size);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function makeGroundTexture() {
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a323a';
  ctx.fillRect(0, 0, size, size);

  // Speckled noise for asphalt grain.
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.random() * 22 - 11;
    ctx.fillStyle = `rgba(${255 + v},${255 + v},${255 + v},0.035)`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  // Faint expansion-joint grid (city block scale).
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  const cell = size / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
  }

  // Sparse lane-marking dashes for visual interest / orientation cues.
  ctx.strokeStyle = 'rgba(255, 214, 110, 0.35)';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 18]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.anisotropy = 4;
  return tex;
}

export function makeRampTexture(hexColor) {
  const size = 128;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const base = new THREE.Color(hexColor);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 6;
  for (let x = -size; x < size * 2; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, size);
    ctx.lineTo(x + size, 0);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

export function makeSkyGradientTexture(topHex, bottomHex) {
  const c = canvas(2);
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topHex);
  grad.addColorStop(0.55, bottomHex);
  grad.addColorStop(1, '#dff1e8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

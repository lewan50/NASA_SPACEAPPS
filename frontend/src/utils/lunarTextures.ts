import * as THREE from 'three';

/**
 * NASA LRO texture loader (SVS "CGI Moon Kit", svs.gsfc.nasa.gov/4720):
 *  - lroc_color_4k.jpg: LROC WAC color mosaic (4096x2048, equirectangular, 0° lon centered)
 *  - ldem_2k.png:       LOLA laser altimetry DEM (2880x1440 8-bit elevation, dithered)
 * A tangent-space normal map is derived from the DEM at load time (Sobel) so small
 * craters read crisply under the sun without inflating geometry resolution.
 * All are public-domain NASA data files served from /public/textures.
 *
 * Alignment note: three.js SphereGeometry puts the texture's horizontal center (u=0.5)
 * on the +X axis, but our selenographic convention places 0° longitude on +Z (u=0.25),
 * so all maps are shifted offset.x = +0.25 to keep landing pins registered with terrain.
 */
export async function loadLunarTextures(maxAnisotropy = 8): Promise<{
  colorMap: THREE.Texture;
  displacementMap: THREE.Texture;
  normalMap: THREE.Texture;
} | null> {
  const loader = new THREE.TextureLoader();
  const load = (url: string) =>
    new Promise<THREE.Texture>((resolve, reject) => loader.load(url, resolve, undefined, reject));

  try {
    const [colorMap, displacementMap] = await Promise.all([
      load('/textures/lroc_color_4k.jpg'),
      load('/textures/ldem_2k.png'),
    ]);

    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.minFilter = THREE.LinearMipmapLinearFilter;
    colorMap.magFilter = THREE.LinearFilter;
    for (const tex of [colorMap, displacementMap]) {
      tex.wrapS = THREE.RepeatWrapping; // offset shift wraps around
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.offset.x = 0.25; // register 0° lon (map center) with the +Z selenographic convention
      tex.anisotropy = maxAnisotropy;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
    }
    const normalMap = buildNormalMapFromDEM(displacementMap, maxAnisotropy);
    return { colorMap, displacementMap, normalMap };
  } catch {
    return null; // caller falls back to the procedural texture set
  }
}

/**
 * Sobel-derives a tangent-space normal map (OpenGL +Y convention) from the 8-bit
 * LOLA DEM. Sampling wraps horizontally so the seam stays continuous; the result
 * is a CanvasTexture sharing the DEM's offset/anisotropy settings.
 */
function buildNormalMapFromDEM(dem: THREE.Texture, anisotropy: number): THREE.CanvasTexture {
  const img = dem.image as HTMLImageElement;
  const w = img.width;
  const h = img.height;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const sctx = srcCanvas.getContext('2d')!;
  sctx.drawImage(img, 0, 0);
  const src = sctx.getImageData(0, 0, w, h).data;

  const heights = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) heights[i] = src[i * 4] / 255; // grayscale elevation in R

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const octx = outCanvas.getContext('2d')!;
  const out = octx.createImageData(w, h);

  const STRENGTH = 2.5; // relief exaggeration for shading
  const at = (x: number, y: number) => heights[((y + h) % h) * w + ((x + w) % w)];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * STRENGTH;
      // +1 in v (up) = -1 in image y, so green carries +dy (OpenGL-style normal map)
      const dy = (at(x, y + 1) - at(x, y - 1)) * STRENGTH;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const idx = (y * w + x) * 4;
      out.data[idx] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      out.data[idx + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
      out.data[idx + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      out.data[idx + 3] = 255;
    }
  }
  octx.putImageData(out, 0, 0);

  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.offset.x = 0.25;
  tex.anisotropy = anisotropy;
  return tex;
}

/**
 * Procedural High-Fidelity Lunar Surface Texture Generator (8K Ultra HD)
 * Generates 8192x4096 texture with enhanced crater detail, high-frequency noise,
 * and improved maria boundaries for beyond-4K rendering quality.
 */
export function createLunarTextures8K(showGraticule = false): {
  albedoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const width = 8192;
  const height = 4096;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const ctx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base Highlands with subtle gradient
  const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
  baseGrad.addColorStop(0, '#c7c4be');
  baseGrad.addColorStop(0.5, '#b5b2ac');
  baseGrad.addColorStop(1, '#cdc9c2');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, width, height);

  const coordToPixel = (lat: number, lon: number): [number, number] => {
    let normalizedLon = lon;
    if (normalizedLon > 180) normalizedLon -= 360;
    const x = ((normalizedLon + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  };

  // Maria definitions (scaled for 8K)
  interface MareDef {
    name: string;
    lat: number;
    lon: number;
    rx: number;
    ry: number;
    rot: number;
    darkness: number;
  }

  const maria: MareDef[] = [
    { name: 'Oceanus Procellarum', lat: 20, lon: -50, rx: 760, ry: 840, rot: -0.2, darkness: 0.42 },
    { name: 'Mare Imbrium', lat: 35, lon: -17, rx: 480, ry: 380, rot: 0.1, darkness: 0.40 },
    { name: 'Mare Serenitatis', lat: 28, lon: 18, rx: 300, ry: 260, rot: 0.0, darkness: 0.43 },
    { name: 'Mare Tranquillitatis', lat: 8, lon: 31, rx: 340, ry: 280, rot: 0.15, darkness: 0.38 },
    { name: 'Mare Crisium', lat: 17, lon: 59, rx: 220, ry: 180, rot: 0.0, darkness: 0.35 },
    { name: 'Mare Fecunditatis', lat: -4, lon: 52, rx: 280, ry: 300, rot: -0.1, darkness: 0.42 },
    { name: 'Mare Nectaris', lat: -15, lon: 35, rx: 180, ry: 160, rot: 0.0, darkness: 0.41 },
    { name: 'Mare Nubium', lat: -21, lon: -16, rx: 300, ry: 260, rot: -0.1, darkness: 0.40 },
    { name: 'Mare Humorum', lat: -24, lon: -38, rx: 180, ry: 160, rot: 0.0, darkness: 0.39 },
    { name: 'Mare Frigoris', lat: 56, lon: 1, rx: 720, ry: 100, rot: -0.05, darkness: 0.45 },
    { name: 'Mare Vaporum', lat: 13, lon: 4, rx: 140, ry: 120, rot: 0.0, darkness: 0.42 },
    { name: 'South Pole-Aitken Basin', lat: -53, lon: -169, rx: 880, ry: 640, rot: 0.1, darkness: 0.55 },
    { name: 'Mare Orientale', lat: -20, lon: -95, rx: 260, ry: 240, rot: 0.0, darkness: 0.46 },
    { name: 'Mare Moscoviense', lat: 27, lon: 148, rx: 140, ry: 120, rot: 0.0, darkness: 0.48 },
    { name: 'Mare Ingenii', lat: -34, lon: 163, rx: 160, ry: 140, rot: 0.0, darkness: 0.49 },
  ];

  maria.forEach((m) => {
    const [cx, cy] = coordToPixel(m.lat, m.lon);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(m.rot);
    const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, Math.max(m.rx, m.ry));
    const shade = Math.floor(m.darkness * 255);
    grad.addColorStop(0, `rgb(${shade}, ${shade - 2}, ${shade - 6})`);
    grad.addColorStop(0.65, `rgba(${shade + 20}, ${shade + 18}, ${shade + 14}, 0.85)`);
    grad.addColorStop(1, 'rgba(180, 178, 172, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    bCtx.save();
    bCtx.translate(cx, cy);
    bCtx.rotate(m.rot);
    const bGrad = bCtx.createRadialGradient(0, 0, 20, 0, 0, Math.max(m.rx, m.ry));
    bGrad.addColorStop(0, '#353535');
    bGrad.addColorStop(0.7, '#505050');
    bGrad.addColorStop(1, '#808080');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
    bCtx.fill();
    bCtx.restore();
  });

  // High-frequency micro-crater noise (8K resolution)
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const bData = bCtx.getImageData(0, 0, width, height);
  const bPixels = bData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 20;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    bPixels[i] = Math.min(255, Math.max(0, bPixels[i] + (Math.random() - 0.5) * 28));
    bPixels[i + 1] = bPixels[i];
    bPixels[i + 2] = bPixels[i];
  }
  ctx.putImageData(imgData, 0, 0);
  bCtx.putImageData(bData, 0, 0);

  // Prominent craters (scaled for 8K)
  interface CraterDef {
    name: string;
    lat: number;
    lon: number;
    r: number;
    hasRays?: boolean;
    rayLength?: number;
    rayCount?: number;
  }

  const craters: CraterDef[] = [
    { name: 'Tycho', lat: -43.3, lon: -11.2, r: 56, hasRays: true, rayLength: 1800, rayCount: 24 },
    { name: 'Copernicus', lat: 9.6, lon: -20.1, r: 64, hasRays: true, rayLength: 800, rayCount: 18 },
    { name: 'Kepler', lat: 8.1, lon: -38.0, r: 32, hasRays: true, rayLength: 400, rayCount: 12 },
    { name: 'Aristarchus', lat: 23.7, lon: -47.4, r: 36, hasRays: true, rayLength: 360, rayCount: 10 },
    { name: 'Plato', lat: 51.6, lon: -9.3, r: 56 },
    { name: 'Langrenus', lat: -8.9, lon: 61.0, r: 72 },
    { name: 'Theophilus', lat: -11.4, lon: 26.4, r: 64 },
    { name: 'Clavius', lat: -58.4, lon: -14.4, r: 104 },
    { name: 'Malapert', lat: -84.9, lon: 12.9, r: 48 },
    { name: 'Shackleton', lat: -89.9, lon: 0.0, r: 24 },
    { name: 'Schrödinger', lat: -75.0, lon: 132.5, r: 112 },
    { name: 'Tsiolkovskiy', lat: -20.4, lon: 129.1, r: 96 },
  ];

  craters.forEach((c) => {
    const [cx, cy] = coordToPixel(c.lat, c.lon);
    if (c.hasRays && c.rayLength && c.rayCount) {
      ctx.save();
      for (let j = 0; j < c.rayCount; j++) {
        const angle = (j / c.rayCount) * Math.PI * 2 + (Math.random() * 0.2 - 0.1);
        const len = c.rayLength * (0.7 + Math.random() * 0.6);
        const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        grad.addColorStop(0, 'rgba(245, 245, 240, 0.85)');
        grad.addColorStop(0.3, 'rgba(225, 225, 220, 0.4)');
        grad.addColorStop(1, 'rgba(200, 200, 195, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2 + Math.random() * 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = '#efede8';
    ctx.beginPath();
    ctx.arc(cx, cy, c.r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.name === 'Plato' ? '#3a3a3a' : '#5a5855';
    ctx.beginPath();
    ctx.arc(cx, cy, c.r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    if (c.r > 40 && c.name !== 'Plato') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    bCtx.save();
    bCtx.strokeStyle = '#d5d5d5';
    bCtx.lineWidth = 5;
    bCtx.beginPath();
    bCtx.arc(cx, cy, c.r, 0, Math.PI * 2);
    bCtx.stroke();
    bCtx.fillStyle = '#202020';
    bCtx.beginPath();
    bCtx.arc(cx, cy, c.r * 0.8, 0, Math.PI * 2);
    bCtx.fill();
    if (c.r > 40 && c.name !== 'Plato') {
      bCtx.fillStyle = '#f0f0f0';
      bCtx.beginPath();
      bCtx.arc(cx, cy, 5, 0, Math.PI * 2);
      bCtx.fill();
    }
    bCtx.restore();
  });

  if (showGraticule) {
    ctx.save();
    ctx.strokeStyle = 'rgba(70, 140, 230, 0.28)';
    ctx.lineWidth = 1.5;
    [-80, -60, -30, 0, 30, 60, 80].forEach((lat) => {
      const [, y] = coordToPixel(lat, 0);
      ctx.beginPath();
      ctx.setLineDash(lat === 0 ? [] : [6, 6]);
      ctx.strokeStyle = lat === 0 ? 'rgba(90, 180, 255, 0.65)' : 'rgba(70, 140, 230, 0.25)';
      ctx.lineWidth = lat === 0 ? 2 : 1.5;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = coordToPixel(0, lon);
      ctx.beginPath();
      ctx.setLineDash(lon === 0 ? [] : [6, 6]);
      ctx.strokeStyle = lon === 0 ? 'rgba(255, 180, 50, 0.7)' : 'rgba(70, 140, 230, 0.25)';
      ctx.lineWidth = lon === 0 ? 2 : 1.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.restore();
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { albedoMap, bumpMap };
}

/**
 * Procedural High-Fidelity Lunar Surface Texture Generator
 * Accurately models the major selenographical basaltic maria, highland terrains,
 * impact basins, ray systems (Tycho, Copernicus), and polar crater complexes.
 */
export function createLunarTextures(showGraticule = false): {
  albedoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const width = 2048;
  const height = 1024;

  // 1. Albedo Canvas
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const ctx = albedoCanvas.getContext('2d')!;

  // 2. Bump / Height Canvas (NASA LOLA simulation)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base Highlands (bright anorthositic crust)
  const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
  baseGrad.addColorStop(0, '#c7c4be'); // North pole
  baseGrad.addColorStop(0.5, '#b5b2ac'); // Equator
  baseGrad.addColorStop(1, '#cdc9c2'); // South pole
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  bCtx.fillStyle = '#808080'; // neutral 0 elevation
  bCtx.fillRect(0, 0, width, height);

  // Helper to map selenographic Lat/Lon to Canvas X/Y
  // Lon: -180 to +180 -> X: 0 to width (0° Lon is center = width/2)
  // Lat: +90 to -90 -> Y: 0 to height (+90° is top, -90° is bottom)
  const coordToPixel = (lat: number, lon: number): [number, number] => {
    let normalizedLon = lon;
    if (normalizedLon > 180) normalizedLon -= 360;
    const x = ((normalizedLon + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  };

  // Draw Maria (dark volcanic basaltic lava plains)
  interface MareDef {
    name: string;
    lat: number;
    lon: number;
    rx: number;
    ry: number;
    rot: number;
    darkness: number;
  }

  const maria: MareDef[] = [
    // Near Side Maria
    { name: 'Oceanus Procellarum', lat: 20, lon: -50, rx: 190, ry: 210, rot: -0.2, darkness: 0.42 },
    { name: 'Mare Imbrium', lat: 35, lon: -17, rx: 120, ry: 95, rot: 0.1, darkness: 0.40 },
    { name: 'Mare Serenitatis', lat: 28, lon: 18, rx: 75, ry: 65, rot: 0.0, darkness: 0.43 },
    { name: 'Mare Tranquillitatis', lat: 8, lon: 31, rx: 85, ry: 70, rot: 0.15, darkness: 0.38 },
    { name: 'Mare Crisium', lat: 17, lon: 59, rx: 55, ry: 45, rot: 0.0, darkness: 0.35 },
    { name: 'Mare Fecunditatis', lat: -4, lon: 52, rx: 70, ry: 75, rot: -0.1, darkness: 0.42 },
    { name: 'Mare Nectaris', lat: -15, lon: 35, rx: 45, ry: 40, rot: 0.0, darkness: 0.41 },
    { name: 'Mare Nubium', lat: -21, lon: -16, rx: 75, ry: 65, rot: -0.1, darkness: 0.40 },
    { name: 'Mare Humorum', lat: -24, lon: -38, rx: 45, ry: 40, rot: 0.0, darkness: 0.39 },
    { name: 'Mare Frigoris', lat: 56, lon: 1, rx: 180, ry: 25, rot: -0.05, darkness: 0.45 },
    { name: 'Mare Vaporum', lat: 13, lon: 4, rx: 35, ry: 30, rot: 0.0, darkness: 0.42 },
    // Far Side Basins
    { name: 'South Pole-Aitken Basin', lat: -53, lon: -169, rx: 220, ry: 160, rot: 0.1, darkness: 0.55 },
    { name: 'Mare Orientale', lat: -20, lon: -95, rx: 65, ry: 60, rot: 0.0, darkness: 0.46 },
    { name: 'Mare Moscoviense', lat: 27, lon: 148, rx: 35, ry: 30, rot: 0.0, darkness: 0.48 },
    { name: 'Mare Ingenii', lat: -34, lon: 163, rx: 40, ry: 35, rot: 0.0, darkness: 0.49 },
  ];

  maria.forEach((m) => {
    const [cx, cy] = coordToPixel(m.lat, m.lon);

    // Albedo draw
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(m.rot);
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, Math.max(m.rx, m.ry));
    const shade = Math.floor(m.darkness * 255);
    grad.addColorStop(0, `rgb(${shade}, ${shade - 2}, ${shade - 6})`);
    grad.addColorStop(0.65, `rgba(${shade + 20}, ${shade + 18}, ${shade + 14}, 0.85)`);
    grad.addColorStop(1, 'rgba(180, 178, 172, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bump draw (depressed elevation for maria: -2 to -4 km)
    bCtx.save();
    bCtx.translate(cx, cy);
    bCtx.rotate(m.rot);
    const bGrad = bCtx.createRadialGradient(0, 0, 5, 0, 0, Math.max(m.rx, m.ry));
    bGrad.addColorStop(0, '#353535'); // deep basin floor
    bGrad.addColorStop(0.7, '#505050');
    bGrad.addColorStop(1, '#808080');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
    bCtx.fill();
    bCtx.restore();
  });

  // Micro-crater noise texture across the highlands
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const bData = bCtx.getImageData(0, 0, width, height);
  const bPixels = bData.data;

  // Procedural grain & regolith micro-roughness
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 16;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));

    bPixels[i] = Math.min(255, Math.max(0, bPixels[i] + (Math.random() - 0.5) * 22));
    bPixels[i + 1] = bPixels[i];
    bPixels[i + 2] = bPixels[i];
  }
  ctx.putImageData(imgData, 0, 0);
  bCtx.putImageData(bData, 0, 0);

  // Prominent Impact Craters with Bright Ejecta Rays
  interface CraterDef {
    name: string;
    lat: number;
    lon: number;
    r: number;
    hasRays?: boolean;
    rayLength?: number;
    rayCount?: number;
  }

  const craters: CraterDef[] = [
    { name: 'Tycho', lat: -43.3, lon: -11.2, r: 14, hasRays: true, rayLength: 450, rayCount: 16 },
    { name: 'Copernicus', lat: 9.6, lon: -20.1, r: 16, hasRays: true, rayLength: 200, rayCount: 12 },
    { name: 'Kepler', lat: 8.1, lon: -38.0, r: 8, hasRays: true, rayLength: 100, rayCount: 8 },
    { name: 'Aristarchus', lat: 23.7, lon: -47.4, r: 9, hasRays: true, rayLength: 90, rayCount: 6 },
    { name: 'Plato', lat: 51.6, lon: -9.3, r: 14 },
    { name: 'Langrenus', lat: -8.9, lon: 61.0, r: 18 },
    { name: 'Theophilus', lat: -11.4, lon: 26.4, r: 16 },
    { name: 'Clavius', lat: -58.4, lon: -14.4, r: 26 },
    { name: 'Malapert', lat: -84.9, lon: 12.9, r: 12 },
    { name: 'Shackleton', lat: -89.9, lon: 0.0, r: 6 },
    { name: 'Schrödinger', lat: -75.0, lon: 132.5, r: 28 },
    { name: 'Tsiolkovskiy', lat: -20.4, lon: 129.1, r: 24 },
  ];

  craters.forEach((c) => {
    const [cx, cy] = coordToPixel(c.lat, c.lon);

    // Ejecta Rays (bright streaks)
    if (c.hasRays && c.rayLength && c.rayCount) {
      ctx.save();
      for (let j = 0; j < c.rayCount; j++) {
        const angle = (j / c.rayCount) * Math.PI * 2 + (Math.random() * 0.2 - 0.1);
        const len = c.rayLength * (0.7 + Math.random() * 0.6);
        const grad = ctx.createLinearGradient(
          cx,
          cy,
          cx + Math.cos(angle) * len,
          cy + Math.sin(angle) * len
        );
        grad.addColorStop(0, 'rgba(245, 245, 240, 0.85)');
        grad.addColorStop(0.3, 'rgba(225, 225, 220, 0.4)');
        grad.addColorStop(1, 'rgba(200, 200, 195, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5 + Math.random() * 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Crater Rim (bright elevated ridge)
    ctx.save();
    ctx.fillStyle = '#efede8';
    ctx.beginPath();
    ctx.arc(cx, cy, c.r + 2, 0, Math.PI * 2);
    ctx.fill();

    // Crater Floor (shadow/interior)
    ctx.fillStyle = c.name === 'Plato' ? '#3a3a3a' : '#5a5855';
    ctx.beginPath();
    ctx.arc(cx, cy, c.r * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Central Peak
    if (c.r > 10 && c.name !== 'Plato') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Bump Map: Rim is bright (+elevation), floor is dark (-elevation)
    bCtx.save();
    // Elevated rim
    bCtx.strokeStyle = '#d5d5d5';
    bCtx.lineWidth = 3;
    bCtx.beginPath();
    bCtx.arc(cx, cy, c.r, 0, Math.PI * 2);
    bCtx.stroke();

    // Sunken floor
    bCtx.fillStyle = '#202020';
    bCtx.beginPath();
    bCtx.arc(cx, cy, c.r * 0.8, 0, Math.PI * 2);
    bCtx.fill();

    // Central peak
    if (c.r > 10 && c.name !== 'Plato') {
      bCtx.fillStyle = '#f0f0f0';
      bCtx.beginPath();
      bCtx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      bCtx.fill();
    }
    bCtx.restore();
  });

  // Optional Selenographic Graticules (Latitude & Longitude Grid)
  if (showGraticule) {
    ctx.save();
    ctx.strokeStyle = 'rgba(70, 140, 230, 0.28)';
    ctx.lineWidth = 1;

    // Latitudes (-80, -60, -30, 0, 30, 60, 80)
    [-80, -60, -30, 0, 30, 60, 80].forEach((lat) => {
      const [, y] = coordToPixel(lat, 0);
      ctx.beginPath();
      ctx.setLineDash(lat === 0 ? [] : [4, 4]);
      ctx.strokeStyle = lat === 0 ? 'rgba(90, 180, 255, 0.65)' : 'rgba(70, 140, 230, 0.25)';
      ctx.lineWidth = lat === 0 ? 1.5 : 1;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    // Longitudes
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = coordToPixel(0, lon);
      ctx.beginPath();
      ctx.setLineDash(lon === 0 ? [] : [4, 4]);
      ctx.strokeStyle = lon === 0 ? 'rgba(255, 180, 50, 0.7)' : 'rgba(70, 140, 230, 0.25)';
      ctx.lineWidth = lon === 0 ? 1.5 : 1;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.restore();
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { albedoMap, bumpMap };
}

/**
 * Converts Selenographic Latitude and Longitude to 3D Cartesian Vector on a Sphere of radius R
 * Latitude: -90 (South Pole) to +90 (North Pole)
 * Longitude: 0° is Facing Earth, +90° East, -90° West
 */
export function selenographicToCartesian(lat: number, lon: number, radius = 2.0): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180; // polar angle from +Y
  let theta = (lon * Math.PI) / 180; // azimuthal angle around Y

  // Three.js spherical coordinate convention:
  // x = r * sin(phi) * sin(theta)
  // y = r * cos(phi)
  // z = r * sin(phi) * cos(theta)
  const x = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.cos(theta);

  return new THREE.Vector3(x, y, z);
}

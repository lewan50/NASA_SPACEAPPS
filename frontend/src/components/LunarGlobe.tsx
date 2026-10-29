import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { CLPSMission, AstroTelemetry } from '../types/mission';
import { createLunarTextures8K, loadLunarTextures, selenographicToCartesian } from '../utils/lunarTextures';
import { Compass, Eye, RotateCw, Globe, Zap, Sun, Radio, Mouse } from 'lucide-react';

/** Dispose a Three.js object tree to prevent GPU memory leaks. */
function disposeObjectTree(obj: THREE.Object3D) {
  if (obj instanceof THREE.Mesh) {
    obj.geometry?.dispose();
    if (Array.isArray(obj.material)) {
      obj.material.forEach((m) => m.dispose());
    } else if (obj.material) {
      obj.material.dispose();
    }
  }
  if (obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
    obj.geometry?.dispose();
    if (Array.isArray(obj.material)) {
      obj.material.forEach((m) => m.dispose());
    } else if (obj.material) {
      obj.material.dispose();
    }
  }
  while (obj.children.length > 0) {
    disposeObjectTree(obj.children[0]);
    obj.remove(obj.children[0]);
  }
}

interface LunarGlobeProps {
  missions: CLPSMission[];
  selectedMission: CLPSMission | null;
  onSelectMission: (mission: CLPSMission) => void;
  telemetry: AstroTelemetry | null;
}

export const LunarGlobe: React.FC<LunarGlobeProps> = ({
  missions,
  selectedMission,
  onSelectMission,
  telemetry,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const vectorsGroupRef = useRef<THREE.Group | null>(null);
  const graticuleGroupRef = useRef<THREE.Group | null>(null);

  // Camera animation target
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const arcTransitionRef = useRef<{
    active: boolean;
    from: THREE.Vector3;
    to: THREE.Vector3;
    progress: number;
    speed: number;
    fromSpherical?: THREE.Spherical;
    toSpherical?: THREE.Spherical;
    deltaTheta?: number;
    fromRadius?: number;
    toRadius?: number;
  }>({ active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), progress: 0, speed: 0.7 });

  // Controls state
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [showGraticule, setShowGraticule] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [activeViewMode, setActiveViewMode] = useState<'global' | 'northPole' | 'southPole' | 'nearSide' | 'farSide'>('global');
  const [texturesLoaded, setTexturesLoaded] = useState(false);

  // Fly camera smoothly toward target coordinate
  const flyToPosition = useCallback((targetPos: THREE.Vector3, lookAt = new THREE.Vector3(0, 0, 0)) => {
    targetCamPosRef.current = targetPos;
    targetLookAtRef.current = lookAt;
    arcTransitionRef.current.active = false;
  }, []);

  // Arc transition for orbital camera movement around the moon
  const arcToPosition = useCallback((targetPos: THREE.Vector3, lookAt = new THREE.Vector3(0, 0, 0)) => {
    if (!cameraRef.current) return;
    const fromPos = cameraRef.current.position.clone();
    const fromRadius = fromPos.length();
    const toRadius = targetPos.length();
    
    // Convert to spherical coordinates for smooth orbital interpolation
    const fromSpherical = new THREE.Spherical().setFromVector3(fromPos);
    const toSpherical = new THREE.Spherical().setFromVector3(targetPos);
    
    // Ensure we take the shortest path around the sphere
    let deltaTheta = toSpherical.theta - fromSpherical.theta;
    if (deltaTheta > Math.PI) deltaTheta -= 2 * Math.PI;
    if (deltaTheta < -Math.PI) deltaTheta += 2 * Math.PI;
    
    arcTransitionRef.current = {
      active: true,
      from: fromPos,
      to: targetPos.clone(),
      progress: 0,
      speed: 0.7,
      fromSpherical: fromSpherical,
      toSpherical: toSpherical,
      deltaTheta: deltaTheta,
      fromRadius: fromRadius,
      toRadius: toRadius,
    };
    targetLookAtRef.current = lookAt;
    targetCamPosRef.current = null;
  }, []);

  // Cubic ease-in-out for smooth acceleration/deceleration
  const easeInOutCubic = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // When a mission is selected, smoothly rotate camera to inspect the landing site.
  // Skip the initial mount: with a pre-selected mission we would otherwise start
  // zoomed into a surface close-up instead of the centered global view.
  const lastSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedMission || !cameraRef.current) return;
    const id = selectedMission.mission_id;
    if (lastSelectedIdRef.current === null) {
      // First render — adopt current mission without moving the camera
      lastSelectedIdRef.current = id;
      return;
    }
    if (lastSelectedIdRef.current === id) return;
    lastSelectedIdRef.current = id;

    const sitePos = selenographicToCartesian(
      selectedMission.coordinates.latitude,
      selectedMission.coordinates.longitude,
      2.0
    );

    // Camera rides the site's surface normal so the landing site sits at the
    // center of the visible disk, but the view pivots on the globe center so
    // the moon itself always stays framed and centered on screen.
    const camPos = sitePos.clone().normalize().multiplyScalar(6.0);
    // Slight oblique tilt for polar sites adds horizon depth without un-centering the globe
    if (Math.abs(selectedMission.coordinates.latitude) > 75) {
      camPos.y += selectedMission.coordinates.latitude < 0 ? -0.35 : 0.35;
    }
    flyToPosition(camPos, new THREE.Vector3(0, 0, 0));
  }, [selectedMission, flyToPosition]);

  // Update Sun Directional Light based on subsolar point
  useEffect(() => {
    if (telemetry && sunLightRef.current) {
      const sunVec = selenographicToCartesian(
        telemetry.subsolar_point.latitude,
        telemetry.subsolar_point.longitude,
        15.0
      );
      sunLightRef.current.position.copy(sunVec);
    }
  }, [telemetry]);

  // Toggle the lat/lon graticule line overlay (built once during scene init)
  useEffect(() => {
    if (graticuleGroupRef.current) {
      graticuleGroupRef.current.visible = showGraticule;
    }
  }, [showGraticule]);

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#030712');

    // 2. Camera
    // Distance ~6.5 frames the full moon with margin at 42° FOV (moon radius = 2.0)
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(4.1, 2.6, 5.1);
    // Aim at the moon center — without this the camera looks straight down -Z
    // and the moon renders offset from the viewport center.
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // WebGL Context Loss Recovery — prevent permanent blank canvas on GPU memory exhaustion
    const canvas = renderer.domElement;
    let animationPaused = false;
    const onContextLost = (event: Event) => {
      event.preventDefault(); // Required to allow context restoration
      animationPaused = true;
      console.warn('[LunarGlobe] WebGL context lost — pausing render loop');
    };
    const onContextRestored = () => {
      animationPaused = false;
      console.info('[LunarGlobe] WebGL context restored — resuming render loop');
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    // 4. Background Starfield — Enhanced Multi-layer: 4000+ stars, nebula clouds, improved Milky Way
    const starCount = 3500;
    const milkyWayCount = 1200;
    const nebulaCount = 400;
    const totalCount = starCount + milkyWayCount + nebulaCount;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(totalCount * 3);
    const starSizes = new Float32Array(totalCount);
    const starColors = new Float32Array(totalCount * 3);

    // Field stars with realistic size distribution (power-law magnitude)
    for (let i = 0; i < starCount; i++) {
      const radius = 60 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starPos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = radius * Math.cos(phi);

      const mag = Math.random();
      starSizes[i] = mag < 0.80 ? 0.3 + mag * 0.9 : 1.3 + Math.random() * 2.2;

      // Enhanced stellar color temperature with more variation
      const tint = Math.random();
      if (tint < 0.50) {
        // Blue-white (O/B type)
        starColors[i * 3] = 0.75 + tint * 0.25;
        starColors[i * 3 + 1] = 0.82 + tint * 0.18;
        starColors[i * 3 + 2] = 0.95 + tint * 0.05;
      } else if (tint < 0.75) {
        // Yellow-white (F/G type)
        starColors[i * 3] = 0.95;
        starColors[i * 3 + 1] = 0.88 + tint * 0.12;
        starColors[i * 3 + 2] = 0.65 + tint * 0.25;
      } else if (tint < 0.90) {
        // Orange (K type)
        starColors[i * 3] = 0.95;
        starColors[i * 3 + 1] = 0.60 + tint * 0.25;
        starColors[i * 3 + 2] = 0.35 + tint * 0.20;
      } else {
        // Red (M type)
        starColors[i * 3] = 0.95;
        starColors[i * 3 + 1] = 0.40 + tint * 0.20;
        starColors[i * 3 + 2] = 0.30 + tint * 0.15;
      }
    }

    // Enhanced Milky Way band: denser, more structured
    const milkyTilt = 63 * Math.PI / 180;
    const cosT = Math.cos(milkyTilt);
    const sinT = Math.sin(milkyTilt);
    for (let i = 0; i < milkyWayCount; i++) {
      const idx = starCount + i;
      const radius = 55 + Math.random() * 65;
      const theta = Math.random() * Math.PI * 2;
      // Tighter gaussian for more defined band
      const phi = Math.PI / 2 + (Math.random() + Math.random() + Math.random() - 1.5) * 0.18;

      let x = radius * Math.sin(phi) * Math.cos(theta);
      let y = radius * Math.sin(phi) * Math.sin(theta);
      let z = radius * Math.cos(phi);
      const ry = y * cosT - z * sinT;
      const rz = y * sinT + z * cosT;

      starPos[idx * 3] = x;
      starPos[idx * 3 + 1] = ry;
      starPos[idx * 3 + 2] = rz;

      starSizes[idx] = 0.12 + Math.random() * 0.50;
      // Bluish-white for Milky Way stars
      starColors[idx * 3] = 0.60 + Math.random() * 0.25;
      starColors[idx * 3 + 1] = 0.65 + Math.random() * 0.25;
      starColors[idx * 3 + 2] = 0.80 + Math.random() * 0.20;
    }

    // Nebula clouds: faint colored dust clouds
    for (let i = 0; i < nebulaCount; i++) {
      const idx = starCount + milkyWayCount + i;
      const radius = 70 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starPos[idx * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPos[idx * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPos[idx * 3 + 2] = radius * Math.cos(phi);

      starSizes[idx] = 2.0 + Math.random() * 4.0; // Large, diffuse
      // Nebula colors: blue, purple, teal
      const nebulaType = Math.random();
      if (nebulaType < 0.4) {
        starColors[idx * 3] = 0.30 + Math.random() * 0.20;
        starColors[idx * 3 + 1] = 0.40 + Math.random() * 0.30;
        starColors[idx * 3 + 2] = 0.70 + Math.random() * 0.30;
      } else if (nebulaType < 0.7) {
        starColors[idx * 3] = 0.50 + Math.random() * 0.30;
        starColors[idx * 3 + 1] = 0.30 + Math.random() * 0.20;
        starColors[idx * 3 + 2] = 0.70 + Math.random() * 0.30;
      } else {
        starColors[idx * 3] = 0.20 + Math.random() * 0.20;
        starColors[idx * 3 + 1] = 0.60 + Math.random() * 0.30;
        starColors[idx * 3 + 2] = 0.60 + Math.random() * 0.30;
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starVertShader = `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (250.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;
    const starFragShader = `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.05, d);
        float glow = smoothstep(0.5, 0.2, d) * 0.35;
        float alpha = core + glow;
        gl_FragColor = vec4(vColor * (core + glow * 0.5), alpha * 0.85);
      }
    `;
    const starMat = new THREE.ShaderMaterial({
      vertexShader: starVertShader,
      fragmentShader: starFragShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Bright star glow sprites (prominent "named" stars) — increased count
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const glowCtx = glowCanvas.getContext('2d')!;
    const grad = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.12, 'rgba(210,225,255,0.7)');
    grad.addColorStop(0.4, 'rgba(120,160,255,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    glowCtx.fillStyle = grad;
    glowCtx.fillRect(0, 0, 64, 64);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);

    for (let i = 0; i < 24; i++) {
      const radius = 62 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const spriteMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color: new THREE.Color().setHSL(0.55 + Math.random() * 0.20, 0.30 + Math.random() * 0.25, 0.75),
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.35 + Math.random() * 0.50,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
      );
      const s = 2.0 + Math.random() * 3.5;
      sprite.scale.set(s, s, s);
      scene.add(sprite);
    }

    // Shooting star system — occasional streaking across the sky
    interface ShootingStar {
      position: THREE.Vector3;
      direction: THREE.Vector3;
      speed: number;
      life: number;
      maxLife: number;
      line: THREE.Line;
    }
    const shootingStars: ShootingStar[] = [];
    let nextShootTime = 3 + Math.random() * 6;

    function spawnShootingStar() {
      const startRadius = 50 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const start = new THREE.Vector3(
        startRadius * Math.sin(phi) * Math.cos(theta),
        startRadius * Math.sin(phi) * Math.sin(theta),
        startRadius * Math.cos(phi),
      );
      const tangent = new THREE.Vector3(-Math.sin(theta), 0.2 + Math.random() * 0.3, Math.cos(theta)).normalize();
      const inward = start.clone().normalize().multiplyScalar(-0.25);
      const direction = tangent.add(inward).normalize();

      const trailLen = 3.5;
      const end = start.clone().add(direction.clone().multiplyScalar(-trailLen));
      const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
      const mat = new THREE.LineBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);

      shootingStars.push({
        position: start.clone(),
        direction,
        speed: 28 + Math.random() * 45,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.9,
        line,
      });
    }

    // 5. Lighting
    // Ambient light simulates deep-space earthshine and starlight
    const ambientLight = new THREE.AmbientLight('#242938', 0.28);
    scene.add(ambientLight);

    // Sun Directional Light
    const sunLight = new THREE.DirectionalLight('#ffffff', 2.3);
    sunLight.position.set(10, 0.4, 8);
    sunLight.castShadow = true;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Earthshine subtle fill from Earth-facing direction (Z+)
    const earthshine = new THREE.DirectionalLight('#4299e1', 0.18);
    earthshine.position.set(0, 0, 10);
    scene.add(earthshine);

    // 6. Moon Sphere Geometry & Material — Optimized for demo performance
    // 128 segments provides visually smooth curvature at all camera distances (2.4 to 12.0 units)
    // while reducing triangle count from 524K to 32K for better GPU fill rate
    const moonRadius = 2.0;
    const moonGeo = new THREE.SphereGeometry(moonRadius, 128, 128);
    const { albedoMap, bumpMap } = createLunarTextures8K(true);

    const moonMat = new THREE.MeshStandardMaterial({
      map: albedoMap,
      bumpMap: bumpMap,
      bumpScale: 0.045,
      roughness: 0.92,
      metalness: 0.04,
    });

    // Upgrade to real NASA imagery once loaded (SVS CGI Moon Kit: LROC color + LOLA DEM).
    // Procedural maps above serve as the instant first paint and the offline fallback.
    loadLunarTextures(renderer.capabilities.getMaxAnisotropy()).then((nasa) => {
      if (!nasa) return;

      // Dispose procedural 8K textures to free ~266MB RAM
      albedoMap.dispose();
      bumpMap.dispose();

      moonMat.map = nasa.colorMap;
      moonMat.displacementMap = nasa.displacementMap;
      moonMat.displacementScale = 0.05;
      moonMat.displacementBias = -0.025;
      moonMat.normalMap = nasa.normalMap;
      moonMat.normalScale = new THREE.Vector2(1.2, 1.2); // Enhanced normal strength for 8K
      moonMat.bumpMap = null;
      moonMat.bumpScale = 0;
      moonMat.needsUpdate = true;
      setTexturesLoaded(true);
    });

    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.name = 'Moon';
    scene.add(moonMesh);
    moonMeshRef.current = moonMesh;

    // Atmosphere / Lunar Exosphere limb glow
    const glowGeo = new THREE.SphereGeometry(moonRadius * 1.012, 48, 48);
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
          gl_FragColor = vec4(0.35, 0.65, 1.0, 1.0) * intensity * 0.4;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const limbGlow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(limbGlow);

    // Groups for markers & telemetry vectors
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    const vectorsGroup = new THREE.Group();
    scene.add(vectorsGroup);
    vectorsGroupRef.current = vectorsGroup;

    // Selenographic graticule: lat/lon line overlay (independent of the surface texture)
    const graticule = new THREE.Group();
    const gratMat = new THREE.LineBasicMaterial({ color: '#468ce6', transparent: true, opacity: 0.25 });
    const gratMajorLat = new THREE.LineBasicMaterial({ color: '#5ab4ff', transparent: true, opacity: 0.6 });
    const gratMajorLon = new THREE.LineBasicMaterial({ color: '#ffb432', transparent: true, opacity: 0.6 });
    const gratRadius = moonRadius + 0.005;
    [-80, -60, -30, 0, 30, 60, 80].forEach((lat) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        pts.push(selenographicToCartesian(lat, -180 + (i / 128) * 360, gratRadius));
      }
      graticule.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lat === 0 ? gratMajorLat : gratMat));
    });
    for (let lon = -180; lon < 180; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        pts.push(selenographicToCartesian(90 - (i / 128) * 180, lon, gratRadius));
      }
      const isMajor = lon === 0 || lon === -180;
      graticule.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), isMajor ? gratMajorLon : gratMat));
    }
    graticule.visible = showGraticule;
    scene.add(graticule);
    graticuleGroupRef.current = graticule;

    // 7. Mouse Orbit & Drag Interaction
    let isMouseDown = false;
    let previousPosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      previousPosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;

      const deltaX = e.clientX - previousPosition.x;
      const deltaY = e.clientY - previousPosition.y;

      // Orbit camera around center
      const rotSpeed = 0.005;
      const cam = cameraRef.current;
      if (cam) {
        // Spherical rotation around Y and local right axis
        const offset = cam.position.clone();
        const radius = offset.length();

        let theta = Math.atan2(offset.x, offset.z);
        let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

        theta -= deltaX * rotSpeed;
        phi -= deltaY * rotSpeed;
        phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi));

        offset.x = radius * Math.sin(phi) * Math.sin(theta);
        offset.y = radius * Math.cos(phi);
        offset.z = radius * Math.sin(phi) * Math.cos(theta);

        cam.position.copy(offset);
        cam.lookAt(targetLookAtRef.current);
      }

      previousPosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;
      if (!cam) return;
      const zoomSpeed = 0.0018;
      const dist = cam.position.length();
      const newDist = Math.max(2.4, Math.min(12.0, dist + e.deltaY * zoomSpeed * dist));
      cam.position.setLength(newDist);
    };

    // Raycast click detection on landing site markers
    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      if (markersGroupRef.current) {
        const intersects = raycaster.intersectObjects(markersGroupRef.current.children, true);
        if (intersects.length > 0) {
          let topObj: THREE.Object3D | null = intersects[0].object;
          while (topObj && !topObj.userData.mission) {
            topObj = topObj.parent;
          }
          if (topObj && topObj.userData.mission) {
            onSelectMission(topObj.userData.mission);
          }
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('click', onClick);

    // Resize Handler
    // ResizeObserver on the container (not just window resize): the canvas box changes
    // whenever the side drawers open/close, which does not emit a window resize event.
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 8. Render Animation Loop with Performance Optimization
    let animationFrameId: number;
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsCheckTime = performance.now();
    let currentFPS = 60;
    let qualityLevel = 1.0; // 1.0 = full quality, scales down if FPS drops

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (animationPaused) return; // Skip rendering during WebGL context loss
      const now = performance.now();
      const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;
      const time = now / 1000;

      // FPS monitoring and adaptive quality
      frameCount++;
      if (now - fpsCheckTime >= 1000) {
        currentFPS = frameCount;
        frameCount = 0;
        fpsCheckTime = now;
        // Adaptive quality: reduce work if FPS drops below 45
        if (currentFPS < 40) {
          qualityLevel = Math.max(0.5, qualityLevel - 0.1);
        } else if (currentFPS > 55 && qualityLevel < 1.0) {
          qualityLevel = Math.min(1.0, qualityLevel + 0.05);
        }
      }

      // Smooth camera slerp/lerp to target position with easing
      if (targetCamPosRef.current && camera) {
        const target = targetCamPosRef.current;
        const dist = camera.position.distanceTo(target);
        const lerpFactor = Math.min(0.12, dist * 0.08);
        camera.position.lerp(target, lerpFactor);
        camera.lookAt(targetLookAtRef.current);
        if (dist < 0.02) {
          targetCamPosRef.current = null;
        }
      }

      // Arc transition using spherical interpolation (orbits around moon)
      if (arcTransitionRef.current.active && camera && arcTransitionRef.current.fromSpherical && arcTransitionRef.current.toSpherical) {
        const arc = arcTransitionRef.current;
        arc.progress += delta * arc.speed;
        
        if (arc.progress >= 1) {
          arc.progress = 1;
          arc.active = false;
          camera.position.copy(arc.to);
        } else {
          const easedT = easeInOutCubic(arc.progress);
          
          // Spherical linear interpolation for smooth orbital path
          const currentPhi = THREE.MathUtils.lerp(arc.fromSpherical!.phi, arc.toSpherical!.phi, easedT);
          const currentTheta = arc.fromSpherical!.theta + (arc.deltaTheta! * easedT);
          const currentRadius = THREE.MathUtils.lerp(arc.fromRadius!, arc.toRadius!, easedT);
          
          // Convert back to Cartesian coordinates
          const spherical = new THREE.Spherical(currentRadius, currentPhi, currentTheta);
          camera.position.setFromSpherical(spherical);
        }
        camera.lookAt(targetLookAtRef.current);
      }

      // Auto rotation if enabled
      if (isAutoRotating && moonMeshRef.current && !targetCamPosRef.current) {
        moonMeshRef.current.rotation.y += delta * 0.05;
        if (markersGroupRef.current) markersGroupRef.current.rotation.y += delta * 0.05;
      }

      // Pulse marker rings (throttled by quality level)
      if (markersGroupRef.current && qualityLevel > 0.7) {
        markersGroupRef.current.children.forEach((child) => {
          const ring = child.getObjectByName('PulseRing');
          if (ring) {
            const scale = 1.0 + Math.sin(time * 3.5 + child.id) * 0.35;
            ring.scale.set(scale, scale, scale);
          }
        });
      }

      // Update shooting stars (reduced spawn rate at lower quality)
      nextShootTime -= delta;
      if (nextShootTime <= 0) {
        spawnShootingStar();
        nextShootTime = (5 + Math.random() * 12) / qualityLevel;
      }
      for (let si = shootingStars.length - 1; si >= 0; si--) {
        const ss = shootingStars[si];
        ss.life += delta;
        ss.position.add(ss.direction.clone().multiplyScalar(ss.speed * delta));

        const trailLen = 3.5;
        const end = ss.position.clone().add(ss.direction.clone().multiplyScalar(-trailLen));
        const posAttr = ss.line.geometry.attributes.position as THREE.BufferAttribute;
        posAttr.setXYZ(0, ss.position.x, ss.position.y, ss.position.z);
        posAttr.setXYZ(1, end.x, end.y, end.z);
        posAttr.needsUpdate = true;

        const lifeRatio = ss.life / ss.maxLife;
        (ss.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, 1.0 - lifeRatio * lifeRatio);

        if (ss.life >= ss.maxLife) {
          scene.remove(ss.line);
          ss.line.geometry.dispose();
          (ss.line.material as THREE.Material).dispose();
          shootingStars.splice(si, 1);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClick);
      resizeObserver.disconnect();

      // Comprehensive GPU resource cleanup — traverse entire scene graph
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              m.map?.dispose();
              m.bumpMap?.dispose();
              m.normalMap?.dispose();
              m.dispose();
            });
          } else if (obj.material) {
            obj.material.map?.dispose();
            obj.material.bumpMap?.dispose();
            obj.material.normalMap?.dispose();
            obj.material.dispose();
          }
        }
        if (obj instanceof THREE.Sprite) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              m.map?.dispose();
              m.dispose();
            });
          } else if (obj.material) {
            obj.material.map?.dispose();
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onSelectMission]);

  // Re-build 3D Landing Markers when missions or selection change
  useEffect(() => {
    const group = markersGroupRef.current;
    if (!group) return;

    // Clear previous — dispose geometries/materials to prevent GPU memory leaks
    while (group.children.length > 0) {
      disposeObjectTree(group.children[0]);
      group.remove(group.children[0]);
    }

    missions.forEach((mission) => {
      const isSelected = selectedMission?.mission_id === mission.mission_id;
      // Slight lift above the nominal sphere so pins stay visible over displaced LOLA terrain
      const pos = selenographicToCartesian(
        mission.coordinates.latitude,
        mission.coordinates.longitude,
        2.015
      );

      const markerObj = new THREE.Group();
      markerObj.userData = { mission };
      markerObj.position.copy(pos);

      // Orient marker upright relative to lunar sphere normal
      markerObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());

      // Colors:
      // Landed: Emerald Green (#10b981)
      // Candidate: Electric Cyan (#06b6d4) or Artemis Gold (#f59e0b)
      // Transit Anomaly: Orange (#f97316)
      let colorHex = '#06b6d4';
      if (mission.status === 'Landed') colorHex = '#10b981';
      else if (mission.status === 'Anomaly') colorHex = '#f97316';
      else if (mission.coordinates.latitude < -70) colorHex = '#38bdf8'; // Polar South

      // 1. Vertical Target Pin / Stem
      const pinHeight = isSelected ? 0.28 : 0.18;
      const stemGeo = new THREE.CylinderGeometry(0.006, 0.006, pinHeight, 8);
      const stemMat = new THREE.MeshBasicMaterial({ color: isSelected ? '#ffffff' : colorHex });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = pinHeight / 2;
      markerObj.add(stem);

      // 2. Beacon Sphere on Top
      const sphereRadius = isSelected ? 0.038 : 0.026;
      const sphereGeo = new THREE.SphereGeometry(sphereRadius, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: isSelected ? '#ffffff' : colorHex,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.y = pinHeight;
      markerObj.add(sphere);

      // 3. Pulsing Radar Ring
      const ringGeo = new THREE.RingGeometry(0.04, 0.055, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isSelected ? '#ffffff' : colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.9 : 0.65,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.name = 'PulseRing';
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.005; // just above surface
      markerObj.add(ring);

      group.add(markerObj);
    });
  }, [missions, selectedMission]);

  // Telemetry Vector Visualizers (Sun Beam & Earth Comm Vector)
  useEffect(() => {
    const vecGroup = vectorsGroupRef.current;
    if (!vecGroup) return;

    // Clear previous — dispose to prevent GPU memory leaks
    while (vecGroup.children.length > 0) {
      disposeObjectTree(vecGroup.children[0]);
      vecGroup.remove(vecGroup.children[0]);
    }

    if (!showVectors || !selectedMission || !telemetry) return;

    const sitePos = selenographicToCartesian(
      selectedMission.coordinates.latitude,
      selectedMission.coordinates.longitude,
      2.02
    );

    // 1. Direction to Sun (Golden Ray)
    const sunSubPos = selenographicToCartesian(
      telemetry.subsolar_point.latitude,
      telemetry.subsolar_point.longitude,
      1.0
    );
    const sunDir = sunSubPos.clone().normalize();
    const sunLineGeo = new THREE.BufferGeometry().setFromPoints([
      sitePos,
      sitePos.clone().add(sunDir.multiplyScalar(1.4)),
    ]);
    const sunLineMat = new THREE.LineDashedMaterial({
      color: '#facc15',
      dashSize: 0.08,
      gapSize: 0.04,
      linewidth: 2,
    });
    const sunLine = new THREE.Line(sunLineGeo, sunLineMat);
    sunLine.computeLineDistances();
    vecGroup.add(sunLine);

    // 2. Direction to Earth (Cyan Laser Vector)
    const earthSubPos = selenographicToCartesian(
      telemetry.subearth_point.latitude,
      telemetry.subearth_point.longitude,
      1.0
    );
    const earthDir = earthSubPos.clone().normalize();
    const isLOS = telemetry.earth_horizon.direct_los;
    const earthLineGeo = new THREE.BufferGeometry().setFromPoints([
      sitePos,
      sitePos.clone().add(earthDir.multiplyScalar(1.6)),
    ]);
    const earthLineMat = new THREE.LineBasicMaterial({
      color: isLOS ? '#38bdf8' : '#ef4444',
      linewidth: 2,
    });
    const earthLine = new THREE.Line(earthLineGeo, earthLineMat);
    vecGroup.add(earthLine);
  }, [selectedMission, telemetry, showVectors]);

  // View presets — all transitions use orbital arc around the moon
  const setView = (mode: 'global' | 'northPole' | 'southPole' | 'nearSide' | 'farSide') => {
    setActiveViewMode(mode);

    const targets: Record<string, THREE.Vector3> = {
      northPole: new THREE.Vector3(-0.55, 7.0, -1.1),
      southPole: new THREE.Vector3(0.55, -7.0, 1.1),
      nearSide: new THREE.Vector3(0, 0, 7.0),
      farSide: new THREE.Vector3(0, 0, -7.0),
      global: new THREE.Vector3(4.1, 2.6, 5.1),
    };

    const target = targets[mode];
    if (!target || !cameraRef.current) return;

    // Global view uses direct fly (oblique angle, always safe)
    // All other presets use orbital arc to avoid going through the moon
    if (mode === 'global') {
      flyToPosition(target, new THREE.Vector3(0, 0, 0));
    } else {
      // Always arc for pole/side views to ensure smooth orbital transition
      arcToPosition(target, new THREE.Vector3(0, 0, 0));
    }
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Texture Loading Indicator */}
      {!texturesLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-700/60 shadow-2xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            <div className="text-xs text-slate-300 font-medium">
              <div>Loading NASA LRO textures...</div>
              <div className="text-[10px] text-slate-500 mt-0.5">LROC color + LOLA elevation</div>
            </div>
          </div>
        </div>
      )}

      {/* Floating HUD View Presets Bar — centered top so sidebar never obstructs */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-2xl z-10 text-xs font-medium text-slate-200 max-w-[95vw]">
        <button
          onClick={() => setView('global')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 ${
            activeViewMode === 'global'
              ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-900/50'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
          title="Perspective Orbit View"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Global 3D</span>
        </button>

        <button
          onClick={() => setView('northPole')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 ${
            activeViewMode === 'northPole'
              ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-900/50'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
          title="North Pole Stereographic View"
        >
          <Compass className="w-3.5 h-3.5 text-sky-300" />
          <span className="hidden sm:inline">North Pole</span>
        </button>

        <button
          onClick={() => setView('southPole')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 ${
            activeViewMode === 'southPole'
              ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-900/50'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
          title="South Pole Stereographic View (Malapert, Shackleton, Nobile)"
        >
          <Compass className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden sm:inline">South Pole</span>
        </button>

        <button
          onClick={() => setView('nearSide')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 ${
            activeViewMode === 'nearSide'
              ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-900/50'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
          title="Near Side (Earth-Facing 0° Meridian)"
        >
          <Radio className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Near Side</span>
        </button>

        <button
          onClick={() => setView('farSide')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 ${
            activeViewMode === 'farSide'
              ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-900/50'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
          title="Far Side (Schrödinger Basin / South Pole-Aitken)"
        >
          <Eye className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">Far Side</span>
        </button>
      </div>

      {/* Layer Toggles Floating Right */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-2xl z-10 text-xs text-slate-300">
        <button
          onClick={() => setShowGraticule(!showGraticule)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all duration-150 ${
            showGraticule
              ? 'bg-slate-700/80 text-cyan-300 font-medium'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Toggle Lat/Lon Coordinate Grid"
        >
          <span className="font-mono text-[11px]">°N/°E</span>
          <span className="hidden sm:inline">Graticule</span>
        </button>

        <button
          onClick={() => setShowVectors(!showVectors)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all duration-150 ${
            showVectors
              ? 'bg-slate-700/80 text-amber-300 font-medium'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Toggle Sun and Earth telemetry vectors"
        >
          <Sun className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Vectors</span>
        </button>

        <button
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className={`p-1.5 rounded-lg transition-all duration-150 ${
            isAutoRotating
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Auto Planetary Rotation"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Subsolar & Subearth Telemetry Coordinates Stamp */}
      {telemetry && (
        <div className="absolute bottom-24 left-4 bg-slate-900/90 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-700/60 shadow-xl pointer-events-none">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold tracking-wider uppercase text-[10px] mb-2">
            <Zap className="w-3 h-3 animate-pulse" />
            <span>Ephemeris Reference</span>
            <span className="text-slate-500 font-normal normal-case tracking-normal ml-1">IAU Moon 2000</span>
          </div>
          <div className="space-y-1.5 text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="text-amber-400/90 text-[10px] w-20 shrink-0">Sub-Solar:</span>
              <span className="text-slate-200">
                {telemetry.subsolar_point.latitude > 0 ? '+' : ''}
                {telemetry.subsolar_point.latitude.toFixed(2)}°N,{' '}
                {telemetry.subsolar_point.longitude.toFixed(2)}°E
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400/90 text-[10px] w-20 shrink-0">Sub-Earth:</span>
              <span className="text-slate-200">
                {telemetry.subearth_point.latitude > 0 ? '+' : ''}
                {telemetry.subearth_point.latitude.toFixed(2)}°N,{' '}
                {telemetry.subearth_point.longitude.toFixed(2)}°E
              </span>
            </div>
          </div>
        </div>
      )}

      {/* NASA Data Attribution — public domain per NASA media guidelines, credit requested */}
      <div className="absolute bottom-[74px] left-4 text-[9px] text-slate-500/80 font-mono pointer-events-none bg-slate-900/60 px-2.5 py-1 rounded-md backdrop-blur-sm border border-slate-800/60">
        Surface imagery &amp; terrain: NASA LRO — LROC WAC + LOLA DEM (SVS CGI Moon Kit) • Public domain
      </div>

      {/* Mouse Orbit Instruction */}
      <div className="absolute bottom-4 right-4 text-[10px] text-slate-400/80 font-mono pointer-events-none bg-slate-900/60 px-2.5 py-1.5 rounded-md backdrop-blur-sm border border-slate-800/60 flex items-center gap-1.5">
        <Mouse className="w-3 h-3 text-slate-500" />
        <span>Drag to orbit • Scroll to zoom • Click pin to focus</span>
      </div>
    </div>
  );
};

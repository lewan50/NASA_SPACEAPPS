import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CLPSMission, AstroTelemetry } from '../types/mission';
import { createLunarTextures, selenographicToCartesian } from '../utils/lunarTextures';
import { Compass, Eye, RotateCw, Globe, Zap, Sun, Radio } from 'lucide-react';

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
  const controlsRef = useRef<OrbitControls | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const vectorsGroupRef = useRef<THREE.Group | null>(null);

  // Safe ref for onSelectMission callback to keep scene lifecycle decoupled
  const onSelectMissionRef = useRef(onSelectMission);
  useEffect(() => {
    onSelectMissionRef.current = onSelectMission;
  }, [onSelectMission]);

  // Camera animation target
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isFlyingRef = useRef(false);

  // Controls state
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [showGraticule, setShowGraticule] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [activeViewMode, setActiveViewMode] = useState<'global' | 'southPole' | 'nearSide' | 'farSide'>('global');

  // Fly camera smoothly toward target coordinate
  const flyToPosition = useCallback((targetPos: THREE.Vector3, lookAt = new THREE.Vector3(0, 0, 0)) => {
    targetCamPosRef.current = targetPos.clone();
    targetLookAtRef.current = lookAt.clone();
    isFlyingRef.current = true;
  }, []);

  // When a mission is selected by the user, smoothly rotate camera to inspect the landing site
  const prevMissionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedMission || !cameraRef.current) return;
    if (prevMissionIdRef.current === selectedMission.mission_id) return;

    // Avoid overriding default Global 3D view on first mount
    if (prevMissionIdRef.current === null) {
      prevMissionIdRef.current = selectedMission.mission_id;
      return;
    }
    prevMissionIdRef.current = selectedMission.mission_id;

    const sitePos = selenographicToCartesian(
      selectedMission.coordinates.latitude,
      selectedMission.coordinates.longitude,
      2.0
    );

    // Position camera along the normal vector from center through landing site at distance 3.8
    const camPos = sitePos.clone().normalize().multiplyScalar(3.8);
    // For steep polar regions, tilt camera slightly to give a dramatic 3D oblique horizon view
    if (Math.abs(selectedMission.coordinates.latitude) > 75) {
      camPos.y += selectedMission.coordinates.latitude < 0 ? -0.4 : 0.4;
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

  // Handle Graticule rebuild
  useEffect(() => {
    if (!moonMeshRef.current) return;
    const { albedoMap, bumpMap } = createLunarTextures(showGraticule);
    const material = moonMeshRef.current.material as THREE.MeshStandardMaterial;
    material.map = albedoMap;
    material.bumpMap = bumpMap;
    material.needsUpdate = true;
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
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(3.8, 2.4, 4.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls (freely interactive rotation and zoom around lunar center)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false; // keeps the lunar globe centered
    controls.minDistance = 2.4;
    controls.maxDistance = 14.0;
    controls.target.set(0, 0, 0);
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.0;
    controls.update();
    controlsRef.current = controls;

    // Stop any active programmatic camera fly transition on user touch/drag
    controls.addEventListener('start', () => {
      targetCamPosRef.current = null;
      isFlyingRef.current = false;
    });

    // 5. Background Starfield
    const starCount = 1800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 60 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starPos[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPos[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPos[i + 2] = radius * Math.cos(phi);

      const tint = Math.random();
      starColors[i] = 0.85 + tint * 0.15;
      starColors[i + 1] = 0.85 + tint * 0.15;
      starColors[i + 2] = 0.95 + tint * 0.05;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // 6. Lighting
    // Ambient light simulates deep-space earthshine and starlight
    const ambientLight = new THREE.AmbientLight('#242938', 0.28);
    scene.add(ambientLight);

    // Sun Directional Light
    const sunLight = new THREE.DirectionalLight('#ffffff', 2.8);
    sunLight.position.set(10, 0.4, 8);
    sunLight.castShadow = true;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Earthshine subtle fill from Earth-facing direction (Z+)
    const earthshine = new THREE.DirectionalLight('#4299e1', 0.18);
    earthshine.position.set(0, 0, 10);
    scene.add(earthshine);

    // 7. Moon Sphere Geometry & Material
    const moonRadius = 2.0;
    const moonGeo = new THREE.SphereGeometry(moonRadius, 64, 64);
    const { albedoMap, bumpMap } = createLunarTextures(true);

    const moonMat = new THREE.MeshStandardMaterial({
      map: albedoMap,
      bumpMap: bumpMap,
      bumpScale: 0.045,
      roughness: 0.92,
      metalness: 0.04,
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

    // 8. Raycast Click on Markers (discriminate from orbit drag)
    let pointerDownPos = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Ignore drag gestures

      const rect = renderer.domElement.getBoundingClientRect();
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
            onSelectMissionRef.current(topObj.userData.mission);
          }
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('click', onClick);

    // 9. ResizeObserver for dynamic drawer toggles & window changes
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // 10. Render Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth camera lerp during programmatic flight
      if (targetCamPosRef.current && isFlyingRef.current && camera) {
        camera.position.lerp(targetCamPosRef.current, 0.05);
        if (controlsRef.current) {
          controlsRef.current.target.lerp(targetLookAtRef.current, 0.05);
          controlsRef.current.update();
        } else {
          camera.lookAt(targetLookAtRef.current);
        }

        if (
          camera.position.distanceTo(targetCamPosRef.current) < 0.015 &&
          (!controlsRef.current || controlsRef.current.target.distanceTo(targetLookAtRef.current) < 0.015)
        ) {
          camera.position.copy(targetCamPosRef.current);
          if (controlsRef.current) {
            controlsRef.current.target.copy(targetLookAtRef.current);
            controlsRef.current.update();
          }
          targetCamPosRef.current = null;
          isFlyingRef.current = false;
        }
      } else if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Pulse marker rings
      if (markersGroupRef.current) {
        markersGroupRef.current.children.forEach((child) => {
          const ring = child.getObjectByName('PulseRing');
          if (ring) {
            const scale = 1.0 + Math.sin(time * 3.5 + child.id) * 0.35;
            ring.scale.set(scale, scale, scale);
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('click', onClick);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Re-build 3D Landing Markers when missions or selection change
  useEffect(() => {
    const group = markersGroupRef.current;
    if (!group) return;

    // Clear previous
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    missions.forEach((mission) => {
      const isSelected = selectedMission?.mission_id === mission.mission_id;
      const pos = selenographicToCartesian(
        mission.coordinates.latitude,
        mission.coordinates.longitude,
        2.0
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
      else if (mission.status === 'Transit Anomaly') colorHex = '#f97316';
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

    while (vecGroup.children.length > 0) {
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

  // Synchronize auto rotation with OrbitControls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotating;
      controlsRef.current.autoRotateSpeed = 1.0;
    }
  }, [isAutoRotating]);

  // View presets
  const setView = (mode: 'global' | 'southPole' | 'nearSide' | 'farSide') => {
    setActiveViewMode(mode);
    switch (mode) {
      case 'southPole':
        // Look directly up into South Pole from below, centered
        flyToPosition(new THREE.Vector3(0.001, -6.5, 0.001), new THREE.Vector3(0, 0, 0));
        break;
      case 'nearSide':
        // Centered on Earth-facing meridian (0° Lat, 0° Lon)
        flyToPosition(new THREE.Vector3(0, 0, 6.5), new THREE.Vector3(0, 0, 0));
        break;
      case 'farSide':
        // Centered on Far Side (0° Lat, 180° Lon)
        flyToPosition(new THREE.Vector3(0, 0, -6.5), new THREE.Vector3(0, 0, 0));
        break;
      case 'global':
      default:
        flyToPosition(new THREE.Vector3(3.8, 2.4, 4.8), new THREE.Vector3(0, 0, 0));
        break;
    }
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating HUD View Presets Bar */}
      <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-2xl z-10 text-xs font-medium text-slate-200">
        <button
          onClick={() => setView('global')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            activeViewMode === 'global' ? 'bg-cyan-600 text-white font-semibold shadow-md' : 'hover:bg-slate-800'
          }`}
          title="Perspective Orbit View"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Global 3D</span>
        </button>

        <button
          onClick={() => setView('southPole')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            activeViewMode === 'southPole' ? 'bg-cyan-600 text-white font-semibold shadow-md' : 'hover:bg-slate-800'
          }`}
          title="South Pole Stereographic View (Malapert, Shackleton, Nobile)"
        >
          <Compass className="w-3.5 h-3.5 text-amber-300" />
          <span>South Pole (Polar)</span>
        </button>

        <button
          onClick={() => setView('nearSide')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            activeViewMode === 'nearSide' ? 'bg-cyan-600 text-white font-semibold shadow-md' : 'hover:bg-slate-800'
          }`}
          title="Near Side (Earth-Facing 0° Meridian)"
        >
          <Radio className="w-3.5 h-3.5 text-blue-400" />
          <span>Near Side</span>
        </button>

        <button
          onClick={() => setView('farSide')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            activeViewMode === 'farSide' ? 'bg-cyan-600 text-white font-semibold shadow-md' : 'hover:bg-slate-800'
          }`}
          title="Far Side (Schrödinger Basin / South Pole-Aitken)"
        >
          <Eye className="w-3.5 h-3.5 text-purple-400" />
          <span>Far Side</span>
        </button>
      </div>

      {/* Layer Toggles Floating Right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-2xl z-10 text-xs text-slate-300">
        <button
          onClick={() => setShowGraticule(!showGraticule)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            showGraticule ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="Toggle Lat/Lon Coordinate Grid"
        >
          <span className="font-mono text-[11px]">°N/°E</span>
          <span>Graticule</span>
        </button>

        <button
          onClick={() => setShowVectors(!showVectors)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            showVectors ? 'bg-slate-700 text-amber-300' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="Toggle Sun and Earth telemetry vectors"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Vectors</span>
        </button>

        <button
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className={`p-1.5 rounded-lg transition-all ${
            isAutoRotating ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="Auto Planetary Rotation"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Subsolar & Subearth Telemetry Coordinates Stamp */}
      {telemetry && (
        <div className="absolute bottom-20 left-4 bg-slate-900/85 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 shadow-xl pointer-events-none flex flex-col gap-1 border-l-4 border-l-cyan-500">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold tracking-wider uppercase text-[10px]">
            <Zap className="w-3 h-3 animate-pulse" />
            <span>Ephemeris Horizon Reference (IAU Moon 2000)</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-400">
            <div>
              <span className="text-amber-400/90">Sub-Solar Point: </span>
              <span className="text-slate-200">
                {telemetry.subsolar_point.latitude > 0 ? '+' : ''}
                {telemetry.subsolar_point.latitude.toFixed(2)}°N, {telemetry.subsolar_point.longitude.toFixed(2)}°E
              </span>
            </div>
            <div>
              <span className="text-cyan-400/90">Sub-Earth Point: </span>
              <span className="text-slate-200">
                {telemetry.subearth_point.latitude > 0 ? '+' : ''}
                {telemetry.subearth_point.latitude.toFixed(2)}°N, {telemetry.subearth_point.longitude.toFixed(2)}°E
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mouse Orbit Instruction */}
      <div className="absolute bottom-4 right-4 text-[10px] text-slate-400/80 font-mono pointer-events-none bg-slate-900/60 px-2.5 py-1 rounded-md backdrop-blur-sm border border-slate-800/60">
        🖱️ Drag to orbit • Scroll to zoom • Click pin to focus
      </div>
    </div>
  );
};

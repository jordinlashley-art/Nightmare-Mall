import * as THREE from 'three';
import { getPortalLight } from '../core/lighting.js';
import { scene } from '../core/scene.js';
import { getPlayerPosition } from '../systems/player.js';
import { GameState, updateState } from '../systems/state.js';
import { onInteract } from '../systems/input.js';
import { hidePickupPrompt, showPickupPrompt } from '../ui/overlay.js';
import { startPlantSequence } from '../ui/plantUI.js';
import { triggerWinScreen } from '../ui/endScreens.js';

const DESTROY_DURATION_MS = 2000;
const WIN_DELAY_MS = 3000;
const MEMBRANE_SIZE = 256;
const MEMBRANE_CENTER = MEMBRANE_SIZE / 2;

const portalState = {
  group: null,
  membrane: null,
  membraneCtx: null,
  membraneTexture: null,
  corruption: null,
  particles: [],
  corruptionSpots: [],
  secondaryLight: null,
  animTime: 0,
  proximityActive: false,
  isDestroyed: false,
  playerNear: false,
  isPlanting: false,
  unregisterInteract: null,
  destroyFrameId: null,
  destroyTimeoutIds: [],
};

const portalCenterFlat = new THREE.Vector3(0, 0, 0);

export const PORTAL_CONFIG = {
  position: new THREE.Vector3(0, 2.5, 0),
  groundPosition: new THREE.Vector3(0, 0.01, 0),
  radius: 3.0,
  proximityRange: 3.0,
  activeRange: 10.0,
  particleCount: 20,
  corruptionCount: 10,
  pulseSpeedBase: 0.8,
  pulseSpeedActive: 1.8,
  orbitSpeedBase: 0.3,
  orbitSpeedActive: 0.8,
};

function disposeMaterial(material) {
  material.map?.dispose();
  material.dispose();
}

function disposeObject(object) {
  if (!object) {
    return;
  }

  object.parent?.remove(object);
  object.traverse?.((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial);
    } else if (child.material) {
      disposeMaterial(child.material);
    }
  });
}

function clearDestroyTimers() {
  if (portalState.destroyFrameId) {
    window.cancelAnimationFrame(portalState.destroyFrameId);
    portalState.destroyFrameId = null;
  }

  portalState.destroyTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  portalState.destroyTimeoutIds = [];
}

function scheduleDestroyTimeout(callback, delay) {
  const timeoutId = window.setTimeout(() => {
    portalState.destroyTimeoutIds = portalState.destroyTimeoutIds.filter((id) => id !== timeoutId);
    callback();
  }, delay);

  portalState.destroyTimeoutIds.push(timeoutId);
  return timeoutId;
}

function resetPortalState() {
  portalState.group = null;
  portalState.membrane = null;
  portalState.membraneCtx = null;
  portalState.membraneTexture = null;
  portalState.corruption = null;
  portalState.particles = [];
  portalState.corruptionSpots = [];
  portalState.secondaryLight = null;
  portalState.animTime = 0;
  portalState.proximityActive = false;
  portalState.isDestroyed = false;
  portalState.playerNear = false;
  portalState.isPlanting = false;
}

function clearPortalObjects() {
  clearDestroyTimers();
  portalState.unregisterInteract?.();
  portalState.unregisterInteract = null;

  disposeObject(portalState.group);
  disposeObject(portalState.membrane);
  disposeObject(portalState.corruption);
  portalState.particles.forEach(({ sprite }) => disposeObject(sprite));
  portalState.corruptionSpots.forEach((spot) => disposeObject(spot));

  if (portalState.secondaryLight) {
    portalState.secondaryLight.parent?.remove(portalState.secondaryLight);
    portalState.secondaryLight.dispose?.();
  }

  const portalLight = getPortalLight();

  if (portalLight) {
    portalLight.intensity = 0;
  }

  resetPortalState();
}

function createPortalFrame() {
  const frameGroup = new THREE.Group();
  frameGroup.position.copy(PORTAL_CONFIG.position);

  const torusGeo = new THREE.TorusGeometry(PORTAL_CONFIG.radius, 0.25, 8, 32);
  const torusMat = new THREE.MeshLambertMaterial({
    color: 0x1a0000,
    emissive: new THREE.Color(0x660000),
    emissiveIntensity: 1.2,
  });
  const mainTorus = new THREE.Mesh(torusGeo, torusMat);
  mainTorus.scale.set(1.0, 1.08, 1.0);
  frameGroup.add(mainTorus);

  const innerGeo = new THREE.TorusGeometry(PORTAL_CONFIG.radius * 0.85, 0.12, 6, 24);
  const innerMat = new THREE.MeshLambertMaterial({
    color: 0x330000,
    emissive: new THREE.Color(0x990000),
    emissiveIntensity: 1.5,
  });
  const innerTorus = new THREE.Mesh(innerGeo, innerMat);
  innerTorus.rotation.z = Math.PI / 8;
  innerTorus.rotation.x = Math.PI / 16;
  innerTorus.scale.set(0.95, 1.12, 1.0);
  frameGroup.add(innerTorus);

  const outerGeo = new THREE.TorusGeometry(PORTAL_CONFIG.radius * 1.1, 0.08, 5, 28);
  const outerMat = new THREE.MeshLambertMaterial({
    color: 0x0a0000,
    emissive: new THREE.Color(0x440000),
    emissiveIntensity: 0.8,
  });
  const outerTorus = new THREE.Mesh(outerGeo, outerMat);
  outerTorus.rotation.z = -Math.PI / 12;
  outerTorus.scale.set(1.12, 0.92, 1.0);
  frameGroup.add(outerTorus);

  frameGroup.rotation.y = 0;
  return frameGroup;
}

function createPortalMembrane() {
  const canvas = document.createElement('canvas');
  canvas.width = MEMBRANE_SIZE;
  canvas.height = MEMBRANE_SIZE;

  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const geo = new THREE.PlaneGeometry(PORTAL_CONFIG.radius * 2, PORTAL_CONFIG.radius * 2);
  const membrane = new THREE.Mesh(geo, mat);

  membrane.position.copy(PORTAL_CONFIG.position);
  portalState.membraneCtx = ctx;
  portalState.membraneTexture = texture;
  portalState.membrane = membrane;

  return membrane;
}

function drawMembraneNoise(ctx, animTime, isActive) {
  const strandCount = isActive ? 18 : 12;

  ctx.lineWidth = isActive ? 1.4 : 1;

  for (let i = 0; i < strandCount; i++) {
    const phase = animTime * (0.7 + i * 0.03) + i * 1.9;
    const radius = 26 + (i % 6) * 13;
    const startAngle = phase + Math.sin(phase * 0.6) * 0.8;
    const endAngle = startAngle + Math.PI * (0.45 + Math.sin(phase) * 0.15);
    const alpha = 0.08 + Math.sin(animTime * 1.6 + i) * 0.04;

    ctx.strokeStyle = `rgba(255, 34, 0, ${alpha})`;
    ctx.beginPath();
    ctx.arc(
      MEMBRANE_CENTER + Math.cos(phase) * 7,
      MEMBRANE_CENTER + Math.sin(phase * 1.2) * 7,
      radius,
      startAngle,
      endAngle,
    );
    ctx.stroke();
  }
}

function updateMembraneTexture(animTime, isActive) {
  const ctx = portalState.membraneCtx;

  if (!ctx || !portalState.membraneTexture) {
    return;
  }

  ctx.clearRect(0, 0, MEMBRANE_SIZE, MEMBRANE_SIZE);
  ctx.save();
  ctx.beginPath();
  ctx.arc(MEMBRANE_CENTER, MEMBRANE_CENTER, 120, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#0a0000';
  ctx.fillRect(0, 0, MEMBRANE_SIZE, MEMBRANE_SIZE);

  for (let i = 0; i < 3; i++) {
    const angle = animTime * (0.3 + i * 0.2) + i * Math.PI * 0.66;
    const x = MEMBRANE_CENTER + Math.cos(angle) * 40;
    const y = MEMBRANE_CENTER + Math.sin(angle) * 40;
    const gradient = ctx.createRadialGradient(x, y, 0, MEMBRANE_CENTER, MEMBRANE_CENTER, 120);
    const opacity = 0.4 + Math.sin(animTime + i) * 0.2;

    gradient.addColorStop(0, `rgba(255, ${20 + i * 10}, 0, ${opacity})`);
    gradient.addColorStop(0.5, `rgba(150, 0, 0, ${opacity * 0.5})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, MEMBRANE_SIZE, MEMBRANE_SIZE);
  }

  drawMembraneNoise(ctx, animTime, isActive);

  const voidGrad = ctx.createRadialGradient(
    MEMBRANE_CENTER,
    MEMBRANE_CENTER,
    0,
    MEMBRANE_CENTER,
    MEMBRANE_CENTER,
    60,
  );
  voidGrad.addColorStop(0, 'rgba(0,0,0,0.9)');
  voidGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = voidGrad;
  ctx.fillRect(0, 0, MEMBRANE_SIZE, MEMBRANE_SIZE);

  const edgeGrad = ctx.createRadialGradient(
    MEMBRANE_CENTER,
    MEMBRANE_CENTER,
    100,
    MEMBRANE_CENTER,
    MEMBRANE_CENTER,
    128,
  );
  const pulseVal = 0.5 + Math.sin(animTime * 2) * 0.3;

  edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(1, `rgba(255, 50, 0, ${pulseVal})`);
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, MEMBRANE_SIZE, MEMBRANE_SIZE);
  ctx.restore();
  portalState.membraneTexture.needsUpdate = true;
}

function createGroundCorruption() {
  const corrGeo = new THREE.CircleGeometry(8, 32);
  const corrMat = new THREE.MeshLambertMaterial({
    color: 0x1a0505,
    emissive: new THREE.Color(0x220000),
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.92,
  });
  const corruption = new THREE.Mesh(corrGeo, corrMat);

  corruption.rotation.x = -Math.PI / 2;
  corruption.position.copy(PORTAL_CONFIG.groundPosition);
  scene.add(corruption);
  portalState.corruption = corruption;

  for (let i = 0; i < PORTAL_CONFIG.corruptionCount; i++) {
    const angle = (i / PORTAL_CONFIG.corruptionCount) * Math.PI * 2;
    const radius = 5 + Math.random() * 2.5;
    const spotGeo = new THREE.SphereGeometry(0.1 + Math.random() * 0.15, 4, 3);
    const spotMat = new THREE.MeshBasicMaterial({
      color: 0xff1100,
      transparent: true,
      opacity: 0.3 + Math.random() * 0.4,
    });
    const spot = new THREE.Mesh(spotGeo, spotMat);

    spot.position.set(Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius);
    scene.add(spot);
    portalState.corruptionSpots.push(spot);
  }
}

function createParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;

  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 50, 0, 0.9)');
    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
  }

  return new THREE.CanvasTexture(canvas);
}

function createPortalParticles() {
  for (let i = 0; i < PORTAL_CONFIG.particleCount; i++) {
    const texture = createParticleTexture();
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const orbitRadius = PORTAL_CONFIG.radius * (0.8 + Math.random() * 0.6);
    const orbitSpeed = 0.2 + Math.random() * 0.4;
    const orbitOffset = Math.random() * Math.PI * 2;
    const orbitTilt = (Math.random() - 0.5) * 0.8;
    const scale = 0.1 + Math.random() * 0.2;

    sprite.scale.set(scale, scale, scale);
    scene.add(sprite);
    portalState.particles.push({
      sprite,
      orbitRadius,
      orbitSpeed,
      orbitOffset,
      orbitTilt,
      fadePhase: Math.random() * Math.PI * 2,
    });
  }
}

function getPortalDistance(playerPos) {
  portalCenterFlat.set(0, playerPos.y, 0);
  return playerPos.distanceTo(portalCenterFlat);
}

function showExplosiveRequiredHint() {
  showPickupPrompt('Find the explosive first.', '');
  scheduleDestroyTimeout(() => {
    if (!portalState.playerNear || !GameState.inventory.includes('EXPLOSIVE')) {
      hidePickupPrompt();
    }
  }, 2000);
}

function updatePortalPrompt(isNear, wasNear) {
  const hasExplosive = GameState.inventory.includes('EXPLOSIVE');

  if (isNear && !wasNear) {
    if (hasExplosive) {
      showPickupPrompt('EXPLOSIVE', 'Plant');
      portalState.proximityActive = true;
      return;
    }

    showExplosiveRequiredHint();
    portalState.proximityActive = false;
    return;
  }

  if (isNear && hasExplosive && !portalState.proximityActive && !portalState.isPlanting) {
    showPickupPrompt('EXPLOSIVE', 'Plant');
    portalState.proximityActive = true;
    return;
  }

  if (isNear && !hasExplosive && portalState.proximityActive) {
    showExplosiveRequiredHint();
    portalState.proximityActive = false;
    return;
  }

  if (!isNear && wasNear) {
    hidePickupPrompt();
    portalState.proximityActive = false;
  }
}

function updatePortalLight(isActive, pulseSpeed) {
  const portalLight = getPortalLight();

  if (!portalLight) {
    return;
  }

  const basePulse = portalState.isPlanting ? 4.5 : isActive ? 3.5 : 2.0;
  const pulseMag = portalState.isPlanting ? 0.5 : isActive ? 1.5 : 0.8;

  portalLight.color.setHex(0xff2200);
  portalLight.intensity = basePulse + Math.sin(portalState.animTime * pulseSpeed * 2) * pulseMag;

  if (portalState.secondaryLight) {
    portalState.secondaryLight.intensity = portalState.isPlanting
      ? 2.4
      : 1.2 + Math.sin(portalState.animTime * pulseSpeed * 1.5) * 0.3;
  }
}

function animateParticles(t, orbitSpeed) {
  portalState.particles.forEach((particle) => {
    const angle = particle.orbitOffset + t * particle.orbitSpeed * orbitSpeed;

    particle.sprite.position.set(
      Math.cos(angle) * particle.orbitRadius,
      PORTAL_CONFIG.position.y + Math.sin(angle * particle.orbitTilt) * 1.5,
      Math.sin(angle) * particle.orbitRadius,
    );
    particle.sprite.material.opacity = 0.4 + Math.sin(t * 2 + particle.fadePhase) * 0.3;
  });
}

function animateCorruptionSpots(t) {
  portalState.corruptionSpots.forEach((spot, index) => {
    spot.material.opacity = 0.3 + Math.sin(t * 1.5 + index * 0.8) * 0.2;
  });
}

function animateFrame(delta) {
  const frame = portalState.group?.children[0];

  if (!frame) {
    return;
  }

  frame.children[0].rotation.z += delta * 0.2;
  frame.children[1].rotation.z -= delta * 0.15;
  frame.children[2].rotation.z += delta * 0.1;
}

function removePortalAfterDestroy() {
  disposeObject(portalState.group);
  disposeObject(portalState.membrane);
  disposeObject(portalState.corruption);
  portalState.particles.forEach(({ sprite }) => disposeObject(sprite));
  portalState.corruptionSpots.forEach((spot) => disposeObject(spot));

  if (portalState.secondaryLight) {
    portalState.secondaryLight.parent?.remove(portalState.secondaryLight);
    portalState.secondaryLight.dispose?.();
    portalState.secondaryLight = null;
  }

  portalState.group = null;
  portalState.membrane = null;
  portalState.corruption = null;
  portalState.particles = [];
  portalState.corruptionSpots = [];
}

// Initializes the hell portal visuals, lights, and interaction hook.
function initPortal() {
  clearPortalObjects();

  const frame = createPortalFrame();
  const membrane = createPortalMembrane();
  const portalGroup = new THREE.Group();

  createGroundCorruption();
  createPortalParticles();
  updateMembraneTexture(0, false);
  portalGroup.add(frame);
  scene.add(portalGroup);
  scene.add(membrane);
  portalState.group = portalGroup;

  const portalLight = getPortalLight();

  if (portalLight) {
    portalLight.color.setHex(0xff2200);
    portalLight.position.set(0, 2, 0);
    portalLight.intensity = 2.5;
  }

  portalState.secondaryLight = new THREE.PointLight(0x660000, 1.5, 10, 2);
  portalState.secondaryLight.position.set(0, 0.5, 0);
  scene.add(portalState.secondaryLight);

  portalState.unregisterInteract = onInteract(async () => {
    if (
      !portalState.playerNear
      || portalState.isDestroyed
      || portalState.isPlanting
      || !GameState.inventory.includes('EXPLOSIVE')
    ) {
      return;
    }

    portalState.isPlanting = true;
    hidePickupPrompt();

    const planted = await startPlantSequence();

    if (planted) {
      destroyPortal();
      return;
    }

    portalState.isPlanting = false;
  });
}

// Updates portal proximity, canvas membrane animation, light pulses, and orbiting particles.
function updatePortal(delta) {
  if (!portalState.group || portalState.isDestroyed) {
    return;
  }

  portalState.animTime += delta;

  const playerPos = getPlayerPosition();
  const distToPortal = getPortalDistance(playerPos);
  const wasNear = portalState.playerNear;
  const isNear = distToPortal < PORTAL_CONFIG.proximityRange;
  const isActive = portalState.isPlanting || distToPortal < PORTAL_CONFIG.activeRange;

  portalState.playerNear = isNear;
  updatePortalPrompt(isNear, wasNear);

  const pulseSpeed = isActive
    ? PORTAL_CONFIG.pulseSpeedActive
    : PORTAL_CONFIG.pulseSpeedBase;
  const orbitSpeed = isActive
    ? PORTAL_CONFIG.orbitSpeedActive
    : PORTAL_CONFIG.orbitSpeedBase;

  if (portalState.membrane?.material) {
    portalState.membrane.material.opacity = 0.85 + Math.sin(portalState.animTime * pulseSpeed) * 0.15;
  }

  updateMembraneTexture(portalState.animTime * pulseSpeed, isActive);
  updatePortalLight(isActive, pulseSpeed);
  animateParticles(portalState.animTime, orbitSpeed);
  animateCorruptionSpots(portalState.animTime);
  animateFrame(delta);
}

// Closes and removes the portal before handing off to the win screen.
function destroyPortal() {
  if (portalState.isDestroyed) {
    return;
  }

  portalState.isDestroyed = true;
  portalState.isPlanting = false;
  hidePickupPrompt();
  updateState({ explosivesPlanted: true });

  const portalLight = getPortalLight();
  const startIntensity = portalLight?.intensity ?? 0;
  const startSecondaryIntensity = portalState.secondaryLight?.intensity ?? 0;
  const startedAt = performance.now();

  function animateClose(now) {
    const progress = Math.min(1, (now - startedAt) / DESTROY_DURATION_MS);
    const ease = 1 - Math.pow(1 - progress, 3);
    const scale = Math.max(0.001, 1 - ease);
    const opacity = 1 - ease;

    portalState.group?.scale.setScalar(scale);

    if (portalState.membrane?.material) {
      portalState.membrane.material.opacity = 0.85 * opacity;
      portalState.membrane.scale.setScalar(scale);
    }

    portalState.particles.forEach(({ sprite }) => {
      sprite.material.opacity = Math.min(sprite.material.opacity, opacity);
      sprite.scale.multiplyScalar(0.985);
    });
    portalState.corruptionSpots.forEach((spot) => {
      spot.material.opacity = Math.min(spot.material.opacity, opacity * 0.4);
    });

    if (portalState.corruption?.material) {
      portalState.corruption.material.opacity = 0.92 * opacity;
    }

    if (portalLight) {
      portalLight.intensity = startIntensity * opacity;
    }

    if (portalState.secondaryLight) {
      portalState.secondaryLight.intensity = startSecondaryIntensity * opacity;
    }

    if (progress < 1) {
      portalState.destroyFrameId = window.requestAnimationFrame(animateClose);
      return;
    }

    portalState.destroyFrameId = null;
    removePortalAfterDestroy();
  }

  portalState.destroyFrameId = window.requestAnimationFrame(animateClose);
  scheduleDestroyTimeout(removePortalAfterDestroy, DESTROY_DURATION_MS);
  scheduleDestroyTimeout(triggerWinScreen, WIN_DELAY_MS);
}

// Rebuilds the portal from a clean state for a new run.
function resetPortal() {
  clearPortalObjects();
  initPortal();
}

export {
  destroyPortal,
  initPortal,
  resetPortal,
  updatePortal,
};

import * as THREE from 'three';
import { camera } from '../core/camera.js';
import { scene } from '../core/scene.js';
import { toggleFlashlight } from '../core/lighting.js';
import { setUseHintContext, updateFearMeter, updateQuickSlots } from '../ui/hud.js';
import { showNotification } from '../ui/notification.js';
import { alertDemon, getDemonPosition } from '../world/demon.js';
import { collisionObjects } from '../world/environment.js';
import { triggerRadioDistraction } from './detection.js';
import { getPlayerDirection, getPlayerPosition, getPlayerState } from './player.js';
import { GameState, ITEM_TYPES, updateState } from './state.js';

const CLIMB_HEIGHT = 3.5;
const STAND_HEIGHT = 1.7;
const RADIO_DURATION = 6.0;
const LIGHTER_DETECTION_RANGE = 6;
const CLIMB_RADIUS = 2.0;
const DROP_RADIUS = 1.5;
const MALL_MIN = -43;
const MALL_MAX = 43;

const actionState = {
  lighterLight: null,
  lighterOn: false,
  radioObject: null,
  radioTimer: 0,
  walkwayMesh: null,
  walkwayAdded: false,
  isClimbing: false,
  climbPoint: new THREE.Vector3(-8, 0, -18),
  dropPoint: new THREE.Vector3(-8, CLIMB_HEIGHT, 18),
  climbMarker: null,
  heightTransition: null,
};

function removeObject(object) {
  if (!object) {
    return;
  }

  object.parent?.remove(object);
}

function disposeObject(object) {
  if (!object) {
    return;
  }

  object.traverse?.((child) => {
    child.geometry?.dispose();

    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material?.dispose();
    }
  });
  removeObject(object);
}

function removeCollisionObject(mesh) {
  const index = collisionObjects.findIndex((entry) => entry.mesh === mesh);

  if (index !== -1) {
    collisionObjects.splice(index, 1);
  }
}

function resetSlotGlows() {
  document.querySelectorAll('.slot').forEach((slot) => {
    slot.style.removeProperty('border-color');
    slot.style.removeProperty('box-shadow');
  });
}

function clearActionObjects() {
  removeCollisionObject(actionState.walkwayMesh);
  disposeObject(actionState.radioObject);
  disposeObject(actionState.climbMarker);
  disposeObject(actionState.walkwayMesh);
  removeObject(actionState.lighterLight);

  actionState.lighterLight = null;
  actionState.lighterOn = false;
  actionState.radioObject = null;
  actionState.radioTimer = 0;
  actionState.walkwayMesh = null;
  actionState.walkwayAdded = false;
  actionState.isClimbing = false;
  actionState.climbMarker = null;
  actionState.heightTransition = null;
}

function createClimbPointMarker() {
  const markerGroup = new THREE.Group();

  markerGroup.position.copy(actionState.climbPoint);
  markerGroup.position.y = 0.3;

  const coilGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
  const coilMat = new THREE.MeshLambertMaterial({
    color: 0x886644,
    emissive: new THREE.Color(0x443322),
    emissiveIntensity: 0.5,
  });
  const coil = new THREE.Mesh(coilGeo, coilMat);

  markerGroup.add(coil);

  const ringGeo = new THREE.TorusGeometry(0.15, 0.04, 6, 12);
  const ring = new THREE.Mesh(ringGeo, coilMat);

  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  markerGroup.add(ring);

  const climbLight = new THREE.PointLight(0x886644, 0.5, 2, 2);

  markerGroup.add(climbLight);
  markerGroup.visible = false;
  scene.add(markerGroup);
  actionState.climbMarker = markerGroup;
}

function createRaisedWalkway() {
  const walkGeo = new THREE.BoxGeometry(1.5, 0.2, 36);
  const walkMat = new THREE.MeshLambertMaterial({
    color: 0x1a1a1a,
    emissive: new THREE.Color(0x050505),
    emissiveIntensity: 0.3,
  });
  const walkway = new THREE.Mesh(walkGeo, walkMat);

  walkway.position.set(-8, 3.4, 0);
  walkway.receiveShadow = true;
  walkway.visible = false;
  scene.add(walkway);
  collisionObjects.push({
    mesh: walkway,
    box: new THREE.Box3().setFromObject(walkway),
  });
  actionState.walkwayMesh = walkway;
}

function getSlot(slotIndex) {
  return document.querySelectorAll('.slot')[slotIndex] ?? null;
}

function flashSlot(slotIndex, color) {
  const slot = getSlot(slotIndex);

  if (!slot) {
    return;
  }

  slot.style.borderColor = color;
  slot.style.boxShadow = `0 0 12px ${color}`;

  window.setTimeout(() => {
    slot.style.removeProperty('border-color');
    slot.style.removeProperty('box-shadow');
  }, 300);
}

function applySlotGlow(slotIndex, color) {
  const slot = getSlot(slotIndex);

  if (!slot) {
    return;
  }

  slot.style.borderColor = color;
  slot.style.boxShadow = `0 0 8px ${color}`;
}

function clearSlotGlow(slotIndex) {
  const slot = getSlot(slotIndex);

  if (!slot) {
    return;
  }

  slot.style.removeProperty('border-color');
  slot.style.removeProperty('box-shadow');
}

function removeFromInventory(itemName) {
  const newInventory = GameState.inventory.filter((item) => item !== itemName);

  updateState({ inventory: newInventory });
  updateQuickSlots();
}

function flashMedkitVignette() {
  let vignette = document.getElementById('medkit-vignette');

  if (!vignette) {
    vignette = document.createElement('div');
    vignette.id = 'medkit-vignette';
    document.body.appendChild(vignette);
  }

  vignette.classList.remove('active');
  void vignette.offsetWidth;
  vignette.classList.add('active');

  window.setTimeout(() => {
    vignette.classList.remove('active');
  }, 800);
}

function updateHeightTransition(delta) {
  const transition = actionState.heightTransition;

  if (!transition) {
    return;
  }

  const playerState = getPlayerState();

  transition.elapsed += delta;

  const progress = Math.min(1, transition.elapsed / transition.duration);
  const height = THREE.MathUtils.lerp(transition.from, transition.to, progress);

  playerState.currentHeight = height;
  playerState.targetHeight = transition.to;
  camera.position.y = height + playerState.bobAmount;

  if (progress < 1) {
    return;
  }

  playerState.currentHeight = transition.to;
  playerState.targetHeight = transition.to;
  actionState.heightTransition = null;
}

function startHeightTransition(toHeight, duration) {
  const playerState = getPlayerState();

  actionState.heightTransition = {
    from: playerState.currentHeight,
    to: toHeight,
    duration,
    elapsed: 0,
  };
  playerState.targetHeight = toHeight;
}

function useLighter() {
  if (!actionState.lighterLight) {
    return;
  }

  actionState.lighterOn = !actionState.lighterOn;
  actionState.lighterLight.intensity = actionState.lighterOn ? 1.5 : 0;

  updateState({ lighterOn: actionState.lighterOn });

  if (actionState.lighterOn) {
    applySlotGlow(GameState.activeSlot, '#ff6600');
    return;
  }

  clearSlotGlow(GameState.activeSlot);
}

function useMedkit() {
  if (GameState.fear === 0) {
    return;
  }

  const slotIndex = GameState.activeSlot;
  const newFear = Math.max(0, GameState.fear - 40);

  updateState({ fear: newFear });
  updateFearMeter(newFear);
  flashSlot(slotIndex, 'var(--color-safe)');
  flashMedkitVignette();
  removeFromInventory(ITEM_TYPES.MEDKIT.name);
  showNotification('FEAR SUPPRESSED', 2000, 'var(--color-safe)');
}

function triggerClimb() {
  const playerState = getPlayerState();

  updateState({ ropeUsed: true });
  actionState.isClimbing = true;
  actionState.walkwayAdded = true;
  playerState.onRaisedWalkway = true;
  playerState.standHeight = CLIMB_HEIGHT;
  playerState.position.x = actionState.climbPoint.x;
  playerState.position.z = actionState.climbPoint.z;
  actionState.walkwayMesh.visible = true;
  actionState.climbMarker.visible = false;
  startHeightTransition(CLIMB_HEIGHT, 1.5);
  console.log('Rope used — walkway active');
}

function useRope() {
  if (GameState.ropeUsed) {
    return;
  }

  const playerPos = getPlayerPosition();
  const distToClimb = playerPos.distanceTo(actionState.climbPoint);

  if (distToClimb > CLIMB_RADIUS) {
    showNotification('FIND THE CLIMB POINT', 2000, 'var(--color-text)');
    return;
  }

  triggerClimb();
  removeFromInventory(ITEM_TYPES.ROPE.name);
  showNotification('ROPE ANCHORED', 2000, 'var(--color-safe)');
}

function triggerDrop() {
  const playerState = getPlayerState();

  actionState.isClimbing = false;
  playerState.onRaisedWalkway = false;
  playerState.standHeight = STAND_HEIGHT;
  startHeightTransition(STAND_HEIGHT, 0.8);
  showNotification('DROPPED DOWN', 1500, 'var(--color-text)');
}

function createRadioObject(position) {
  if (actionState.radioObject) {
    disposeObject(actionState.radioObject);
  }

  const radioGroup = new THREE.Group();

  radioGroup.position.copy(position);
  radioGroup.position.y = 0.3;

  const radioGeo = new THREE.BoxGeometry(0.3, 0.2, 0.15);
  const radioMat = new THREE.MeshBasicMaterial({
    color: 0x0066ff,
    transparent: true,
    opacity: 0.8,
  });
  const radioMesh = new THREE.Mesh(radioGeo, radioMat);

  radioGroup.add(radioMesh);

  const radioLight = new THREE.PointLight(0x0066ff, 1.5, 4, 2);

  radioGroup.add(radioLight);
  scene.add(radioGroup);
  actionState.radioObject = radioGroup;
  actionState.radioTimer = RADIO_DURATION;
}

function updateRadioObject(delta) {
  if (!actionState.radioObject) {
    return;
  }

  actionState.radioTimer -= delta;

  if (actionState.radioTimer <= 0) {
    disposeObject(actionState.radioObject);
    actionState.radioObject = null;
    actionState.radioTimer = 0;
    return;
  }

  const pulse = 0.5 + Math.sin(Date.now() * 0.01) * 0.5;
  const radioLight = actionState.radioObject.children[1];

  if (radioLight) {
    radioLight.intensity = pulse * 2;
  }
}

function updateClimbMarker() {
  if (!actionState.climbMarker) {
    return;
  }

  const nearRopeClimbPoint = getHorizontalDistance(getPlayerPosition(), actionState.climbPoint) <= CLIMB_RADIUS;

  setUseHintContext({ nearRopeClimbPoint });
  actionState.climbMarker.visible = GameState.inventory.includes(ITEM_TYPES.ROPE.name)
    && !GameState.ropeUsed;
}

function updateLighterLight() {
  if (!actionState.lighterOn || !actionState.lighterLight) {
    return;
  }

  const playerPos = getPlayerPosition();

  actionState.lighterLight.position.copy(playerPos);
  actionState.lighterLight.position.y -= 0.3;
}

function updateLighterDetection() {
  if (!actionState.lighterOn) {
    return;
  }

  const playerPos = getPlayerPosition();
  const demonPos = getDemonPosition();

  if (playerPos.distanceTo(demonPos) < LIGHTER_DETECTION_RANGE) {
    alertDemon(playerPos);
  }
}

function getHorizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;

  return Math.sqrt(dx * dx + dz * dz);
}

// Initializes reusable item lights, markers, and run-specific action state.
function initItemActions() {
  clearActionObjects();
  resetSlotGlows();

  actionState.lighterLight = new THREE.PointLight(0xff6600, 0, 4, 2);
  actionState.lighterLight.castShadow = false;
  scene.add(actionState.lighterLight);

  createClimbPointMarker();
  createRaisedWalkway();
  updateState({
    lighterOn: false,
    ropeUsed: false,
    radioThrown: false,
  });
}

// Toggles the carried flashlight and synchronizes its slot glow.
function useFlashlight() {
  const flashlightSlot = GameState.inventory.indexOf(ITEM_TYPES.FLASHLIGHT.name);

  if (flashlightSlot === -1) {
    return false;
  }

  toggleFlashlight();

  if (GameState.flashlightOn) {
    applySlotGlow(flashlightSlot, 'var(--color-warning)');
  } else {
    clearSlotGlow(flashlightSlot);
  }

  return true;
}

// Uses the currently active quick-slot item for Q-key actions.
function useActiveItem() {
  const activeItem = GameState.inventory[GameState.activeSlot];

  switch (activeItem) {
    case ITEM_TYPES.LIGHTER.name:
      useLighter();
      break;
    case ITEM_TYPES.MEDKIT.name:
      useMedkit();
      break;
    case ITEM_TYPES.ROPE.name:
      useRope();
      break;
    default:
      break;
  }
}

// Throws the radio forward from the player and starts the distraction.
function useRadio() {
  if (
    GameState.inventory[GameState.activeSlot] !== ITEM_TYPES.RADIO.name
    || !GameState.inventory.includes(ITEM_TYPES.RADIO.name)
  ) {
    return;
  }

  const slotIndex = GameState.activeSlot;
  const playerPos = getPlayerPosition();
  const playerDir = getPlayerDirection();
  const throwPos = playerPos.clone().add(playerDir.clone().multiplyScalar(8.0));

  throwPos.y = 0;
  throwPos.x = Math.max(MALL_MIN, Math.min(MALL_MAX, throwPos.x));
  throwPos.z = Math.max(MALL_MIN, Math.min(MALL_MAX, throwPos.z));

  createRadioObject(throwPos);
  triggerRadioDistraction(throwPos);
  updateState({ radioThrown: true });
  flashSlot(slotIndex, '#0066ff');
  removeFromInventory(ITEM_TYPES.RADIO.name);
  showNotification('RADIO THROWN', 2000, 'var(--color-safe)');
}

// Checks whether the player reached the rope walkway drop point.
function checkDropPoint() {
  if (!GameState.ropeUsed || !actionState.isClimbing) {
    return;
  }

  const playerPos = getPlayerPosition();

  if (getHorizontalDistance(playerPos, actionState.dropPoint) < DROP_RADIUS) {
    triggerDrop();
  }
}

// Updates item lights, temporary objects, markers, and passive detection effects.
function updateItemActions(delta) {
  updateHeightTransition(delta);
  updateLighterLight();
  updateRadioObject(delta);
  updateClimbMarker();
  checkDropPoint();
  updateLighterDetection();
}

export {
  checkDropPoint,
  initItemActions,
  updateItemActions,
  useActiveItem,
  useFlashlight,
  useRadio,
};

import * as THREE from 'three';
import { camera } from '../core/camera.js';
import { scene } from '../core/scene.js';
import { openPauseMenu } from '../ui/pauseMenu.js';
import { collisionObjects, getMallBounds } from '../world/environment.js';
import { isKeyPressed, registerCrouchToggle } from './input.js';
import { GameState, updateState } from './state.js';

let canvas = null;
let isLocked = false;
let playerRig = null;
let unregisterCrouchToggle = null;

const playerState = {
  position: new THREE.Vector3(0, 1.7, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  isCrouching: false,
  isSprinting: false,
  isMoving: false,
  targetHeight: 1.7,
  currentHeight: 1.7,
  bobTime: 0,
  bobAmount: 0,
  yaw: 0,
  pitch: 0,
};

const PLAYER_CONFIG = {
  walkSpeed: 4.0,
  sprintSpeed: 7.5,
  crouchSpeed: 1.8,
  sensitivity: 0.002,
  standHeight: 1.7,
  crouchHeight: 1.0,
  bobWalk: { amplitude: 0.04, frequency: 2.0 },
  bobSprint: { amplitude: 0.08, frequency: 3.0 },
  bobCrouch: { amplitude: 0.02, frequency: 1.5 },
};

function getHUD() {
  let hud = document.getElementById('hud');

  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'hud';
    document.body.appendChild(hud);
  }

  return hud;
}

function isWithinMallBounds(position) {
  const bounds = getMallBounds();

  return position.x >= bounds.minX
    && position.x <= bounds.maxX
    && position.z >= bounds.minZ
    && position.z <= bounds.maxZ;
}

function checkCollision(newPosition) {
  if (!isWithinMallBounds(newPosition)) {
    return true;
  }

  const playerBox = new THREE.Box3(
    new THREE.Vector3(
      newPosition.x - 0.4,
      newPosition.y - playerState.currentHeight,
      newPosition.z - 0.4,
    ),
    new THREE.Vector3(
      newPosition.x + 0.4,
      newPosition.y + 0.3,
      newPosition.z + 0.4,
    ),
  );

  return collisionObjects.some((object) => playerBox.intersectsBox(object.box));
}

function injectPointerHint() {
  const hud = getHUD();
  let pointerHint = document.getElementById('pointer-hint');

  if (!pointerHint) {
    pointerHint = document.createElement('div');
    pointerHint.id = 'pointer-hint';
    pointerHint.innerHTML = '<span>CLICK TO FOCUS</span>';
    hud.appendChild(pointerHint);
  }

  pointerHint.classList.toggle('hidden', isLocked);
  return pointerHint;
}

function handlePointerLockError() {
  console.warn('Pointer lock request failed. Click the game canvas to try again.');
}

function requestPointerLock() {
  if (GameState.isPaused || document.pointerLockElement === canvas) {
    return;
  }

  const lockRequest = canvas?.requestPointerLock();

  if (lockRequest?.catch) {
    lockRequest.catch(() => {});
  }
}

function ensurePlayerRig() {
  if (playerRig) {
    return;
  }

  playerRig = new THREE.Object3D();
  playerRig.name = 'PlayerCollisionFoundation';
  playerRig.userData = {
    radius: 0.35,
    height: PLAYER_CONFIG.standHeight,
  };
  scene.add(playerRig);
}

function syncPlayerRig() {
  if (!playerRig) {
    return;
  }

  playerRig.position.copy(playerState.position);
  playerRig.userData.height = playerState.currentHeight;
}

function handleCrouchToggle() {
  playerState.isCrouching = !playerState.isCrouching;
  playerState.targetHeight = playerState.isCrouching
    ? PLAYER_CONFIG.crouchHeight
    : PLAYER_CONFIG.standHeight;

  updateState({
    isHidden: playerState.isCrouching,
  });
}

function handlePointerLockChange() {
  const pointerHint = document.getElementById('pointer-hint');
  const wasLocked = isLocked;

  isLocked = document.pointerLockElement === canvas;
  pointerHint?.classList.toggle('hidden', isLocked);

  if (isLocked) {
    document.addEventListener('mousemove', handleMouseMove);
    return;
  }

  document.removeEventListener('mousemove', handleMouseMove);

  if (wasLocked && GameState.isAlive && !GameState.explosivesPlanted && !GameState.isPaused) {
    openPauseMenu();
  }
}

function handleMouseMove(event) {
  if (!isLocked || GameState.isPaused) {
    return;
  }

  playerState.yaw -= event.movementX * PLAYER_CONFIG.sensitivity;
  playerState.pitch -= event.movementY * PLAYER_CONFIG.sensitivity;
  playerState.pitch = Math.max(
    -Math.PI * 0.47,
    Math.min(Math.PI * 0.47, playerState.pitch),
  );
}

function getBobConfig() {
  if (playerState.isCrouching) {
    return PLAYER_CONFIG.bobCrouch;
  }

  if (playerState.isSprinting) {
    return PLAYER_CONFIG.bobSprint;
  }

  return PLAYER_CONFIG.bobWalk;
}

// Initializes the player position, pointer lock, and crouch input bridge.
function initPlayer(startPosition = new THREE.Vector3(0, PLAYER_CONFIG.standHeight, 5)) {
  playerState.position.copy(startPosition);
  playerState.currentHeight = startPosition.y;
  playerState.targetHeight = startPosition.y;
  playerState.velocity.set(0, 0, 0);
  playerState.bobTime = 0;
  playerState.bobAmount = 0;
  playerState.yaw = 0;
  playerState.pitch = 0;
  playerState.isCrouching = false;
  playerState.isMoving = false;
  playerState.isSprinting = false;
  updateState({ isHidden: false });
  camera.position.copy(playerState.position);

  canvas = document.querySelector('canvas');

  if (canvas) {
    canvas.addEventListener('click', requestPointerLock);
  }

  document.removeEventListener('pointerlockchange', handlePointerLockChange);
  document.removeEventListener('pointerlockerror', handlePointerLockError);
  document.addEventListener('pointerlockchange', handlePointerLockChange);
  document.addEventListener('pointerlockerror', handlePointerLockError);

  if (unregisterCrouchToggle) {
    unregisterCrouchToggle();
  }

  unregisterCrouchToggle = registerCrouchToggle(handleCrouchToggle);
  ensurePlayerRig();
  injectPointerHint();
  syncPlayerRig();
}

// Updates first-person movement, sprint effects, crouch height, and camera bob.
function updatePlayer(delta) {
  if (GameState.isPaused || GameState.isInspecting) {
    return;
  }

  const forward = isKeyPressed('w') || isKeyPressed('ArrowUp');
  const backward = isKeyPressed('s') || isKeyPressed('ArrowDown');
  const left = isKeyPressed('a') || isKeyPressed('ArrowLeft');
  const right = isKeyPressed('d') || isKeyPressed('ArrowRight');
  const sprinting = isKeyPressed('Shift') && !playerState.isCrouching;
  const speed = playerState.isCrouching
    ? PLAYER_CONFIG.crouchSpeed
    : sprinting
      ? PLAYER_CONFIG.sprintSpeed
      : PLAYER_CONFIG.walkSpeed;
  const forwardVec = new THREE.Vector3(
    -Math.sin(playerState.yaw),
    0,
    -Math.cos(playerState.yaw),
  );
  const rightVec = new THREE.Vector3(
    Math.cos(playerState.yaw),
    0,
    -Math.sin(playerState.yaw),
  );
  const moveDir = new THREE.Vector3();

  if (forward) {
    moveDir.add(forwardVec);
  }

  if (backward) {
    moveDir.sub(forwardVec);
  }

  if (right) {
    moveDir.add(rightVec);
  }

  if (left) {
    moveDir.sub(rightVec);
  }

  playerState.isMoving = moveDir.lengthSq() > 0;
  playerState.isSprinting = sprinting && playerState.isMoving;

  if (playerState.isMoving) {
    moveDir.normalize().multiplyScalar(speed * delta);
  }

  playerState.velocity.copy(moveDir);

  const nextX = playerState.position.clone().add(new THREE.Vector3(moveDir.x, 0, 0));

  if (!checkCollision(nextX)) {
    playerState.position.x = nextX.x;
  }

  const nextZ = playerState.position.clone().add(new THREE.Vector3(0, 0, moveDir.z));

  if (!checkCollision(nextZ)) {
    playerState.position.z = nextZ.z;
  }

  if (playerState.isSprinting) {
    updateState({
      fear: Math.min(100, GameState.fear + 0.15),
      isHidden: false,
    });
  }

  playerState.currentHeight += (
    playerState.targetHeight - playerState.currentHeight
  ) * 8.0 * delta;

  if (playerState.isMoving) {
    const bobConfig = getBobConfig();

    playerState.bobTime += bobConfig.frequency * delta * Math.PI * 2;
    playerState.bobAmount = Math.sin(playerState.bobTime) * bobConfig.amplitude;
  } else {
    playerState.bobTime += (0 - playerState.bobTime) * 5.0 * delta;
    playerState.bobAmount += (0 - playerState.bobAmount) * 5.0 * delta;
  }

  camera.position.copy(playerState.position);
  camera.position.y = playerState.currentHeight + playerState.bobAmount;
  camera.rotation.order = 'YXZ';
  camera.rotation.y = playerState.yaw;
  camera.rotation.x = playerState.pitch;
  syncPlayerRig();
}

// Returns a cloned world-space player position.
function getPlayerPosition() {
  return playerState.position.clone();
}

// Returns the current normalized first-person look direction.
function getPlayerDirection() {
  return new THREE.Vector3(
    -Math.sin(playerState.yaw) * Math.cos(playerState.pitch),
    Math.sin(playerState.pitch),
    -Math.cos(playerState.yaw) * Math.cos(playerState.pitch),
  ).normalize();
}

// Returns the live player state object for systems that need controller flags.
function getPlayerState() {
  return playerState;
}

export {
  PLAYER_CONFIG,
  getPlayerDirection,
  getPlayerPosition,
  getPlayerState,
  initPlayer,
  updatePlayer,
};

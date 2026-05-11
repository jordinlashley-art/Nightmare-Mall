import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { GameState, updateState } from '../systems/state.js';
import { getPlayerPosition, getPlayerState } from '../systems/player.js';
import { getCurrentDifficulty } from '../systems/difficulty.js';
import { triggerDeathScreen } from '../ui/endScreens.js';

const IS_DEV = true;
const ALERT_PAUSE_TIME = 0.5;

export const DEMON_CONFIG = {
  id: 'demon-stalker',
  variantName: 'STALKER',
  patrolSpeed: 1.8,
  alertedSpeed: 2.8,
  huntingSpeed: 4.2,
  turnSpeed: 3.0,
  arrivalThreshold: 1.0,
  catchDistance: 0.6,
  alertTimeout: 12.0,
  huntLostTime: 3.0,
  idleChance: 0.3,
  idleMinTime: 1.5,
  idleMaxTime: 4.5,
  startPosition: new THREE.Vector3(40, 0, 40),
  meshScale: 1,
  audioWeight: 1,
  eyeColor: 0xff0000,
};

export const SKITTER_DEMON_CONFIG = {
  id: 'demon-skitter',
  variantName: 'SKITTER',
  patrolSpeed: 3.4,
  alertedSpeed: 5.2,
  huntingSpeed: 7.4,
  turnSpeed: 4.2,
  arrivalThreshold: 0.75,
  catchDistance: 0.65,
  alertTimeout: 6.5,
  huntLostTime: 2.4,
  idleChance: 0.12,
  idleMinTime: 0.35,
  idleMaxTime: 1.1,
  startPosition: new THREE.Vector3(-40, 0, -40),
  meshScale: 0.72,
  audioWeight: 0.75,
  eyeColor: 0xff6600,
};

export const PATROL_WAYPOINTS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -15),
  new THREE.Vector3(-30, 0, -25),
  new THREE.Vector3(-36, 0, -25),
  new THREE.Vector3(-18, 0, -25),
  new THREE.Vector3(0, 0, -25),
  new THREE.Vector3(18, 0, -25),
  new THREE.Vector3(36, 0, -25),
  new THREE.Vector3(30, 0, -25),
  new THREE.Vector3(0, 0, -15),
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, 15),
  new THREE.Vector3(-30, 0, 25),
  new THREE.Vector3(-36, 0, 25),
  new THREE.Vector3(-18, 0, 25),
  new THREE.Vector3(0, 0, 25),
  new THREE.Vector3(18, 0, 25),
  new THREE.Vector3(36, 0, 25),
];

const demonState = {
  id: DEMON_CONFIG.id,
  variantName: DEMON_CONFIG.variantName,
  config: DEMON_CONFIG,
  position: DEMON_CONFIG.startPosition.clone(),
  targetPosition: new THREE.Vector3(0, 0, 0),
  currentWaypoint: 0,
  behaviorState: 'PATROL',
  alertTimer: 0,
  huntTimer: 0,
  idleTimer: 0,
  isIdle: false,
  lastKnownPlayerPos: new THREE.Vector3(),
  lastStimulusPos: new THREE.Vector3(),
  mesh: null,
  eyeLights: [],
  isDead: false,
  alertPauseTimer: 0,
  advanceAfterIdle: true,
  audioWeight: DEMON_CONFIG.audioWeight,
};

const skitterDemonState = {
  id: SKITTER_DEMON_CONFIG.id,
  variantName: SKITTER_DEMON_CONFIG.variantName,
  config: SKITTER_DEMON_CONFIG,
  position: SKITTER_DEMON_CONFIG.startPosition.clone(),
  targetPosition: new THREE.Vector3(0, 0, 0),
  currentWaypoint: Math.floor(PATROL_WAYPOINTS.length / 2),
  behaviorState: 'PATROL',
  alertTimer: 0,
  huntTimer: 0,
  idleTimer: 0,
  isIdle: false,
  lastKnownPlayerPos: new THREE.Vector3(),
  lastStimulusPos: new THREE.Vector3(),
  mesh: null,
  eyeLights: [],
  isDead: false,
  alertPauseTimer: 0,
  advanceAfterIdle: true,
  audioWeight: SKITTER_DEMON_CONFIG.audioWeight,
};

const demonStates = [demonState, skitterDemonState];

const waypointMarkers = [];

function getGroundPosition(position) {
  const groundPosition = position.clone();

  groundPosition.y = 0;
  return groundPosition;
}

function createDemonMesh(state = demonState) {
  const { config } = state;

  if (state.mesh) {
    state.mesh.position.copy(state.position);
    return state.mesh;
  }

  const demonGroup = new THREE.Group();
  demonGroup.name = `DemonPatrolEntity_${config.variantName}`;
  demonGroup.position.copy(config.startPosition);
  demonGroup.scale.setScalar(config.meshScale);

  const bodyGeo = typeof THREE.CapsuleGeometry === 'function'
    ? new THREE.CapsuleGeometry(0.4, 1.2, 4, 8)
    : new THREE.CylinderGeometry(0.4, 0.35, 2.0, 8);
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0x1a0a0a,
    emissive: new THREE.Color(0x330000),
    emissiveIntensity: 0.8,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  body.position.y = 1.1;
  body.castShadow = true;
  demonGroup.add(body);

  const headGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const headMat = new THREE.MeshLambertMaterial({
    color: 0x150808,
    emissive: new THREE.Color(0x220000),
    emissiveIntensity: 0.6,
  });
  const head = new THREE.Mesh(headGeo, headMat);

  head.position.y = 2.25;
  head.castShadow = true;
  demonGroup.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.06, 6, 4);
  const eyeMat = new THREE.MeshBasicMaterial({
    color: config.eyeColor,
  });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);

  leftEye.position.set(-0.12, 2.28, 0.3);
  rightEye.position.set(0.12, 2.28, 0.3);
  demonGroup.add(leftEye);
  demonGroup.add(rightEye);

  const leftGlow = new THREE.PointLight(config.eyeColor, 0.5, 2, 2);
  const rightGlow = new THREE.PointLight(config.eyeColor, 0.5, 2, 2);

  leftGlow.position.copy(leftEye.position);
  rightGlow.position.copy(rightEye.position);
  demonGroup.add(leftGlow);
  demonGroup.add(rightGlow);
  state.eyeLights = [leftGlow, rightGlow];

  scene.add(demonGroup);
  state.mesh = demonGroup;
  return demonGroup;
}

function createWaypointMarkers() {
  if (waypointMarkers.length > 0) {
    return;
  }

  PATROL_WAYPOINTS.forEach((wp, i) => {
    const geo = new THREE.SphereGeometry(0.2, 6, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
    });
    const marker = new THREE.Mesh(geo, mat);

    marker.name = `DemonWaypointMarker${String(i).padStart(2, '0')}`;
    marker.position.copy(wp);
    marker.position.y = 0.5;
    marker.userData.ignoreFlashlightRay = true;
    scene.add(marker);
    waypointMarkers.push(marker);
  });
}

function updateEyeGlow(state = demonState) {
  let eyeIntensity = 0.5;

  if (state.behaviorState === 'ALERTED') {
    eyeIntensity = 1.2;
  } else if (state.behaviorState === 'HUNTING') {
    eyeIntensity = 2.5 + Math.sin(Date.now() * 0.01) * 0.5;
  }

  state.eyeLights.forEach((light) => {
    light.intensity = eyeIntensity;
  });
}

function moveTowardTarget(state, delta, speed) {
  if (!state.mesh) {
    return;
  }

  const direction = state.targetPosition.clone().sub(state.position);

  direction.y = 0;

  const dist = direction.length();

  if (dist < 0.01) {
    return;
  }

  direction.normalize();

  const targetAngle = Math.atan2(direction.x, direction.z);
  const currentAngle = state.mesh.rotation.y;
  const angleDiff = THREE.MathUtils.euclideanModulo(
    targetAngle - currentAngle + Math.PI,
    Math.PI * 2,
  ) - Math.PI;

  state.mesh.rotation.y += Math.sign(angleDiff) * Math.min(
    Math.abs(angleDiff),
    state.config.turnSpeed * delta,
  );

  const moveAmount = Math.min(dist, speed * delta);

  state.position.addScaledVector(direction, moveAmount);
  state.mesh.position.copy(state.position);
}

function advanceWaypoint(state = demonState) {
  state.currentWaypoint = (state.currentWaypoint + 1) % PATROL_WAYPOINTS.length;
  state.targetPosition.copy(PATROL_WAYPOINTS[state.currentWaypoint]);
}

function enterIdle(state, advanceAfterIdle = true) {
  state.behaviorState = 'IDLE';
  state.isIdle = true;
  state.advanceAfterIdle = advanceAfterIdle;
  state.idleTimer = state.config.idleMinTime + Math.random() * (
    state.config.idleMaxTime - state.config.idleMinTime
  );
}

function checkWaypointArrival(state = demonState) {
  const dist = state.position.distanceTo(PATROL_WAYPOINTS[state.currentWaypoint]);

  if (dist < state.config.arrivalThreshold) {
    if (Math.random() < state.config.idleChance) {
      enterIdle(state, true);
    } else {
      advanceWaypoint(state);
    }
  }
}

function checkAlertArrival(state = demonState) {
  const dist = state.position.distanceTo(state.targetPosition);

  if (dist < state.config.arrivalThreshold) {
    enterIdle(state, false);
  }
}

function returnToPatrol(state = demonState) {
  let nearestWP = 0;
  let nearestDist = Infinity;

  PATROL_WAYPOINTS.forEach((wp, i) => {
    const dist = state.position.distanceTo(wp);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestWP = i;
    }
  });

  state.behaviorState = 'PATROL';
  state.alertTimer = 0;
  state.huntTimer = 0;
  state.idleTimer = 0;
  state.alertPauseTimer = 0;
  state.isIdle = false;
  state.advanceAfterIdle = true;
  state.currentWaypoint = nearestWP;
  state.targetPosition.copy(PATROL_WAYPOINTS[nearestWP]);
}

function checkPassiveStimuli(state, playerPosition, distToPlayer) {
  if (state.behaviorState === 'HUNTING') {
    return;
  }

  const playerState = getPlayerState();

  if (playerState.isSprinting && distToPlayer <= 11) {
    alertDemon(playerPosition);
    return;
  }

  if (GameState.flashlightVisible && distToPlayer <= 14) {
    alertDemon(playerPosition);
  }
}

function getAdjustedSpeed(baseSpeed) {
  return baseSpeed * getCurrentDifficulty().demonSpeedMultiplier;
}

// Initializes the demon mesh, patrol target, and dev waypoint markers.
function initDemon() {
  demonStates.forEach((state) => createDemonMesh(state));
  resetDemon();

  if (IS_DEV) {
    createWaypointMarkers();
  }
}

function updateSingleDemon(state, delta, playerPos) {
  if (
    GameState.isPaused
    || GameState.isInspecting
    || GameState.isAlive === false
    || state.isDead
  ) {
    return;
  }

  const distToPlayer = state.position.distanceTo(playerPos);

  if (distToPlayer < state.config.catchDistance) {
    state.isDead = true;
    updateState({ isAlive: false });
    triggerDeathScreen();
    return;
  }

  checkPassiveStimuli(state, playerPos, distToPlayer);

  switch (state.behaviorState) {
    case 'PATROL':
      moveTowardTarget(state, delta, getAdjustedSpeed(state.config.patrolSpeed));
      checkWaypointArrival(state);
      break;
    case 'ALERTED':
      state.alertTimer += delta;

      if (state.alertPauseTimer > 0) {
        state.alertPauseTimer = Math.max(0, state.alertPauseTimer - delta);
        break;
      }

      if (state.alertTimer > state.config.alertTimeout) {
        returnToPatrol(state);
        break;
      }

      moveTowardTarget(state, delta, getAdjustedSpeed(state.config.alertedSpeed));
      checkAlertArrival(state);
      break;
    case 'HUNTING':
      state.huntTimer += delta;

      if (state.huntTimer > state.config.huntLostTime) {
        lostPlayer();
        break;
      }

      state.targetPosition.copy(playerPos);
      state.lastKnownPlayerPos.copy(playerPos);
      moveTowardTarget(state, delta, getAdjustedSpeed(state.config.huntingSpeed));
      break;
    case 'IDLE':
      state.idleTimer -= delta;

      if (state.idleTimer <= 0) {
        state.isIdle = false;

        if (state.advanceAfterIdle) {
          state.behaviorState = 'PATROL';
          advanceWaypoint(state);
        } else {
          returnToPatrol(state);
        }
      }
      break;
    default:
      returnToPatrol(state);
      break;
  }

  updateEyeGlow(state);
}

// Updates demon behavior, movement, eye glow, and catch detection for the frame.
function updateDemon(delta) {
  const playerPos = getGroundPosition(getPlayerPosition());

  demonStates.forEach((state) => updateSingleDemon(state, delta, playerPos));
}

// Alerts the demon to a stimulus position unless it is already hunting.
function alertDemon(stimulusPosition) {
  const groundStimulus = getGroundPosition(stimulusPosition);

  demonStates.forEach((state) => {
    if (state.behaviorState === 'HUNTING' || state.isDead) {
      return;
    }

    const wasAlerted = state.behaviorState === 'ALERTED';

    state.behaviorState = 'ALERTED';
    state.alertTimer = 0;
    state.alertPauseTimer = wasAlerted ? 0 : ALERT_PAUSE_TIME;
    state.isIdle = false;
    state.advanceAfterIdle = true;
    state.targetPosition.copy(groundStimulus);
    state.lastStimulusPos.copy(groundStimulus);
  });
}

// Forces the demon into hunting mode against the current player position.
function huntPlayer() {
  const playerPos = getGroundPosition(getPlayerPosition());

  demonStates.forEach((state) => {
    if (state.isDead) {
      return;
    }

    state.behaviorState = 'HUNTING';
    state.huntTimer = 0;
    state.alertPauseTimer = 0;
    state.isIdle = false;
    state.advanceAfterIdle = true;
    state.targetPosition.copy(playerPos);
    state.lastKnownPlayerPos.copy(playerPos);
  });
}

// Sends the demon to the last known player position after sight is lost.
function lostPlayer() {
  demonStates.forEach((state) => {
    if (state.isDead) {
      return;
    }

    state.behaviorState = 'ALERTED';
    state.alertTimer = 0;
    state.huntTimer = 0;
    state.alertPauseTimer = 0;
    state.isIdle = false;
    state.advanceAfterIdle = true;
    state.targetPosition.copy(state.lastKnownPlayerPos);
  });
}

// Returns a cloned world-space demon position.
function getDemonPosition() {
  return getDemonState().position.clone();
}

// Returns the live demon state object for detection and tuning systems.
function getDemonState() {
  const playerPos = getGroundPosition(getPlayerPosition());
  let closestState = demonState;
  let closestDistance = Infinity;

  demonStates.forEach((state) => {
    if (state.isDead) {
      return;
    }

    const distance = state.position.distanceTo(playerPos);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestState = state;
    }
  });

  return closestState;
}

// Returns the live demon states for proximity-based systems.
function getDemonStates() {
  return demonStates;
}

// Resets the demon to its starting position and default patrol behavior.
function resetDemon() {
  demonStates.forEach((state, index) => {
    state.position.copy(state.config.startPosition);
    state.currentWaypoint = index === 0 ? 0 : Math.floor(PATROL_WAYPOINTS.length / 2);
    state.behaviorState = 'PATROL';
    state.alertTimer = 0;
    state.huntTimer = 0;
    state.idleTimer = 0;
    state.alertPauseTimer = 0;
    state.isIdle = false;
    state.isDead = false;
    state.advanceAfterIdle = true;
    state.targetPosition.copy(PATROL_WAYPOINTS[state.currentWaypoint]);
    state.lastKnownPlayerPos.set(0, 0, 0);
    state.lastStimulusPos.set(0, 0, 0);

    if (state.mesh) {
      state.mesh.position.copy(state.config.startPosition);
      state.mesh.rotation.set(0, 0, 0);
    }

    updateEyeGlow(state);
  });
}

export {
  alertDemon,
  getDemonPosition,
  getDemonState,
  getDemonStates,
  huntPlayer,
  initDemon,
  lostPlayer,
  resetDemon,
  updateDemon,
};

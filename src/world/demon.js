import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { GameState, updateState } from '../systems/state.js';
import { getPlayerPosition, getPlayerState } from '../systems/player.js';
import { triggerDeathScreen } from '../ui/endScreens.js';

const IS_DEV = true;
const ALERT_PAUSE_TIME = 0.5;

export const DEMON_CONFIG = {
  patrolSpeed: 2.5,
  alertedSpeed: 4.0,
  huntingSpeed: 6.0,
  turnSpeed: 3.0,
  arrivalThreshold: 1.0,
  catchDistance: 0.8,
  alertTimeout: 8.0,
  huntLostTime: 3.0,
  idleChance: 0.2,
  idleMinTime: 1.0,
  idleMaxTime: 3.0,
  startPosition: new THREE.Vector3(40, 0, 40),
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
};

const waypointMarkers = [];

function getGroundPosition(position) {
  const groundPosition = position.clone();

  groundPosition.y = 0;
  return groundPosition;
}

function createDemonMesh() {
  if (demonState.mesh) {
    demonState.mesh.position.copy(demonState.position);
    return demonState.mesh;
  }

  const demonGroup = new THREE.Group();
  demonGroup.name = 'DemonPatrolEntity';
  demonGroup.position.copy(DEMON_CONFIG.startPosition);

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
    color: 0xff0000,
  });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);

  leftEye.position.set(-0.12, 2.28, 0.3);
  rightEye.position.set(0.12, 2.28, 0.3);
  demonGroup.add(leftEye);
  demonGroup.add(rightEye);

  const leftGlow = new THREE.PointLight(0xff0000, 0.5, 2, 2);
  const rightGlow = new THREE.PointLight(0xff0000, 0.5, 2, 2);

  leftGlow.position.copy(leftEye.position);
  rightGlow.position.copy(rightEye.position);
  demonGroup.add(leftGlow);
  demonGroup.add(rightGlow);
  demonState.eyeLights = [leftGlow, rightGlow];

  scene.add(demonGroup);
  demonState.mesh = demonGroup;
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

function updateEyeGlow() {
  let eyeIntensity = 0.5;

  if (demonState.behaviorState === 'ALERTED') {
    eyeIntensity = 1.2;
  } else if (demonState.behaviorState === 'HUNTING') {
    eyeIntensity = 2.5 + Math.sin(Date.now() * 0.01) * 0.5;
  }

  demonState.eyeLights.forEach((light) => {
    light.intensity = eyeIntensity;
  });
}

function moveTowardTarget(delta, speed) {
  if (!demonState.mesh) {
    return;
  }

  const direction = demonState.targetPosition.clone().sub(demonState.position);

  direction.y = 0;

  const dist = direction.length();

  if (dist < 0.01) {
    return;
  }

  direction.normalize();

  const targetAngle = Math.atan2(direction.x, direction.z);
  const currentAngle = demonState.mesh.rotation.y;
  const angleDiff = THREE.MathUtils.euclideanModulo(
    targetAngle - currentAngle + Math.PI,
    Math.PI * 2,
  ) - Math.PI;

  demonState.mesh.rotation.y += Math.sign(angleDiff) * Math.min(
    Math.abs(angleDiff),
    DEMON_CONFIG.turnSpeed * delta,
  );

  const moveAmount = Math.min(dist, speed * delta);

  demonState.position.addScaledVector(direction, moveAmount);
  demonState.mesh.position.copy(demonState.position);
}

function advanceWaypoint() {
  demonState.currentWaypoint = (demonState.currentWaypoint + 1) % PATROL_WAYPOINTS.length;
  demonState.targetPosition.copy(PATROL_WAYPOINTS[demonState.currentWaypoint]);
}

function enterIdle(advanceAfterIdle = true) {
  demonState.behaviorState = 'IDLE';
  demonState.isIdle = true;
  demonState.advanceAfterIdle = advanceAfterIdle;
  demonState.idleTimer = DEMON_CONFIG.idleMinTime + Math.random() * (
    DEMON_CONFIG.idleMaxTime - DEMON_CONFIG.idleMinTime
  );
}

function checkWaypointArrival() {
  const dist = demonState.position.distanceTo(PATROL_WAYPOINTS[demonState.currentWaypoint]);

  if (dist < DEMON_CONFIG.arrivalThreshold) {
    if (Math.random() < DEMON_CONFIG.idleChance) {
      enterIdle(true);
    } else {
      advanceWaypoint();
    }
  }
}

function checkAlertArrival() {
  const dist = demonState.position.distanceTo(demonState.targetPosition);

  if (dist < DEMON_CONFIG.arrivalThreshold) {
    enterIdle(false);
  }
}

function returnToPatrol() {
  let nearestWP = 0;
  let nearestDist = Infinity;

  PATROL_WAYPOINTS.forEach((wp, i) => {
    const dist = demonState.position.distanceTo(wp);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestWP = i;
    }
  });

  demonState.behaviorState = 'PATROL';
  demonState.alertTimer = 0;
  demonState.huntTimer = 0;
  demonState.idleTimer = 0;
  demonState.alertPauseTimer = 0;
  demonState.isIdle = false;
  demonState.advanceAfterIdle = true;
  demonState.currentWaypoint = nearestWP;
  demonState.targetPosition.copy(PATROL_WAYPOINTS[nearestWP]);
}

function checkPassiveStimuli(playerPosition, distToPlayer) {
  if (demonState.behaviorState === 'HUNTING') {
    return;
  }

  const playerState = getPlayerState();

  if (playerState.isSprinting && distToPlayer <= 15) {
    alertDemon(playerPosition);
    return;
  }

  if (GameState.flashlightVisible && distToPlayer <= 20) {
    alertDemon(playerPosition);
  }
}

// Initializes the demon mesh, patrol target, and dev waypoint markers.
function initDemon() {
  createDemonMesh();
  resetDemon();

  if (IS_DEV) {
    createWaypointMarkers();
  }
}

// Updates demon behavior, movement, eye glow, and catch detection for the frame.
function updateDemon(delta) {
  if (
    GameState.isPaused
    || GameState.isInspecting
    || GameState.isAlive === false
    || demonState.isDead
  ) {
    return;
  }

  const playerPos = getGroundPosition(getPlayerPosition());
  const distToPlayer = demonState.position.distanceTo(playerPos);

  if (distToPlayer < DEMON_CONFIG.catchDistance) {
    demonState.isDead = true;
    updateState({ isAlive: false });
    triggerDeathScreen();
    return;
  }

  checkPassiveStimuli(playerPos, distToPlayer);

  switch (demonState.behaviorState) {
    case 'PATROL':
      moveTowardTarget(delta, DEMON_CONFIG.patrolSpeed);
      checkWaypointArrival();
      break;
    case 'ALERTED':
      demonState.alertTimer += delta;

      if (demonState.alertPauseTimer > 0) {
        demonState.alertPauseTimer = Math.max(0, demonState.alertPauseTimer - delta);
        break;
      }

      if (demonState.alertTimer > DEMON_CONFIG.alertTimeout) {
        returnToPatrol();
        break;
      }

      moveTowardTarget(delta, DEMON_CONFIG.alertedSpeed);
      checkAlertArrival();
      break;
    case 'HUNTING':
      demonState.huntTimer += delta;

      if (demonState.huntTimer > DEMON_CONFIG.huntLostTime) {
        lostPlayer();
        break;
      }

      demonState.targetPosition.copy(playerPos);
      demonState.lastKnownPlayerPos.copy(playerPos);
      moveTowardTarget(delta, DEMON_CONFIG.huntingSpeed);
      break;
    case 'IDLE':
      demonState.idleTimer -= delta;

      if (demonState.idleTimer <= 0) {
        demonState.isIdle = false;

        if (demonState.advanceAfterIdle) {
          demonState.behaviorState = 'PATROL';
          advanceWaypoint();
        } else {
          returnToPatrol();
        }
      }
      break;
    default:
      returnToPatrol();
      break;
  }

  updateEyeGlow();
}

// Alerts the demon to a stimulus position unless it is already hunting.
function alertDemon(stimulusPosition) {
  if (demonState.behaviorState === 'HUNTING' || demonState.isDead) {
    return;
  }

  const groundStimulus = getGroundPosition(stimulusPosition);
  const wasAlerted = demonState.behaviorState === 'ALERTED';

  demonState.behaviorState = 'ALERTED';
  demonState.alertTimer = 0;
  demonState.alertPauseTimer = wasAlerted ? 0 : ALERT_PAUSE_TIME;
  demonState.isIdle = false;
  demonState.advanceAfterIdle = true;
  demonState.targetPosition.copy(groundStimulus);
  demonState.lastStimulusPos.copy(groundStimulus);
}

// Forces the demon into hunting mode against the current player position.
function huntPlayer() {
  if (demonState.isDead) {
    return;
  }

  const playerPos = getGroundPosition(getPlayerPosition());

  demonState.behaviorState = 'HUNTING';
  demonState.huntTimer = 0;
  demonState.alertPauseTimer = 0;
  demonState.isIdle = false;
  demonState.advanceAfterIdle = true;
  demonState.targetPosition.copy(playerPos);
  demonState.lastKnownPlayerPos.copy(playerPos);
}

// Sends the demon to the last known player position after sight is lost.
function lostPlayer() {
  if (demonState.isDead) {
    return;
  }

  demonState.behaviorState = 'ALERTED';
  demonState.alertTimer = 0;
  demonState.huntTimer = 0;
  demonState.alertPauseTimer = 0;
  demonState.isIdle = false;
  demonState.advanceAfterIdle = true;
  demonState.targetPosition.copy(demonState.lastKnownPlayerPos);
}

// Returns a cloned world-space demon position.
function getDemonPosition() {
  return demonState.position.clone();
}

// Returns the live demon state object for detection and tuning systems.
function getDemonState() {
  return demonState;
}

// Resets the demon to its starting position and default patrol behavior.
function resetDemon() {
  demonState.position.copy(DEMON_CONFIG.startPosition);
  demonState.currentWaypoint = 0;
  demonState.behaviorState = 'PATROL';
  demonState.alertTimer = 0;
  demonState.huntTimer = 0;
  demonState.idleTimer = 0;
  demonState.alertPauseTimer = 0;
  demonState.isIdle = false;
  demonState.isDead = false;
  demonState.advanceAfterIdle = true;
  demonState.targetPosition.copy(PATROL_WAYPOINTS[0]);
  demonState.lastKnownPlayerPos.set(0, 0, 0);
  demonState.lastStimulusPos.set(0, 0, 0);

  if (demonState.mesh) {
    demonState.mesh.position.copy(DEMON_CONFIG.startPosition);
    demonState.mesh.rotation.set(0, 0, 0);
  }

  updateEyeGlow();
}

export {
  alertDemon,
  getDemonPosition,
  getDemonState,
  huntPlayer,
  initDemon,
  lostPlayer,
  resetDemon,
  updateDemon,
};

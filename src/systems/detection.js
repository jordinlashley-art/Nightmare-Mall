import * as THREE from 'three';
import { GameState, updateState } from './state.js';
import { getPlayerDirection, getPlayerPosition, getPlayerState } from './player.js';
import {
  alertDemon,
  getDemonPosition,
  getDemonState,
  huntPlayer,
  lostPlayer,
} from '../world/demon.js';
import { updateFearMeter, updateStealthIndicator } from '../ui/hud.js';
import { updateVignette } from '../ui/overlay.js';
import { setDemonProximity } from '../ui/compass.js';
import { collisionObjects } from '../world/environment.js';

const detectionState = {
  currentDetectionLevel: 0,
  wasInSight: false,
  outOfSightTimer: 0,
  soundRadius: 0,
  lastSoundPos: new THREE.Vector3(),
  radioDistractTimer: 0,
  isRadioDistracted: false,
};

let detectionRaycaster = null;
let cachedCollisionCount = -1;
let lineOfSightMeshes = [];

export const DETECTION_CONFIG = {
  proximityDistant: 30,
  proximityNear: 15,
  proximityClose: 8,
  proximityCritical: 4,

  fearBleedDistant: 0,
  fearBleedNear: 0.05,
  fearBleedClose: 0.15,
  fearBleedCritical: 0.4,

  visionAnglePatrol: Math.PI / 3,
  visionAngleAlerted: Math.PI / 2,
  visionAngleHunting: Math.PI * 2 / 3,

  visionRangePatrol: 12,
  visionRangeAlerted: 18,
  visionRangeHunting: 25,

  soundRadiusWalk: 8,
  soundRadiusSprint: 15,
  soundRadiusCrouch: 2,
  soundRadiusFlash: 20,
  soundRadiusRadio: 30,

  detectionRiseRate: 8,
  detectionFallRate: 5,
  outOfSightTimeout: 3.0,
  radioDistractTime: 6.0,

  flashlightRangeMultiplier: 2.0,
};

function resetDetectionState() {
  detectionState.currentDetectionLevel = 0;
  detectionState.wasInSight = false;
  detectionState.outOfSightTimer = 0;
  detectionState.soundRadius = 0;
  detectionState.lastSoundPos.set(0, 0, 0);
  detectionState.radioDistractTimer = 0;
  detectionState.isRadioDistracted = false;
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, value));
}

function syncHud() {
  updateFearMeter(GameState.fear);
  updateVignette(GameState.fear);
  updateStealthIndicator();
}

function getLineOfSightMeshes() {
  if (cachedCollisionCount !== collisionObjects.length) {
    cachedCollisionCount = collisionObjects.length;
    lineOfSightMeshes = collisionObjects
      .map((object) => object.mesh)
      .filter(Boolean);
  }

  return lineOfSightMeshes;
}

function updateCompassDirection(playerPos, demonPos, distanceToDemon) {
  const demonVec = demonPos.clone().sub(playerPos);

  demonVec.y = 0;

  const absX = Math.abs(demonVec.x);
  const absZ = Math.abs(demonVec.z);
  const rawIntensity = clampPercent(
    100 - (distanceToDemon / DETECTION_CONFIG.proximityDistant) * 100,
  );
  const proximityUpdate = {
    north: 0,
    south: 0,
    east: 0,
    west: 0,
  };

  if (rawIntensity <= 0 || demonVec.lengthSq() === 0) {
    setDemonProximity(proximityUpdate);
    return;
  }

  if (absZ > absX) {
    if (demonVec.z < 0) {
      proximityUpdate.north = rawIntensity;
    } else {
      proximityUpdate.south = rawIntensity;
    }
  } else if (demonVec.x > 0) {
    proximityUpdate.east = rawIntensity;
  } else {
    proximityUpdate.west = rawIntensity;
  }

  if (absX > absZ * 0.5) {
    if (demonVec.x > 0) {
      proximityUpdate.east = Math.max(proximityUpdate.east, rawIntensity * 0.5);
    } else {
      proximityUpdate.west = Math.max(proximityUpdate.west, rawIntensity * 0.5);
    }
  }

  setDemonProximity(proximityUpdate);
}

function applyProximityFear(distanceToDemon) {
  let fearBleed = DETECTION_CONFIG.fearBleedDistant;

  if (distanceToDemon > DETECTION_CONFIG.proximityDistant) {
    fearBleed = DETECTION_CONFIG.fearBleedDistant;
  } else if (distanceToDemon > DETECTION_CONFIG.proximityNear) {
    fearBleed = DETECTION_CONFIG.fearBleedNear;
  } else if (distanceToDemon > DETECTION_CONFIG.proximityClose) {
    fearBleed = DETECTION_CONFIG.fearBleedClose;
  } else {
    fearBleed = DETECTION_CONFIG.fearBleedCritical;
  }

  if (fearBleed > 0) {
    updateState({
      fear: Math.min(100, GameState.fear + fearBleed),
    });
  }
}

function getSoundRadius(playerSt) {
  if (playerSt.isSprinting && playerSt.isMoving) {
    return DETECTION_CONFIG.soundRadiusSprint;
  }

  if (playerSt.isCrouching) {
    return DETECTION_CONFIG.soundRadiusCrouch;
  }

  if (playerSt.isMoving) {
    return DETECTION_CONFIG.soundRadiusWalk;
  }

  return 0;
}

function updateRadioDistraction(delta) {
  if (!detectionState.isRadioDistracted) {
    return false;
  }

  detectionState.radioDistractTimer -= delta;

  if (detectionState.radioDistractTimer <= 0) {
    detectionState.radioDistractTimer = 0;
    detectionState.isRadioDistracted = false;
    return false;
  }

  detectionState.currentDetectionLevel = Math.max(
    0,
    detectionState.currentDetectionLevel - DETECTION_CONFIG.detectionFallRate * delta * 10,
  );
  updateState({
    detectionLevel: detectionState.currentDetectionLevel,
    isHidden: true,
  });
  return true;
}

function isFlashlightPointingAtDemon(playerPos, demonPos) {
  if (!GameState.flashlightOn) {
    return false;
  }

  const playerDirection = getPlayerDirection();
  const toDemon = demonPos.clone().sub(playerPos);

  playerDirection.y = 0;
  toDemon.y = 0;

  if (playerDirection.lengthSq() === 0 || toDemon.lengthSq() === 0) {
    return false;
  }

  return playerDirection.normalize().dot(toDemon.normalize()) > Math.cos(Math.PI / 6);
}

function applySoundSense(playerPos, demonSt, distanceToDemon, soundRadius) {
  detectionState.soundRadius = soundRadius;

  if (
    GameState.flashlightOn
    && distanceToDemon < DETECTION_CONFIG.soundRadiusFlash
    && demonSt.behaviorState === 'PATROL'
  ) {
    alertDemon(playerPos.clone());
  }

  if (soundRadius <= 0 || distanceToDemon >= soundRadius) {
    return;
  }

  detectionState.lastSoundPos.copy(playerPos);

  if (demonSt.behaviorState === 'PATROL') {
    alertDemon(playerPos.clone());
  }
}

function getVisionParams(demonSt, playerPos, demonPos) {
  let angle = DETECTION_CONFIG.visionAnglePatrol;
  let range = DETECTION_CONFIG.visionRangePatrol;

  if (demonSt.behaviorState === 'HUNTING') {
    angle = DETECTION_CONFIG.visionAngleHunting;
    range = DETECTION_CONFIG.visionRangeHunting;
  } else if (demonSt.behaviorState === 'ALERTED') {
    angle = DETECTION_CONFIG.visionAngleAlerted;
    range = DETECTION_CONFIG.visionRangeAlerted;
  }

  if (isFlashlightPointingAtDemon(playerPos, demonPos)) {
    range *= DETECTION_CONFIG.flashlightRangeMultiplier;
  }

  return {
    angle,
    range,
  };
}

function isPlayerInVisionCone(playerPos, demonPos, demonSt) {
  if (!demonSt.mesh) {
    return false;
  }

  const demonForward = new THREE.Vector3(
    Math.sin(demonSt.mesh.rotation.y),
    0,
    Math.cos(demonSt.mesh.rotation.y),
  ).normalize();
  const toPlayer = playerPos.clone().sub(demonPos);

  toPlayer.y = 0;

  const toPlayerDist = toPlayer.length();

  if (toPlayerDist === 0) {
    return true;
  }

  const visionParams = getVisionParams(demonSt, playerPos, demonPos);
  const dotProduct = demonForward.dot(toPlayer.normalize());
  const inCone = dotProduct > Math.cos(visionParams.angle / 2)
    && toPlayerDist < visionParams.range;

  if (!inCone) {
    return false;
  }

  detectionRaycaster.set(demonPos.clone().setY(1.3), toPlayer);
  detectionRaycaster.far = toPlayerDist;

  const intersects = detectionRaycaster.intersectObjects(getLineOfSightMeshes(), false);

  return intersects.length === 0 || intersects[0].distance > toPlayerDist;
}

function applySightResults(inSight, delta, demonSt, playerPos) {
  if (inSight) {
    detectionState.wasInSight = true;
    detectionState.outOfSightTimer = 0;

    if (demonSt.behaviorState !== 'HUNTING') {
      huntPlayer();
    } else {
      demonSt.huntTimer = 0;
      demonSt.lastKnownPlayerPos.copy(playerPos);
      demonSt.targetPosition.copy(playerPos);
    }

    detectionState.currentDetectionLevel = Math.min(
      100,
      detectionState.currentDetectionLevel + DETECTION_CONFIG.detectionRiseRate * delta * 10,
    );
    return;
  }

  if (detectionState.wasInSight) {
    detectionState.outOfSightTimer += delta;

    if (detectionState.outOfSightTimer > DETECTION_CONFIG.outOfSightTimeout) {
      detectionState.wasInSight = false;
      detectionState.outOfSightTimer = 0;

      if (demonSt.behaviorState === 'HUNTING') {
        lostPlayer();
      }
    }
  }

  detectionState.currentDetectionLevel = Math.max(
    0,
    detectionState.currentDetectionLevel - DETECTION_CONFIG.detectionFallRate * delta * 10,
  );
}

function applyStealthState(playerSt, distanceToDemon, inSight) {
  let isHidden = GameState.isHidden;
  let newDetectionLevel = detectionState.currentDetectionLevel;

  if (playerSt.isCrouching && !inSight) {
    newDetectionLevel *= 0.3;

    if (distanceToDemon > DETECTION_CONFIG.proximityClose) {
      isHidden = true;
    }
  } else {
    isHidden = false;
  }

  updateState({
    detectionLevel: newDetectionLevel,
    isHidden,
  });
}

function applyFearRecovery(distanceToDemon) {
  if (!GameState.isHidden || distanceToDemon <= DETECTION_CONFIG.proximityClose) {
    return;
  }

  updateState({
    fear: Math.max(0, GameState.fear - 0.08),
  });
}

// Initializes line-of-sight raycasting and resets detection state.
function initDetection() {
  detectionRaycaster = new THREE.Raycaster();
  resetDetectionState();
  updateState({
    detectionLevel: 0,
    isHidden: false,
    demonProximity: {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
    },
  });
}

// Updates demon senses, stealth state, fear pressure, and detection HUD systems.
function updateDetection(delta) {
  if (GameState.isPaused || GameState.isInspecting || GameState.isAlive === false) {
    return;
  }

  if (!detectionRaycaster) {
    initDetection();
  }

  const playerPos = getPlayerPosition();
  const demonPos = getDemonPosition();
  const demonSt = getDemonState();
  const playerSt = getPlayerState();
  const distanceToDemon = playerPos.distanceTo(demonPos);

  updateCompassDirection(playerPos, demonPos, distanceToDemon);
  applyProximityFear(distanceToDemon);

  if (updateRadioDistraction(delta)) {
    applyFearRecovery(distanceToDemon);
    syncHud();
    return;
  }

  const soundRadius = getSoundRadius(playerSt);

  applySoundSense(playerPos, demonSt, distanceToDemon, soundRadius);

  const inSight = isPlayerInVisionCone(playerPos, demonPos, demonSt);

  applySightResults(inSight, delta, demonSt, playerPos);
  applyStealthState(playerSt, distanceToDemon, inSight);
  applyFearRecovery(distanceToDemon);
  syncHud();
}

// Triggers a one-use radio distraction that sends the demon to a thrown position.
function triggerRadioDistraction(position) {
  const radioPosition = position.clone ? position.clone() : new THREE.Vector3().copy(position);
  const demonSt = getDemonState();

  detectionState.isRadioDistracted = true;
  detectionState.radioDistractTimer = DETECTION_CONFIG.radioDistractTime;
  detectionState.lastSoundPos.copy(radioPosition);
  alertDemon(radioPosition);
  demonSt.behaviorState = 'ALERTED';
  demonSt.alertTimer = 0;
  demonSt.huntTimer = 0;
  demonSt.alertPauseTimer = 0;
  demonSt.isIdle = false;
  demonSt.advanceAfterIdle = true;
  demonSt.targetPosition.copy(radioPosition);
  demonSt.lastStimulusPos.copy(radioPosition);
  updateState({ isHidden: true });
}

// Returns the current raw detection pressure from demon senses.
function getDetectionLevel() {
  return detectionState.currentDetectionLevel;
}

// Returns whether the player was seen before the current sight-loss timeout expired.
function isPlayerInSight() {
  return detectionState.wasInSight;
}

export {
  getDetectionLevel,
  initDetection,
  isPlayerInSight,
  triggerRadioDistraction,
  updateDetection,
};

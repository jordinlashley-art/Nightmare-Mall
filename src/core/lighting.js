import * as THREE from 'three';
import { camera } from './camera.js';
import { scene } from './scene.js';
import { getPlayerDirection, getPlayerPosition } from '../systems/player.js';
import { GameState, updateState } from '../systems/state.js';

const AMBIENT_COLOR = 0x1a0f0f;
const AMBIENT_INTENSITY = 0.3;
const FLUORESCENT_COLOR = 0xc8d4c0;
const FLUORESCENT_INTENSITY = 1.2;
const FLUORESCENT_DISTANCE = 12;
const FLUORESCENT_DECAY = 2;
const FLASHLIGHT_COLOR = 0xe8e0d0;
const FLASHLIGHT_INTENSITY = 8.0;
const FLASHLIGHT_DISTANCE = 20;
const FLASHLIGHT_ANGLE = Math.PI / 8;
const FLASHLIGHT_PENUMBRA = 0.3;
const FLASHLIGHT_DECAY = 1.5;
const PORTAL_COLOR = 0xff2200;
const FLICKER_STATE = {
  STABLE: 'STABLE',
  FLICKER: 'FLICKER',
  DYING: 'DYING',
  DEAD: 'DEAD',
};

const lights = {
  ambient: null,
  fluorescents: [],
  flashlight: null,
  portalLight: null,
};
const flickerStates = [];
const flashlightRaycaster = new THREE.Raycaster();
const flareNormalMatrix = new THREE.Matrix3();
const raycastTargets = [];

let flashlightTarget = null;
let flareSprite = null;
let flareTexture = null;

function getFluorescentPositions() {
  const northWing = [-36, -22, -8, 8, 22, 36].map((x) => ({ x, y: 3.8, z: -25 }));
  const southWing = [-36, -22, -8, 8, 22, 36].map((x) => ({ x, y: 3.8, z: 25 }));
  const foodCourt = [
    { x: -10, y: 3.8, z: -10 },
    { x: 10, y: 3.8, z: -10 },
    { x: -10, y: 3.8, z: 10 },
    { x: 10, y: 3.8, z: 10 },
  ];
  const connectors = [
    { x: 0, y: 3.8, z: -18 },
    { x: 0, y: 3.8, z: 18 },
  ];

  return [...northWing, ...southWing, ...foodCourt, ...connectors];
}

function getRandomFlickerState() {
  const roll = Math.random();

  if (roll < 0.4) {
    return FLICKER_STATE.STABLE;
  }

  if (roll < 0.7) {
    return FLICKER_STATE.FLICKER;
  }

  if (roll < 0.9) {
    return FLICKER_STATE.DYING;
  }

  return FLICKER_STATE.DEAD;
}

function getFlickerInterval(state) {
  if (state === FLICKER_STATE.FLICKER) {
    return 80 + Math.random() * 120;
  }

  if (state === FLICKER_STATE.DYING) {
    return 200 + Math.random() * 600;
  }

  return Infinity;
}

function createFixture(x, y, z, state) {
  const geometry = new THREE.BoxGeometry(1.5, 0.1, 0.3);
  const material = new THREE.MeshLambertMaterial({
    color: state === FLICKER_STATE.DEAD ? 0x222222 : 0x888888,
  });
  const fixtureBox = new THREE.Mesh(geometry, material);

  fixtureBox.position.set(x, y, z);
  fixtureBox.receiveShadow = false;
  fixtureBox.castShadow = false;
  scene.add(fixtureBox);

  return fixtureBox;
}

function createFlareTexture() {
  const canvas = document.createElement('canvas');

  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext('2d');

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,240,220,0.8)');
  gradient.addColorStop(1, 'rgba(255,240,220,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return new THREE.CanvasTexture(canvas);
}

function createFlareSprite() {
  flareTexture = createFlareTexture();

  const material = new THREE.SpriteMaterial({
    map: flareTexture,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);

  sprite.scale.set(0.4, 0.4, 0.4);
  sprite.visible = false;
  sprite.userData.ignoreFlashlightRay = true;
  scene.add(sprite);

  return sprite;
}

function cacheRaycastTargets() {
  raycastTargets.length = 0;
  scene.traverse((object) => {
    if (object.isMesh && !object.userData.ignoreFlashlightRay) {
      raycastTargets.push(object);
    }
  });
}

function removeFromScene(object) {
  if (!object) {
    return;
  }

  object.parent?.remove(object);
}

function disposeMesh(mesh) {
  removeFromScene(mesh);
  mesh.geometry?.dispose();

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => material.dispose());
  } else {
    mesh.material?.dispose();
  }
}

function clearLighting() {
  removeFromScene(lights.ambient);
  removeFromScene(lights.flashlight);
  removeFromScene(lights.portalLight);
  removeFromScene(flashlightTarget);

  lights.fluorescents.forEach(({ light, fixture }) => {
    removeFromScene(light);
    disposeMesh(fixture);
  });

  if (flareSprite) {
    removeFromScene(flareSprite);
    flareSprite.material.map?.dispose();
    flareSprite.material.dispose();
  }

  lights.ambient = null;
  lights.fluorescents.length = 0;
  lights.flashlight = null;
  lights.portalLight = null;
  flickerStates.length = 0;
  flashlightTarget = null;
  flareSprite = null;
  flareTexture = null;
}

function updateFixtureGlow(fixture, intensity) {
  fixture.material.color.setHex(intensity <= 0 ? 0x333333 : 0x888888);
}

function updateFlare(sourcePosition, playerDirection) {
  if (!flareSprite) {
    return;
  }

  const sourceOffset = sourcePosition.clone().add(playerDirection.clone().multiplyScalar(0.2));

  flareSprite.position.copy(sourceOffset);
  flareSprite.visible = GameState.flashlightOn;

  if (!GameState.flashlightOn) {
    flareSprite.material.opacity = 0;
    return;
  }

  flashlightRaycaster.set(sourcePosition, playerDirection);
  flashlightRaycaster.far = FLASHLIGHT_DISTANCE;

  const [hit] = flashlightRaycaster.intersectObjects(raycastTargets, false);
  let opacity = 0.08;

  if (hit) {
    flareNormalMatrix.getNormalMatrix(hit.object.matrixWorld);

    const worldNormal = hit.face.normal.clone().applyMatrix3(flareNormalMatrix).normalize();
    const surfaceDirectness = Math.max(0.2, -worldNormal.dot(playerDirection));
    const distanceFalloff = 1 - hit.distance / FLASHLIGHT_DISTANCE;

    opacity = THREE.MathUtils.clamp(
      0.12 + distanceFalloff * surfaceDirectness * 0.35,
      0.12,
      0.45,
    );
  }

  flareSprite.material.opacity = opacity;
}

function processFlickers(delta) {
  flickerStates.forEach((entry) => {
    if (entry.state === FLICKER_STATE.STABLE || entry.state === FLICKER_STATE.DEAD) {
      return;
    }

    entry.timer += delta * 1000;

    if (entry.timer < entry.interval) {
      return;
    }

    const fluorescent = lights.fluorescents[entry.index];

    entry.timer = 0;
    entry.interval = getFlickerInterval(entry.state);

    if (entry.state === FLICKER_STATE.FLICKER) {
      fluorescent.light.intensity = 0.9 + Math.random() * 0.3;
      return;
    }

    const intensity = Math.random() < 0.3 ? 0 : Math.random() * fluorescent.baseIntensity;

    fluorescent.light.intensity = intensity;
    updateFixtureGlow(fluorescent.fixture, intensity);
  });
}

// Initializes ambient, fluorescent, flashlight, and portal lighting layers.
function initLighting() {
  clearLighting();
  updateState({
    flashlightOn: false,
    flashlightVisible: false,
  });

  lights.ambient = new THREE.AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY);
  scene.add(lights.ambient);

  cacheRaycastTargets();

  getFluorescentPositions().forEach(({ x, y, z }, index) => {
    const state = getRandomFlickerState();
    const light = new THREE.PointLight(
      FLUORESCENT_COLOR,
      state === FLICKER_STATE.DEAD ? 0 : FLUORESCENT_INTENSITY,
      FLUORESCENT_DISTANCE,
      FLUORESCENT_DECAY,
    );

    light.position.set(x, y, z);
    light.castShadow = false;
    scene.add(light);

    const fixture = createFixture(x, 3.95, z, state);

    lights.fluorescents.push({
      light,
      state,
      fixture,
      baseIntensity: FLUORESCENT_INTENSITY,
      nextFlickerTime: 0,
    });
    flickerStates.push({
      index,
      state,
      timer: 0,
      interval: getFlickerInterval(state),
    });
  });

  cacheRaycastTargets();

  lights.flashlight = new THREE.SpotLight(
    FLASHLIGHT_COLOR,
    0,
    FLASHLIGHT_DISTANCE,
    FLASHLIGHT_ANGLE,
    FLASHLIGHT_PENUMBRA,
    FLASHLIGHT_DECAY,
  );
  lights.flashlight.castShadow = true;
  lights.flashlight.shadow.mapSize.width = 512;
  lights.flashlight.shadow.mapSize.height = 512;

  flashlightTarget = new THREE.Object3D();
  scene.add(flashlightTarget);
  lights.flashlight.target = flashlightTarget;
  scene.add(lights.flashlight);

  lights.portalLight = new THREE.PointLight(PORTAL_COLOR, 0, 15, 2);
  lights.portalLight.position.set(0, 2, 0);
  scene.add(lights.portalLight);

  flareSprite = createFlareSprite();
}

// Updates flashlight tracking, lens flare visibility, and fluorescent flickers.
function updateLighting(delta) {
  if (!lights.flashlight || !flashlightTarget) {
    return;
  }

  const playerPosition = getPlayerPosition();
  const playerDirection = getPlayerDirection();
  const sourcePosition = playerPosition.clone();

  sourcePosition.y = camera.position.y;
  lights.flashlight.position.copy(sourcePosition);
  flashlightTarget.position.copy(
    sourcePosition.clone().add(playerDirection.clone().multiplyScalar(10)),
  );
  lights.flashlight.intensity = GameState.flashlightOn ? FLASHLIGHT_INTENSITY : 0;

  updateFlare(sourcePosition, playerDirection);
  processFlickers(delta);
}

// Toggles the player flashlight and exposes the beam visibility to stealth systems.
function toggleFlashlight() {
  const flashlightOn = !GameState.flashlightOn;
  const patch = {
    flashlightOn,
    flashlightVisible: flashlightOn,
  };

  if (flashlightOn && GameState.isHidden) {
    patch.isHidden = false;
  }

  updateState(patch);
}

// Returns the dormant food court portal glow light for portal activation systems.
function getPortalLight() {
  return lights.portalLight;
}

export {
  getPortalLight,
  initLighting,
  toggleFlashlight,
  updateLighting,
};

import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { GameState, ITEM_TYPES, updateState } from '../systems/state.js';
import { onInteract } from '../systems/input.js';
import { getPlayerPosition } from '../systems/player.js';
import { incrementItemsFound } from '../ui/endScreens.js';
import { hidePickupPrompt, showPickupPrompt, triggerPickup } from '../ui/overlay.js';
import { ITEM_SPAWN_ZONES, STORE_DEFINITIONS } from './environment.js';

const worldItems = [];
const EXPLOSIVE_HISTORY_LIMIT = ITEM_SPAWN_ZONES.length;

let currentNearbyItem = null;
let explosiveSpawnZone = null;
let unregisterInteract = null;

const ITEM_GLOW_COLORS = {
  FLASHLIGHT: 0xffaa00,
  LIGHTER: 0xff6600,
  RADIO: 0x0066ff,
  ROPE: 0x886644,
  MEDKIT: 0x00cc44,
  EXPLOSIVE: 0xff2200,
};

const STATIC_SPAWN_POSITIONS = {
  FLASHLIGHT: new THREE.Vector3(6, 0.5, 28),
  LIGHTER: new THREE.Vector3(12, 0.5, -25),
  RADIO: new THREE.Vector3(-18, 0.5, -33),
  ROPE: new THREE.Vector3(18, 0.5, 33),
  MEDKIT: new THREE.Vector3(8, 0.5, 5),
};

function createItemEmoji(emoji) {
  const canvas = document.createElement('canvas');

  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext('2d');

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '72px serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(emoji, 64, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const sprite = new THREE.Sprite(material);

  sprite.scale.set(0.8, 0.8, 0.8);
  return sprite;
}

function createItemMesh(itemName, position) {
  const item = ITEM_TYPES[itemName];
  const glowColor = ITEM_GLOW_COLORS[itemName];
  const group = new THREE.Group();

  group.name = `WorldItem_${itemName}`;
  group.position.copy(position);

  const geometry = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16);
  const material = new THREE.MeshLambertMaterial({
    color: 0x333333,
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: 0.3,
  });
  const base = new THREE.Mesh(geometry, material);

  base.position.y = 0;
  base.receiveShadow = true;
  group.add(base);

  const innerGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16);
  const innerMat = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: 0.6,
  });
  const innerDisc = new THREE.Mesh(innerGeo, innerMat);

  innerDisc.position.y = 0.05;
  group.add(innerDisc);

  const sprite = createItemEmoji(item.icon);

  sprite.position.y = 0.8;
  group.add(sprite);

  const itemLight = new THREE.PointLight(glowColor, 0.8, 3, 2);

  itemLight.position.y = 0.3;
  group.add(itemLight);
  scene.add(group);

  return { group, itemLight };
}

function disposeMaterial(material) {
  material.map?.dispose();
  material.dispose();
}

function disposeItemMesh(itemMesh) {
  itemMesh.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (Array.isArray(object.material)) {
      object.material.forEach(disposeMaterial);
    } else if (object.material) {
      disposeMaterial(object.material);
    }
  });
}

function removeItemFromWorld(item, disposeImmediately = false) {
  const finalizeRemoval = () => {
    if (item.disposed) {
      return;
    }

    item.disposed = true;
    scene.remove(item.mesh);
    disposeItemMesh(item.mesh);
  };

  if (item.removalFrameId) {
    window.cancelAnimationFrame(item.removalFrameId);
    item.removalFrameId = null;
  }

  if (disposeImmediately) {
    finalizeRemoval();
    return;
  }

  const startedAt = performance.now();
  const startScale = item.mesh.scale.x;

  function animateScaleOut(now) {
    const progress = Math.min(1, (now - startedAt) / 200);
    const scale = THREE.MathUtils.lerp(startScale, 0.001, progress);

    item.mesh.scale.setScalar(scale);

    if (progress < 1) {
      item.removalFrameId = window.requestAnimationFrame(animateScaleOut);
      return;
    }

    item.removalFrameId = null;
    finalizeRemoval();
  }

  item.removalFrameId = window.requestAnimationFrame(animateScaleOut);
}

function clearWorldItems() {
  worldItems.forEach((item) => {
    if (!item.collected) {
      item.collected = true;
    }

    removeItemFromWorld(item, true);
  });
  worldItems.length = 0;
  currentNearbyItem = null;
  hidePickupPrompt();
}

function getExplosiveSpawnHistory() {
  return Array.isArray(GameState.explosiveSpawnStoreHistory)
    ? GameState.explosiveSpawnStoreHistory
    : [];
}

function chooseExplosiveSpawnZone() {
  const validStoreIds = new Set(STORE_DEFINITIONS.map((store) => store.id));
  const validZones = ITEM_SPAWN_ZONES.filter((zone) => validStoreIds.has(zone.storeId));
  const history = getExplosiveSpawnHistory();
  const unusedZones = validZones.filter((zone) => !history.includes(zone.storeId));
  const zones = unusedZones.length > 0
    ? unusedZones
    : validZones.filter((zone) => zone.storeId !== GameState.explosiveSpawnStoreId);

  return zones[Math.floor(Math.random() * zones.length)] ?? validZones[0];
}

function spawnItem(itemName, position) {
  const result = createItemMesh(itemName, position);

  worldItems.push({
    id: `${itemName}_${Date.now()}_${worldItems.length}`,
    name: itemName,
    position: position.clone(),
    mesh: result.group,
    light: result.itemLight,
    bobTime: Math.random() * Math.PI * 2,
    collected: false,
    removalFrameId: null,
    disposed: false,
  });
}

function handleInteract() {
  if (!currentNearbyItem) {
    return;
  }

  triggerPickup(currentNearbyItem.name);
}

// Spawns all discoverable world items for a fresh run.
function initItemSpawns() {
  clearWorldItems();

  explosiveSpawnZone = chooseExplosiveSpawnZone();

  const explosiveHistory = [
    ...getExplosiveSpawnHistory(),
    explosiveSpawnZone.storeId,
  ].slice(-EXPLOSIVE_HISTORY_LIMIT);

  updateState({
    explosiveSpawnStoreId: explosiveSpawnZone.storeId,
    explosiveSpawnStoreHistory: explosiveHistory,
  });

  spawnItem('EXPLOSIVE', explosiveSpawnZone.position);

  Object.entries(STATIC_SPAWN_POSITIONS).forEach(([itemName, position]) => {
    spawnItem(itemName, position);
  });

  if (!unregisterInteract) {
    unregisterInteract = onInteract(handleInteract);
  }
}

// Updates item idle animation and player proximity pickup prompts.
function updateItems(delta) {
  worldItems.forEach((item) => {
    if (item.collected) {
      return;
    }

    item.bobTime += delta * 1.5;
    item.mesh.position.y = item.position.y + Math.sin(item.bobTime) * 0.15;
    item.mesh.rotation.y += delta * 0.8;
  });

  const playerPos = getPlayerPosition();
  let nearestItem = null;
  let nearestDist = Infinity;

  worldItems.forEach((item) => {
    if (item.collected) {
      return;
    }

    const dist = playerPos.distanceTo(item.position);

    if (dist < 2.0 && dist < nearestDist) {
      nearestDist = dist;
      nearestItem = item;
    }
  });

  if (nearestItem === currentNearbyItem) {
    return;
  }

  if (nearestItem) {
    currentNearbyItem = nearestItem;
    showPickupPrompt(nearestItem.name);
    return;
  }

  currentNearbyItem = null;
  hidePickupPrompt();
}

// Removes a collected item from the world and records the pickup stat.
function collectItem(itemName) {
  const item = worldItems.find((worldItem) => (
    worldItem.name === itemName && !worldItem.collected
  ));

  if (!item) {
    return false;
  }

  item.collected = true;
  removeItemFromWorld(item);
  incrementItemsFound();
  currentNearbyItem = null;
  hidePickupPrompt();

  return true;
}

// Returns the item currently close enough for player interaction.
function getCurrentNearbyItem() {
  return currentNearbyItem;
}

// Returns all uncollected world items.
function getRemainingItems() {
  return worldItems.filter((item) => !item.collected);
}

// Returns the active explosive spawn zone for objective and AI systems.
function getExplosiveLocation() {
  return explosiveSpawnZone;
}

export {
  ITEM_GLOW_COLORS,
  STATIC_SPAWN_POSITIONS,
  collectItem,
  getCurrentNearbyItem,
  getExplosiveLocation,
  getRemainingItems,
  initItemSpawns,
  updateItems,
};

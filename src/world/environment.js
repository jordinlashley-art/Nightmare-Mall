import * as THREE from 'three';
import { scene as defaultScene } from '../core/scene.js';

const MATERIAL_COLORS = {
  floor: 0x1a1a1a,
  wall: 0x2a2426,
  ceiling: 0x111111,
  storeInterior: 0x1e1c1d,
  displayShelf: 0x2e2a2b,
  portalFloor: 0x1a0a0a,
  sign: 0x333333,
};

const MALL_CONFIG = {
  totalWidth: 90,
  totalDepth: 90,
  corridorWidth: 90,
  corridorDepth: 8,
  corridorHeight: 4,
  storeWidth: 14,
  storeDepth: 12,
  storeHeight: 8,
  storeOpening: 6,
  wallThickness: 0.5,
  foodCourtSize: 30,
  northWingZ: -25,
  southWingZ: 25,
  foodCourtZ: 0,
};

const STORE_DEFINITIONS = [
  {
    id: 'S1',
    name: 'RADIO SHACK',
    wing: 'north',
    index: 0,
    position: new THREE.Vector3(-36, 0, -29),
  },
  {
    id: 'S2',
    name: 'FAMILY PHOTOS',
    wing: 'north',
    index: 1,
    position: new THREE.Vector3(-18, 0, -29),
  },
  {
    id: 'S3',
    name: 'ARCADE',
    wing: 'north',
    index: 2,
    position: new THREE.Vector3(0, 0, -29),
  },
  {
    id: 'S4',
    name: 'SPORTING GOODS',
    wing: 'north',
    index: 3,
    position: new THREE.Vector3(18, 0, -29),
  },
  {
    id: 'S5',
    name: 'PHARMACY',
    wing: 'north',
    index: 4,
    position: new THREE.Vector3(36, 0, -29),
  },
  {
    id: 'S6',
    name: 'CLOTHING CO.',
    wing: 'south',
    index: 0,
    position: new THREE.Vector3(-36, 0, 29),
  },
  {
    id: 'S7',
    name: 'BOOKSTORE',
    wing: 'south',
    index: 1,
    position: new THREE.Vector3(-18, 0, 29),
  },
  {
    id: 'S8',
    name: 'ELECTRONICS',
    wing: 'south',
    index: 2,
    position: new THREE.Vector3(0, 0, 29),
  },
  {
    id: 'S9',
    name: 'TOY WORLD',
    wing: 'south',
    index: 3,
    position: new THREE.Vector3(18, 0, 29),
  },
  {
    id: 'S10',
    name: 'FOOD PREP',
    wing: 'south',
    index: 4,
    position: new THREE.Vector3(36, 0, 29),
  },
];

const ITEM_SPAWN_ZONES = [
  {
    storeId: 'S1',
    position: new THREE.Vector3(-36, 0.5, -34),
  },
  {
    storeId: 'S3',
    position: new THREE.Vector3(0, 0.5, -34),
  },
  {
    storeId: 'S5',
    position: new THREE.Vector3(36, 0.5, -34),
  },
  {
    storeId: 'S6',
    position: new THREE.Vector3(-36, 0.5, 34),
  },
  {
    storeId: 'S8',
    position: new THREE.Vector3(0, 0.5, 34),
  },
  {
    storeId: 'S10',
    position: new THREE.Vector3(36, 0.5, 34),
  },
];

const collisionObjects = [];

let environmentGroup = null;

function createBox({
  w,
  h,
  d,
  x,
  y,
  z,
  color,
  receiveShadow = false,
  castShadow = false,
  addToCollision = false,
}, targetScene) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  (environmentGroup ?? targetScene).add(mesh);

  if (addToCollision) {
    collisionObjects.push({
      mesh,
      box: new THREE.Box3().setFromObject(mesh),
    });
  }

  return mesh;
}

function addWallSegment(targetScene, { w, h, d, x, y, z }) {
  return createBox({
    w,
    h,
    d,
    x,
    y,
    z,
    color: MATERIAL_COLORS.wall,
    receiveShadow: true,
    castShadow: true,
    addToCollision: true,
  }, targetScene);
}

function buildPerimeter(targetScene) {
  const {
    totalWidth,
    totalDepth,
    corridorHeight,
    wallThickness,
  } = MALL_CONFIG;
  const halfWidth = totalWidth / 2;
  const halfDepth = totalDepth / 2;

  addWallSegment(targetScene, {
    w: totalWidth,
    h: corridorHeight,
    d: wallThickness,
    x: 0,
    y: corridorHeight / 2,
    z: -halfDepth,
  });
  addWallSegment(targetScene, {
    w: totalWidth,
    h: corridorHeight,
    d: wallThickness,
    x: 0,
    y: corridorHeight / 2,
    z: halfDepth,
  });
  addWallSegment(targetScene, {
    w: wallThickness,
    h: corridorHeight,
    d: totalDepth,
    x: -halfWidth,
    y: corridorHeight / 2,
    z: 0,
  });
  addWallSegment(targetScene, {
    w: wallThickness,
    h: corridorHeight,
    d: totalDepth,
    x: halfWidth,
    y: corridorHeight / 2,
    z: 0,
  });
}

function buildWingCorridorWalls(targetScene) {
  const {
    corridorHeight,
    corridorWidth,
    northWingZ,
    southWingZ,
    corridorDepth,
    wallThickness,
  } = MALL_CONFIG;
  const connectorOpening = 8;
  const segmentWidth = (corridorWidth - connectorOpening) / 2;
  const segmentOffset = connectorOpening / 2 + segmentWidth / 2;
  const northInnerZ = northWingZ + corridorDepth / 2;
  const southInnerZ = southWingZ - corridorDepth / 2;

  [-segmentOffset, segmentOffset].forEach((x) => {
    addWallSegment(targetScene, {
      w: segmentWidth,
      h: corridorHeight,
      d: wallThickness,
      x,
      y: corridorHeight / 2,
      z: northInnerZ,
    });
    addWallSegment(targetScene, {
      w: segmentWidth,
      h: corridorHeight,
      d: wallThickness,
      x,
      y: corridorHeight / 2,
      z: southInnerZ,
    });
  });
}

function buildFoodCourt(targetScene) {
  const {
    corridorHeight,
    foodCourtSize,
    wallThickness,
  } = MALL_CONFIG;
  const halfFoodCourt = foodCourtSize / 2;
  const openingWidth = 8;
  const segmentWidth = (foodCourtSize - openingWidth) / 2;
  const segmentOffset = openingWidth / 2 + segmentWidth / 2;

  createBox({
    w: foodCourtSize,
    h: 0.12,
    d: foodCourtSize,
    x: 0,
    y: -0.04,
    z: MALL_CONFIG.foodCourtZ,
    color: MATERIAL_COLORS.portalFloor,
    receiveShadow: true,
    castShadow: false,
    addToCollision: false,
  }, targetScene);

  addWallSegment(targetScene, {
    w: wallThickness,
    h: corridorHeight,
    d: foodCourtSize,
    x: -halfFoodCourt,
    y: corridorHeight / 2,
    z: 0,
  });
  addWallSegment(targetScene, {
    w: wallThickness,
    h: corridorHeight,
    d: foodCourtSize,
    x: halfFoodCourt,
    y: corridorHeight / 2,
    z: 0,
  });

  [-segmentOffset, segmentOffset].forEach((x) => {
    addWallSegment(targetScene, {
      w: segmentWidth,
      h: corridorHeight,
      d: wallThickness,
      x,
      y: corridorHeight / 2,
      z: -halfFoodCourt,
    });
    addWallSegment(targetScene, {
      w: segmentWidth,
      h: corridorHeight,
      d: wallThickness,
      x,
      y: corridorHeight / 2,
      z: halfFoodCourt,
    });
  });
}

function buildStore(targetScene, store) {
  const {
    storeWidth,
    storeDepth,
    storeHeight,
    storeOpening,
    wallThickness,
  } = MALL_CONFIG;
  const direction = store.wing === 'north' ? -1 : 1;
  const frontZ = store.position.z;
  const storeCenterZ = frontZ + direction * (storeDepth / 2);
  const backZ = frontZ + direction * storeDepth;
  const shelfZ = frontZ + direction * 3;
  const signZ = frontZ + direction * -0.1;
  const frontSegmentWidth = (storeWidth - storeOpening) / 2;
  const frontSegmentOffset = storeOpening / 2 + frontSegmentWidth / 2;

  createBox({
    w: storeWidth,
    h: 0.08,
    d: storeDepth,
    x: store.position.x,
    y: -0.03,
    z: storeCenterZ,
    color: MATERIAL_COLORS.storeInterior,
    receiveShadow: true,
    castShadow: false,
    addToCollision: false,
  }, targetScene);

  addWallSegment(targetScene, {
    w: storeWidth,
    h: storeHeight,
    d: wallThickness,
    x: store.position.x,
    y: storeHeight / 2,
    z: backZ,
  });
  addWallSegment(targetScene, {
    w: wallThickness,
    h: storeHeight,
    d: storeDepth,
    x: store.position.x - storeWidth / 2,
    y: storeHeight / 2,
    z: storeCenterZ,
  });
  addWallSegment(targetScene, {
    w: wallThickness,
    h: storeHeight,
    d: storeDepth,
    x: store.position.x + storeWidth / 2,
    y: storeHeight / 2,
    z: storeCenterZ,
  });
  addWallSegment(targetScene, {
    w: frontSegmentWidth,
    h: storeHeight,
    d: wallThickness,
    x: store.position.x - frontSegmentOffset,
    y: storeHeight / 2,
    z: frontZ,
  });
  addWallSegment(targetScene, {
    w: frontSegmentWidth,
    h: storeHeight,
    d: wallThickness,
    x: store.position.x + frontSegmentOffset,
    y: storeHeight / 2,
    z: frontZ,
  });

  createBox({
    w: storeWidth - 2,
    h: 1.0,
    d: 1.5,
    x: store.position.x,
    y: 0.5,
    z: shelfZ,
    color: MATERIAL_COLORS.displayShelf,
    receiveShadow: true,
    castShadow: true,
    addToCollision: true,
  }, targetScene);

  createBox({
    w: storeOpening,
    h: 0.4,
    d: 0.1,
    x: store.position.x,
    y: storeHeight - 0.5,
    z: signZ,
    color: MATERIAL_COLORS.sign,
    receiveShadow: false,
    castShadow: false,
    addToCollision: false,
  }, targetScene);
}

function buildConnectingCorridors(targetScene) {
  const {
    corridorHeight,
    foodCourtSize,
    northWingZ,
    southWingZ,
    corridorDepth,
    wallThickness,
  } = MALL_CONFIG;
  const connectorWidth = 8;
  const sideWallX = connectorWidth / 2;
  const northStartZ = northWingZ + corridorDepth / 2;
  const northEndZ = -foodCourtSize / 2;
  const southStartZ = southWingZ - corridorDepth / 2;
  const southEndZ = foodCourtSize / 2;
  const connectorDepth = Math.abs(northEndZ - northStartZ);
  const northCenterZ = (northStartZ + northEndZ) / 2;
  const southCenterZ = (southStartZ + southEndZ) / 2;

  [-sideWallX, sideWallX].forEach((x) => {
    addWallSegment(targetScene, {
      w: wallThickness,
      h: corridorHeight,
      d: connectorDepth,
      x,
      y: corridorHeight / 2,
      z: northCenterZ,
    });
    addWallSegment(targetScene, {
      w: wallThickness,
      h: corridorHeight,
      d: connectorDepth,
      x,
      y: corridorHeight / 2,
      z: southCenterZ,
    });
  });
}

function buildBoundaryGuards(targetScene) {
  const {
    totalWidth,
    totalDepth,
    corridorHeight,
    wallThickness,
  } = MALL_CONFIG;
  const halfWidth = totalWidth / 2;
  const halfDepth = totalDepth / 2;
  const guardThickness = wallThickness;

  [
    {
      w: totalWidth,
      h: corridorHeight,
      d: guardThickness,
      x: 0,
      y: corridorHeight / 2,
      z: -halfDepth - guardThickness,
    },
    {
      w: totalWidth,
      h: corridorHeight,
      d: guardThickness,
      x: 0,
      y: corridorHeight / 2,
      z: halfDepth + guardThickness,
    },
    {
      w: guardThickness,
      h: corridorHeight,
      d: totalDepth,
      x: -halfWidth - guardThickness,
      y: corridorHeight / 2,
      z: 0,
    },
    {
      w: guardThickness,
      h: corridorHeight,
      d: totalDepth,
      x: halfWidth + guardThickness,
      y: corridorHeight / 2,
      z: 0,
    },
  ].forEach((guard) => {
    createBox({
      ...guard,
      color: MATERIAL_COLORS.wall,
      receiveShadow: false,
      castShadow: false,
      addToCollision: true,
    }, targetScene);
  });
}

// Builds the mall environment and registers static collision geometry.
function initEnvironment(targetScene = defaultScene) {
  if (environmentGroup) {
    return environmentGroup;
  }

  environmentGroup = new THREE.Group();
  environmentGroup.name = 'MallEnvironment';
  targetScene.add(environmentGroup);

  createBox({
    w: MALL_CONFIG.totalWidth,
    h: 0.1,
    d: MALL_CONFIG.totalDepth,
    x: 0,
    y: -0.05,
    z: 0,
    color: MATERIAL_COLORS.floor,
    receiveShadow: true,
    castShadow: false,
    addToCollision: false,
  }, targetScene);

  createBox({
    w: MALL_CONFIG.totalWidth,
    h: 0.1,
    d: MALL_CONFIG.totalDepth,
    x: 0,
    y: MALL_CONFIG.corridorHeight,
    z: 0,
    color: MATERIAL_COLORS.ceiling,
    receiveShadow: false,
    castShadow: false,
    addToCollision: false,
  }, targetScene);

  buildPerimeter(targetScene);
  buildWingCorridorWalls(targetScene);
  buildFoodCourt(targetScene);
  STORE_DEFINITIONS.forEach((store) => {
    buildStore(targetScene, store);
  });
  buildConnectingCorridors(targetScene);
  buildBoundaryGuards(targetScene);

  return environmentGroup;
}

// Returns the playable mall boundary used as a final movement guard.
function getMallBounds() {
  return {
    minX: -44,
    maxX: 44,
    minZ: -44,
    maxZ: 44,
  };
}

// Finds a store definition by its store id.
function getStoreById(id) {
  return STORE_DEFINITIONS.find((store) => store.id === id);
}

// Returns the center point of the food court portal area.
function getFoodCourtCenter() {
  return new THREE.Vector3(0, 0, 0);
}

export {
  ITEM_SPAWN_ZONES,
  MALL_CONFIG,
  STORE_DEFINITIONS,
  collisionObjects,
  getFoodCourtCenter,
  getMallBounds,
  getStoreById,
  initEnvironment,
};

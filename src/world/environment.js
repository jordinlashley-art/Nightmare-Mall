import * as THREE from 'three';

function initEnvironment(scene) {
  const floorGeometry = new THREE.PlaneGeometry(50, 50);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x242424,
    roughness: 0.9,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x303030,
    roughness: 0.85,
  });
  const wallGeometry = new THREE.BoxGeometry(10, 4, 0.5);
  const wallPositions = [
    [0, 2, -10],
    [0, 2, 10],
    [-10, 2, 0],
    [10, 2, 0],
  ];

  wallPositions.forEach(([x, y, z], index) => {
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;

    if (index > 1) {
      wall.rotation.y = Math.PI / 2;
    }

    scene.add(wall);
  });
}

export { initEnvironment };

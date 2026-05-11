import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const ambientLight = new THREE.AmbientLight(0x2a2a35, 0.18);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffaa66, 1.25, 18);
pointLight.position.set(2, 4, 2);
pointLight.castShadow = true;
scene.add(pointLight);

export { scene };

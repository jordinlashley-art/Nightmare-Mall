import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050303);
scene.fog = new THREE.FogExp2(0x050303, 0.035);

export { scene };

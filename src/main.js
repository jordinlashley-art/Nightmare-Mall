import { camera } from './core/camera.js';
import { renderer } from './core/renderer.js';
import { scene } from './core/scene.js';
import { initEnvironment } from './world/environment.js';
import {
  initHUD,
  updateFearMeter,
  updateObjectiveTracker,
  updateStealthIndicator,
} from './ui/hud.js';
import { initCompass, setDemonProximity, updateCompass } from './ui/compass.js';
import { initMenu } from './ui/menu.js';
import {
  closeInspectOverlay,
  initOverlay,
  openInspectOverlay,
  updateVignette,
} from './ui/overlay.js';
import { initPlantUI } from './ui/plantUI.js';
import { GameState } from './systems/state.js';
import { onInspectHold } from './systems/input.js';

document.body.appendChild(renderer.domElement);

initEnvironment(scene);
initHUD();
initCompass();
initMenu();
initOverlay();
initPlantUI();

onInspectHold(
  () => openInspectOverlay(),
  () => closeInspectOverlay(),
);

// TEMP TEST — remove before PROMPT 10
// Simulates a demon patrol pattern across all directions
// Tests all threat tiers and fear bleed behavior

const demonPatrol = [
  { north: 0, south: 0, east: 0, west: 0 }, // all clear
  { north: 20, south: 0, east: 0, west: 0 }, // LOW north
  { north: 50, south: 0, east: 30, west: 0 }, // MED north, LOW east
  { north: 80, south: 0, east: 60, west: 0 }, // HIGH north, MED east
  { north: 90, south: 0, east: 80, west: 40 }, // HIGH north+east, MED west
  { north: 40, south: 70, east: 90, west: 80 }, // demon swarm
  { north: 0, south: 20, east: 0, west: 0 }, // clearing
  { north: 0, south: 0, east: 0, west: 0 }, // all clear
];
let patrolIndex = 0;

setInterval(() => {
  setDemonProximity(demonPatrol[patrolIndex % demonPatrol.length]);
  patrolIndex++;
}, 2000);

// Observe:
// Arrows fade in/out per direction
// Colors shift low → med → high correctly
// Inward pulse fires on HIGH transitions
// Fear meter bleeds upward during HIGH states
// "NEAR" and "CLOSE" labels appear correctly
// Screen edge arrows do not overlap other HUD elements

function animate() {
  if (!GameState.isInspecting) {
    updateStealthIndicator();
    updateFearMeter(GameState.fear);
  }

  updateCompass();
  updateVignette(GameState.fear);
  updateObjectiveTracker();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

export { GameState };

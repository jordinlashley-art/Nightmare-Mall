import { camera } from './core/camera.js';
import { renderer } from './core/renderer.js';
import { scene } from './core/scene.js';
import { initEnvironment } from './world/environment.js';
import { initHUD } from './ui/hud.js';
import { initMenu } from './ui/menu.js';
import { initOverlay } from './ui/overlay.js';
import { GameState } from './systems/state.js';
import './systems/input.js';

document.body.appendChild(renderer.domElement);

initEnvironment(scene);
initHUD();
initMenu();
initOverlay();

function animate() {
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

export { GameState };

import { GameState, updateState } from '../systems/state.js';

let pickupHideTimeout = null;

function getHUD() {
  let hud = document.getElementById('hud');

  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'hud';
    document.body.appendChild(hud);
  }

  return hud;
}

// Initializes UI overlays.
function initOverlay() {
  initVignette();
  initPickupPrompt();
}

// Initializes the fear vignette overlay.
function initVignette() {
  const hud = getHUD();
  let vignette = document.getElementById('vignette');

  if (!vignette) {
    vignette = document.createElement('div');
    vignette.id = 'vignette';
    hud.appendChild(vignette);
  }

  updateVignette(0);
  return vignette;
}

// Initializes the item pickup prompt overlay.
function initPickupPrompt() {
  const hud = getHUD();
  let pickupPrompt = document.getElementById('pickup-prompt');

  if (!pickupPrompt) {
    pickupPrompt = document.createElement('div');
    pickupPrompt.id = 'pickup-prompt';
    pickupPrompt.innerHTML = `
      <div id="pickup-key">
        <span>E</span>
      </div>
      <div id="pickup-text">
        <span id="pickup-verb">Pick up</span>
        <span id="pickup-item-name">ITEM</span>
      </div>
      <div id="pickup-inventory-warning"></div>
    `;
    hud.appendChild(pickupPrompt);
  }

  return pickupPrompt;
}

// Updates vignette opacity based on the current fear value.
function updateVignette(fearValue) {
  const numericFear = Number(fearValue);
  const clampedFear = Math.min(
    100,
    Math.max(0, Number.isFinite(numericFear) ? numericFear : 0),
  );
  const vignette = document.getElementById('vignette');
  let opacity = 0;

  if (clampedFear >= 67) {
    opacity = 0.5 + ((clampedFear - 67) / 33) * 0.4;
  } else if (clampedFear >= 34) {
    opacity = 0.2 + ((clampedFear - 34) / 32) * 0.3;
  }

  if (vignette) {
    vignette.style.opacity = opacity.toFixed(2);
  }
}

// Shows the pickup prompt for an item or an inventory-full warning.
function showPickupPrompt(itemName) {
  const pickupPrompt = initPickupPrompt();
  const pickupVerb = document.getElementById('pickup-verb');
  const pickupItemName = document.getElementById('pickup-item-name');
  const pickupInventoryWarning = document.getElementById('pickup-inventory-warning');
  const inventoryFull = GameState.inventory.length >= 4;

  if (pickupHideTimeout) {
    window.clearTimeout(pickupHideTimeout);
    pickupHideTimeout = null;
  }

  pickupPrompt.style.transitionDuration = '0.3s';
  pickupPrompt.style.visibility = 'visible';

  if (inventoryFull) {
    pickupPrompt.classList.add('full');
    pickupInventoryWarning.textContent = 'INVENTORY FULL';
    pickupVerb.textContent = 'Cannot pick up';
    pickupItemName.textContent = itemName;
  } else {
    pickupPrompt.classList.remove('full');
    pickupInventoryWarning.textContent = '';
    pickupVerb.textContent = 'Pick up';
    pickupItemName.textContent = itemName;
  }

  pickupPrompt.style.opacity = '1';
}

// Hides the pickup prompt after its fade-out transition completes.
function hidePickupPrompt() {
  const pickupPrompt = document.getElementById('pickup-prompt');

  if (!pickupPrompt) {
    return;
  }

  if (pickupHideTimeout) {
    window.clearTimeout(pickupHideTimeout);
  }

  pickupPrompt.style.transitionDuration = '0.2s';
  pickupPrompt.style.opacity = '0';
  pickupHideTimeout = window.setTimeout(() => {
    if (pickupPrompt.style.opacity === '0') {
      pickupPrompt.style.visibility = 'hidden';
    }

    pickupHideTimeout = null;
  }, 200);
}

// Attempts to pick up an item and returns whether it was added to inventory.
function triggerPickup(itemName) {
  const pickupPrompt = initPickupPrompt();

  if (GameState.inventory.length >= 4) {
    return false;
  }

  GameState.inventory.push(itemName);
  updateState({ inventory: GameState.inventory });

  pickupPrompt.classList.remove('pickup-flash');
  void pickupPrompt.offsetWidth;
  pickupPrompt.classList.add('pickup-flash');

  window.setTimeout(() => {
    pickupPrompt.classList.remove('pickup-flash');
    hidePickupPrompt();
  }, 400);

  return true;
}

export {
  hidePickupPrompt,
  initOverlay,
  initPickupPrompt,
  initVignette,
  showPickupPrompt,
  triggerPickup,
  updateVignette,
};

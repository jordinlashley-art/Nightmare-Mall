import { GameState, ITEM_TYPES, updateState } from '../systems/state.js';
import { collectItem } from '../world/items.js';

let pickupHideTimeout = null;
let inspectTypewriterInterval = null;
let inspectHideTimeout = null;
let inspectStateListenerBound = false;
let cancelTypewriterRequested = false;

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
  initInspectOverlay();
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

// Initializes the full-screen item inspection overlay.
function initInspectOverlay() {
  let inspectOverlay = document.getElementById('inspect-overlay');

  if (!inspectOverlay) {
    inspectOverlay = document.createElement('div');
    inspectOverlay.id = 'inspect-overlay';
    inspectOverlay.innerHTML = `
      <div id="inspect-content">
        <div id="inspect-icon"></div>
        <div id="inspect-name"></div>
        <div id="inspect-divider"></div>
        <div id="inspect-description"></div>
        <div id="inspect-meta">
          <div class="meta-block">
            <div class="meta-label">SLOT</div>
            <div id="inspect-slot" class="meta-value"></div>
          </div>
          <div class="meta-block">
            <div class="meta-label">STATUS</div>
            <div class="meta-value">CARRIED</div>
          </div>
        </div>
        <div id="inspect-hint">[ TAB ] to close</div>
      </div>
    `;
    document.body.appendChild(inspectOverlay);
  }

  if (!inspectStateListenerBound) {
    window.addEventListener('game-state-updated', handleInspectStateUpdate);
    inspectStateListenerBound = true;
  }

  return inspectOverlay;
}

// Cancels any active item description typewriter animation.
function cancelTypewriter() {
  cancelTypewriterRequested = true;

  if (inspectTypewriterInterval) {
    window.clearInterval(inspectTypewriterInterval);
    inspectTypewriterInterval = null;
  }
}

function getActiveInspectItem() {
  const itemName = GameState.inventory[GameState.activeSlot];

  if (!itemName) {
    return null;
  }

  return {
    itemName,
    item: ITEM_TYPES[itemName],
  };
}

function handleInspectStateUpdate(event) {
  const patch = event.detail?.patch;

  if (
    !GameState.isInspecting
    || !patch
    || (!('inventory' in patch) && !('activeSlot' in patch))
  ) {
    return;
  }

  if (!GameState.inventory[GameState.activeSlot]) {
    closeInspectOverlay();
  }
}

function formatInspectName(name) {
  return name.split('').join(' ');
}

function typewriterEffect(text) {
  const description = document.getElementById('inspect-description');
  const safeText = String(text);
  let characterIndex = 0;

  if (!description) {
    return;
  }

  cancelTypewriter();
  cancelTypewriterRequested = false;
  description.textContent = '';

  inspectTypewriterInterval = window.setInterval(() => {
    if (cancelTypewriterRequested) {
      cancelTypewriter();
      return;
    }

    description.textContent += safeText.charAt(characterIndex);
    characterIndex++;

    if (characterIndex >= safeText.length) {
      cancelTypewriter();
    }
  }, 30);
}

// Opens the item inspection overlay for the current active inventory slot.
function openInspectOverlay() {
  const activeItem = getActiveInspectItem();

  if (!activeItem || !activeItem.item) {
    return;
  }

  const inspectOverlay = initInspectOverlay();
  const inspectIcon = document.getElementById('inspect-icon');
  const inspectName = document.getElementById('inspect-name');
  const inspectSlot = document.getElementById('inspect-slot');

  if (inspectHideTimeout) {
    window.clearTimeout(inspectHideTimeout);
    inspectHideTimeout = null;
  }

  if (inspectIcon) {
    inspectIcon.innerHTML = activeItem.item.icon;
  }

  if (inspectName) {
    inspectName.textContent = formatInspectName(activeItem.item.name);
  }

  if (inspectSlot) {
    inspectSlot.textContent = String(GameState.activeSlot + 1);
  }

  typewriterEffect(activeItem.item.description);
  inspectOverlay.style.transitionDuration = '0.4s';
  inspectOverlay.style.visibility = 'visible';
  inspectOverlay.style.opacity = '1';
  updateState({ isInspecting: true });
}

// Closes the item inspection overlay and resumes normal game tension.
function closeInspectOverlay() {
  const inspectOverlay = document.getElementById('inspect-overlay');

  cancelTypewriter();
  updateState({ isInspecting: false });

  if (!inspectOverlay) {
    return;
  }

  if (inspectHideTimeout) {
    window.clearTimeout(inspectHideTimeout);
  }

  inspectOverlay.style.transitionDuration = '0.2s';
  inspectOverlay.style.opacity = '0';
  inspectHideTimeout = window.setTimeout(() => {
    if (inspectOverlay.style.opacity === '0') {
      inspectOverlay.style.visibility = 'hidden';
    }

    inspectHideTimeout = null;
  }, 200);
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
  collectItem(itemName);

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
  cancelTypewriter,
  closeInspectOverlay,
  hidePickupPrompt,
  initInspectOverlay,
  initOverlay,
  initPickupPrompt,
  initVignette,
  openInspectOverlay,
  showPickupPrompt,
  triggerPickup,
  updateVignette,
};

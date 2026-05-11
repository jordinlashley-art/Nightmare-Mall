import './ui.css';
import { GameState, ITEM_TYPES, updateState } from '../systems/state.js';

const QUICK_SLOT_COUNT = 4;
const SLOT_NAME_MAX_LENGTH = 8;
const STEALTH_STATE_CLASSES = ['hidden-state', 'safe', 'detected', 'compromised'];
const OBJECTIVE_STATE_CLASSES = ['state-search', 'state-armed', 'state-planted'];
const OBJECTIVE_STATES = {
  search: {
    className: 'state-search',
    text: 'Find the explosive',
    subText: "Search the mall. It's here somewhere.",
  },
  armed: {
    className: 'state-armed',
    text: 'Plant the explosive',
    subText: 'Find the hell portal. End this.',
  },
  planted: {
    className: 'state-planted',
    text: 'GET OUT NOW',
    subText: 'Do not look back.',
  },
};
let quickSlotStateListenerBound = false;
let lastObjectiveState = null;
let objectiveSwapTimeoutId = null;
let objectiveSubTimeoutId = null;
let objectiveRenderToken = 0;
const useHintContext = {
  nearRopeClimbPoint: false,
};

function initFearMeter() {
  const hud = initHUDContainer();
  let fearMeter = document.getElementById('fear-meter');

  if (!fearMeter) {
    fearMeter = document.createElement('div');
    fearMeter.id = 'fear-meter';
    fearMeter.innerHTML = `
      <div id="fear-label">FEAR</div>
      <div id="fear-bar-container">
        <div id="fear-bar-fill"></div>
      </div>
      <div id="fear-value">0%</div>
    `;
    hud.appendChild(fearMeter);
  }

  updateFearMeter(GameState.fear);
  return fearMeter;
}

// Initializes the stealth detection indicator.
function initStealthIndicator() {
  const hud = initHUDContainer();
  let stealthIndicator = document.getElementById('stealth-indicator');

  if (!stealthIndicator) {
    stealthIndicator = document.createElement('div');
    stealthIndicator.id = 'stealth-indicator';
    stealthIndicator.innerHTML = `
      <div id="stealth-icon">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path id="eye-open" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle id="eye-pupil" cx="12" cy="12" r="3"></circle>
          <path id="eye-closed" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" hidden></path>
        </svg>
      </div>
      <div id="stealth-label">SAFE</div>
      <div id="stealth-bar-container">
        <div id="stealth-bar-fill"></div>
      </div>
    `;
    hud.appendChild(stealthIndicator);
  }

  updateStealthIndicator();
  return stealthIndicator;
}

function handleQuickSlotStateUpdate(event) {
  if (event.detail?.patch && 'inventory' in event.detail.patch) {
    updateQuickSlots();
  }
}

function initQuickSlots() {
  const hud = initHUDContainer();
  let quickSlots = document.getElementById('quick-slots');

  if (!quickSlots) {
    quickSlots = document.createElement('div');
    quickSlots.id = 'quick-slots';
    quickSlots.innerHTML = `
      <div class="slot" data-slot="0">
        <div class="slot-icon"></div>
        <div class="slot-name"></div>
        <div class="slot-key">1</div>
      </div>
      <div class="slot" data-slot="1">
        <div class="slot-icon"></div>
        <div class="slot-name"></div>
        <div class="slot-key">2</div>
      </div>
      <div class="slot" data-slot="2">
        <div class="slot-icon"></div>
        <div class="slot-name"></div>
        <div class="slot-key">3</div>
      </div>
      <div class="slot" data-slot="3">
        <div class="slot-icon"></div>
        <div class="slot-name"></div>
        <div class="slot-key">4</div>
      </div>
    `;
    quickSlots.querySelectorAll('.slot').forEach((slot) => {
      slot.addEventListener('click', () => setActiveSlot(Number(slot.dataset.slot)));
    });
    hud.appendChild(quickSlots);
  }

  if (typeof window !== 'undefined' && !quickSlotStateListenerBound) {
    window.addEventListener('game-state-updated', handleQuickSlotStateUpdate);
    quickSlotStateListenerBound = true;
  }

  updateQuickSlots();
  return quickSlots;
}

function initUseHints() {
  const hud = initHUDContainer();
  let useHints = document.getElementById('use-hints');

  if (!useHints) {
    useHints = document.createElement('div');
    useHints.id = 'use-hints';
    useHints.innerHTML = `
      <div id="hint-f">
        <span class="hint-key">F</span>
        <span class="hint-label">FLASHLIGHT</span>
      </div>
      <div id="hint-q">
        <span class="hint-key">Q</span>
        <span class="hint-label">USE</span>
      </div>
      <div id="hint-r">
        <span class="hint-key">R</span>
        <span class="hint-label">THROW</span>
      </div>
    `;
    hud.appendChild(useHints);
  }

  updateUseHints();
  return useHints;
}

// Initializes the top-left objective tracker.
function initObjectiveTracker() {
  const hud = initHUDContainer();
  let objectiveTracker = document.getElementById('objective-tracker');

  if (!objectiveTracker) {
    objectiveTracker = document.createElement('div');
    objectiveTracker.id = 'objective-tracker';
    objectiveTracker.innerHTML = `
      <div id="objective-header">OBJECTIVE</div>
      <div id="objective-main">
        <span id="objective-chevron">►</span>
        <span id="objective-text"></span>
      </div>
      <div id="objective-sub"></div>
    `;
    hud.appendChild(objectiveTracker);
  }

  updateObjectiveTracker();
  return objectiveTracker;
}

function initHUDContainer() {
  let hud = document.getElementById('hud');

  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'hud';
    document.body.appendChild(hud);
  }

  return hud;
}

// Initializes the persistent heads-up display.
function initHUD() {
  const hud = initHUDContainer();
  initFearMeter();
  initQuickSlots();
  initUseHints();
  initStealthIndicator();
  initObjectiveTracker();

  return hud;
}

function setHintDimmed(hint, isDimmed) {
  hint?.classList.toggle('dimmed', isDimmed);
}

function setHintActive(hint, isActive) {
  hint?.classList.toggle('active-hint', isActive);
}

// Updates item action hint labels, availability, and active light states.
function updateUseHints() {
  const hintF = document.getElementById('hint-f');
  const hintQ = document.getElementById('hint-q');
  const hintR = document.getElementById('hint-r');
  const qLabel = hintQ?.querySelector('.hint-label');
  const rLabel = hintR?.querySelector('.hint-label');
  const activeItem = GameState.inventory[GameState.activeSlot];
  let qText = 'USE';

  if (!hintF || !hintQ || !hintR || !qLabel || !rLabel) {
    return;
  }

  switch (activeItem) {
    case ITEM_TYPES.LIGHTER.name:
      qText = 'TOGGLE LIGHTER';
      break;
    case ITEM_TYPES.MEDKIT.name:
      qText = 'USE MEDKIT';
      break;
    case ITEM_TYPES.ROPE.name:
      qText = useHintContext.nearRopeClimbPoint ? 'CLIMB' : 'USE ROPE';
      break;
    default:
      qText = 'USE';
      break;
  }

  qLabel.textContent = qText;
  rLabel.textContent = activeItem === ITEM_TYPES.RADIO.name ? 'THROW RADIO' : 'THROW';

  setHintDimmed(hintF, !GameState.inventory.includes(ITEM_TYPES.FLASHLIGHT.name));
  setHintDimmed(hintQ, !activeItem || activeItem === ITEM_TYPES.RADIO.name || activeItem === ITEM_TYPES.FLASHLIGHT.name);
  setHintDimmed(hintR, activeItem !== ITEM_TYPES.RADIO.name);

  setHintActive(hintF, GameState.flashlightOn);
  setHintActive(hintQ, GameState.lighterOn && activeItem === ITEM_TYPES.LIGHTER.name);
  setHintActive(hintR, false);
}

// Updates HUD-only context that item systems calculate outside the UI layer.
function setUseHintContext(context) {
  Object.assign(useHintContext, context);
}

// Updates the quick-slot inventory bar from the current game state.
function updateQuickSlots() {
  const quickSlots = document.getElementById('quick-slots');

  if (!quickSlots) {
    return;
  }

  for (let index = 0; index < QUICK_SLOT_COUNT; index++) {
    const slot = quickSlots.querySelector(`[data-slot="${index}"]`);
    const slotIcon = slot?.querySelector('.slot-icon');
    const slotName = slot?.querySelector('.slot-name');
    const itemName = GameState.inventory[index];
    const itemType = ITEM_TYPES[itemName];

    if (!slot || !slotIcon || !slotName) {
      continue;
    }

    if (itemName) {
      slot.classList.add('occupied');
      slot.classList.remove('empty');
      slotIcon.innerHTML = itemType?.icon ?? '?';
      slotName.textContent = itemName.slice(0, SLOT_NAME_MAX_LENGTH);
    } else {
      slot.classList.add('empty');
      slot.classList.remove('occupied');
      slotIcon.innerHTML = '+';
      slotName.textContent = '';
    }

    slot.classList.toggle('active', index === GameState.activeSlot);
  }
}

// Selects the active quick-slot index and refreshes the slot bar.
function setActiveSlot(index) {
  const numericIndex = Number(index);
  const safeIndex = Number.isFinite(numericIndex) ? Math.trunc(numericIndex) : 0;
  const activeSlot = Math.min(QUICK_SLOT_COUNT - 1, Math.max(0, safeIndex));

  updateState({ activeSlot });
  updateQuickSlots();
}

// Updates the fear meter display and synchronizes the game state.
function updateFearMeter(fearValue) {
  const numericFear = Number(fearValue);
  const clampedFear = Math.min(
    100,
    Math.max(0, Number.isFinite(numericFear) ? numericFear : 0),
  );
  const fearMeter = document.getElementById('fear-meter');
  const fearBarFill = document.getElementById('fear-bar-fill');
  const fearValueDisplay = document.getElementById('fear-value');
  let fearState = 'calm';

  if (clampedFear >= 67) {
    fearState = 'terror';
  } else if (clampedFear >= 34) {
    fearState = 'anxious';
  }

  updateState({ fear: clampedFear });

  if (!fearMeter || !fearBarFill || !fearValueDisplay) {
    return;
  }

  fearBarFill.style.width = `${clampedFear}%`;
  fearValueDisplay.textContent = `${Math.round(clampedFear)}%`;
  fearMeter.classList.remove('calm', 'anxious', 'terror');
  fearMeter.classList.add(fearState);
}

// Updates the stealth indicator display from detection and cover state.
function updateStealthIndicator() {
  const stealthIndicator = document.getElementById('stealth-indicator');
  const stealthLabel = document.getElementById('stealth-label');
  const stealthBarFill = document.getElementById('stealth-bar-fill');
  const eyeOpen = document.getElementById('eye-open');
  const eyePupil = document.getElementById('eye-pupil');
  const eyeClosed = document.getElementById('eye-closed');
  const detectionLevel = Math.min(
    100,
    Math.max(0, Number.isFinite(GameState.detectionLevel) ? GameState.detectionLevel : 0),
  );
  let stealthState = 'safe';
  let stealthLabelText = 'SAFE';

  if (GameState.isHidden) {
    stealthState = 'hidden-state';
    stealthLabelText = 'HIDDEN';
  } else if (detectionLevel >= 75) {
    stealthState = 'compromised';
    stealthLabelText = 'IT KNOWS';
  } else if (detectionLevel >= 26) {
    stealthState = 'detected';
    stealthLabelText = 'SEARCHING...';
  }

  if (!stealthIndicator || !stealthLabel || !stealthBarFill || !eyeOpen || !eyePupil || !eyeClosed) {
    return;
  }

  stealthIndicator.classList.remove(...STEALTH_STATE_CLASSES);
  stealthIndicator.classList.add(stealthState);
  stealthLabel.textContent = stealthLabelText;
  stealthBarFill.style.width = `${detectionLevel}%`;

  eyeOpen.hidden = GameState.isHidden;
  eyePupil.hidden = GameState.isHidden;
  eyeClosed.hidden = !GameState.isHidden;
}

function getCurrentObjectiveState() {
  const explosiveName = ITEM_TYPES.EXPLOSIVE.name;

  if (!GameState.isAlive || GameState.playerReachedExit) {
    return 'complete';
  }

  if (GameState.explosivesPlanted) {
    return 'planted';
  }

  if (GameState.inventory.includes(explosiveName)) {
    return 'armed';
  }

  return 'search';
}

function clearObjectiveTimers() {
  objectiveRenderToken++;

  if (objectiveSwapTimeoutId) {
    window.clearTimeout(objectiveSwapTimeoutId);
    objectiveSwapTimeoutId = null;
  }

  if (objectiveSubTimeoutId) {
    window.clearTimeout(objectiveSubTimeoutId);
    objectiveSubTimeoutId = null;
  }
}

function renderObjectiveState(stateKey) {
  const objectiveTracker = document.getElementById('objective-tracker');
  const objectiveText = document.getElementById('objective-text');
  const objectiveSub = document.getElementById('objective-sub');
  const objectiveState = OBJECTIVE_STATES[stateKey];

  if (!objectiveTracker || !objectiveText || !objectiveSub || !objectiveState) {
    return;
  }

  objectiveTracker.classList.remove(...OBJECTIVE_STATE_CLASSES);
  objectiveTracker.classList.add(objectiveState.className);
  objectiveText.textContent = objectiveState.text;
  objectiveSub.textContent = objectiveState.subText;
  objectiveSub.classList.remove('visible');
}

function scheduleObjectiveSubFade(stateKey, renderToken) {
  const objectiveSub = document.getElementById('objective-sub');

  if (!objectiveSub || stateKey === 'planted') {
    return;
  }

  objectiveSubTimeoutId = window.setTimeout(() => {
    if (renderToken !== objectiveRenderToken || GameState.isInspecting) {
      return;
    }

    objectiveSub.classList.add('visible');
    objectiveSubTimeoutId = null;
  }, 500);
}

function hideObjectiveTracker() {
  const objectiveTracker = document.getElementById('objective-tracker');

  if (!objectiveTracker) {
    return;
  }

  clearObjectiveTimers();
  objectiveTracker.style.transitionDuration = '0.2s';
  objectiveTracker.style.opacity = '0';
  objectiveTracker.style.visibility = 'hidden';
}

// Updates the objective tracker from the current game state.
function updateObjectiveTracker() {
  const objectiveTracker = document.getElementById('objective-tracker');

  if (!objectiveTracker) {
    return;
  }

  if (GameState.isInspecting) {
    hideObjectiveTracker();
    return;
  }

  objectiveTracker.style.visibility = 'visible';

  const currentObjectiveState = getCurrentObjectiveState();

  if (currentObjectiveState === 'complete') {
    hideObjectiveTracker();
    lastObjectiveState = currentObjectiveState;
    return;
  }

  if (currentObjectiveState === lastObjectiveState) {
    const objectiveSub = document.getElementById('objective-sub');

    if (objectiveSwapTimeoutId) {
      return;
    }

    if (
      currentObjectiveState !== 'planted'
      && objectiveSub
      && !objectiveSub.classList.contains('visible')
      && !objectiveSubTimeoutId
    ) {
      scheduleObjectiveSubFade(currentObjectiveState, objectiveRenderToken);
    }

    objectiveTracker.style.transitionDuration = '0.3s';
    objectiveTracker.style.opacity = '1';
    return;
  }

  clearObjectiveTimers();

  const shouldFadeSwap = lastObjectiveState !== null;
  const renderToken = objectiveRenderToken;
  lastObjectiveState = currentObjectiveState;

  if (!shouldFadeSwap) {
    renderObjectiveState(currentObjectiveState);
    objectiveTracker.style.transitionDuration = '0.3s';
    objectiveTracker.style.opacity = '1';
    scheduleObjectiveSubFade(currentObjectiveState, renderToken);
    return;
  }

  objectiveTracker.style.transitionDuration = '0.2s';
  objectiveTracker.style.opacity = '0';
  objectiveSwapTimeoutId = window.setTimeout(() => {
    if (renderToken !== objectiveRenderToken || GameState.isInspecting) {
      return;
    }

    renderObjectiveState(currentObjectiveState);
    objectiveTracker.style.transitionDuration = '0.3s';
    objectiveTracker.style.opacity = '1';
    objectiveSwapTimeoutId = null;
    scheduleObjectiveSubFade(currentObjectiveState, renderToken);
  }, 200);
}

export {
  initHUD,
  setActiveSlot,
  updateFearMeter,
  updateObjectiveTracker,
  updateQuickSlots,
  updateStealthIndicator,
  updateUseHints,
  setUseHintContext,
};

import { GameState, updateState } from './state.js';
import { updateQuickSlots } from '../ui/hud.js';
import { getPlayerPosition } from './player.js';

const trackedKeys = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowleft',
  'arrowdown',
  'arrowright',
  'shift',
  'c',
  'e',
  'f',
  'r',
  'tab',
  '1',
  '2',
  '3',
  '4',
]);

const keyboardState = {};
const interactCallbacks = new Set();
const inspectHoldCallbacks = new Set();
const slotSelectCallbacks = new Set();
const crouchToggleCallbacks = new Set();
const flashlightToggleCallbacks = new Set();
const radioUseCallbacks = new Set();
const INTERACT_DEBOUNCE_MS = 500;
let lastInteractAt = 0;

trackedKeys.forEach((key) => {
  keyboardState[key] = false;
});

function normalizeKey(key) {
  return key.toLowerCase();
}

function setKeyState(event, isPressed) {
  const key = normalizeKey(event.key);

  if (!trackedKeys.has(key)) {
    return;
  }

  keyboardState[key] = isPressed;
}

function isGameInputLocked() {
  const pauseMenuActive = document.getElementById('pause-menu')?.classList.contains('active');

  return GameState.isPaused || Boolean(pauseMenuActive);
}

// Clears all tracked key state after modal UI takes control.
function resetKeyboardState() {
  trackedKeys.forEach((key) => {
    keyboardState[key] = false;
  });
}

function handleKeydown(event) {
  const key = normalizeKey(event.key);
  const now = Date.now();

  if (isGameInputLocked()) {
    if (trackedKeys.has(key)) {
      event.preventDefault();
    }

    return;
  }

  setKeyState(event, true);

  if (key === 'tab') {
    event.preventDefault();

    if (!event.repeat) {
      inspectHoldCallbacks.forEach(({ openCallback }) => openCallback());
    }

    return;
  }

  if (slotSelectCallbacks.size > 0 && key >= '1' && key <= '4') {
    slotSelectCallbacks.forEach((callback) => callback(Number(key) - 1));
  }

  if (key === 'c' && !event.repeat) {
    crouchToggleCallbacks.forEach((callback) => callback());
  }

  if (key === 'f' && !event.repeat) {
    flashlightToggleCallbacks.forEach((callback) => callback());
  }

  if (key === 'r' && !event.repeat) {
    const activeItem = GameState.inventory[GameState.activeSlot];

    if (activeItem === 'RADIO' && GameState.inventory.includes('RADIO')) {
      event.preventDefault();
      radioUseCallbacks.forEach((callback) => callback(getPlayerPosition()));
      updateState({
        inventory: GameState.inventory.filter((item) => item !== 'RADIO'),
      });
      updateQuickSlots();
    }
  }

  if (
    key !== 'e'
    || event.repeat
    || interactCallbacks.size === 0
    || now - lastInteractAt < INTERACT_DEBOUNCE_MS
  ) {
    return;
  }

  lastInteractAt = now;
  interactCallbacks.forEach((callback) => callback());
}

function handleKeyup(event) {
  const key = normalizeKey(event.key);

  setKeyState(event, false);

  if (key !== 'tab') {
    return;
  }

  event.preventDefault();
  inspectHoldCallbacks.forEach(({ closeCallback }) => closeCallback());
}

window.addEventListener('keydown', handleKeydown);
window.addEventListener('keyup', handleKeyup);

// Returns whether a tracked key is currently pressed.
function isKeyPressed(key) {
  return Boolean(keyboardState[normalizeKey(key)]);
}

// Registers a callback for debounced interact key presses.
function onInteract(callback) {
  interactCallbacks.add(callback);

  return () => {
    interactCallbacks.delete(callback);
  };
}

// Registers a callback for quick-slot number key presses.
function onSlotSelect(callback) {
  slotSelectCallbacks.add(callback);

  return () => {
    slotSelectCallbacks.delete(callback);
  };
}

// Registers callbacks for TAB hold inspection open and close events.
function onInspectHold(openCallback, closeCallback) {
  const callbacks = {
    openCallback,
    closeCallback,
  };

  inspectHoldCallbacks.add(callbacks);

  return () => {
    inspectHoldCallbacks.delete(callbacks);
  };
}

// Registers a callback for crouch toggle key presses.
function registerCrouchToggle(callback) {
  crouchToggleCallbacks.add(callback);

  return () => {
    crouchToggleCallbacks.delete(callback);
  };
}

// Registers a callback for flashlight toggle key presses.
function onFlashlightToggle(callback) {
  flashlightToggleCallbacks.add(callback);

  return () => {
    flashlightToggleCallbacks.delete(callback);
  };
}

// Registers a callback for one-shot radio use key presses.
function onRadioUse(callback) {
  radioUseCallbacks.add(callback);

  return () => {
    radioUseCallbacks.delete(callback);
  };
}

export {
  keyboardState,
  isKeyPressed,
  onFlashlightToggle,
  onInspectHold,
  onInteract,
  onRadioUse,
  onSlotSelect,
  registerCrouchToggle,
  resetKeyboardState,
};

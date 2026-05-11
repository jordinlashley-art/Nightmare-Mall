const trackedKeys = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowleft',
  'arrowdown',
  'arrowright',
  'e',
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

function handleKeydown(event) {
  const key = normalizeKey(event.key);
  const now = Date.now();

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

export { keyboardState, isKeyPressed, onInspectHold, onInteract, onSlotSelect };

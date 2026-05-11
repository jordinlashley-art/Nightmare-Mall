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
]);

const keyboardState = {};

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

window.addEventListener('keydown', (event) => setKeyState(event, true));
window.addEventListener('keyup', (event) => setKeyState(event, false));

function isKeyPressed(key) {
  return Boolean(keyboardState[normalizeKey(key)]);
}

export { keyboardState, isKeyPressed };

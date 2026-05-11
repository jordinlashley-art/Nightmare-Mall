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

export { initOverlay, initVignette, updateVignette };

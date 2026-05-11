import './ui.css';

function initHUD() {
  let hud = document.getElementById('hud');

  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'hud';
    document.body.appendChild(hud);
  }

  hud.style.position = 'fixed';
  hud.style.inset = '0';
  hud.style.pointerEvents = 'none';

  return hud;
}

export { initHUD };

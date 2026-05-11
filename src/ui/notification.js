let notificationTimeout = null;

function getHUD() {
  let hud = document.getElementById('hud');

  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'hud';
    document.body.appendChild(hud);
  }

  return hud;
}

// Displays a temporary HUD notification with the supplied theme color.
function showNotification(message, duration = 2000, color = 'var(--color-text)') {
  const hud = getHUD();
  let notification = document.getElementById('hud-notification');

  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'hud-notification';
    hud.appendChild(notification);
  }

  if (notificationTimeout) {
    window.clearTimeout(notificationTimeout);
    notificationTimeout = null;
  }

  notification.textContent = message;
  notification.style.color = color;
  notification.classList.add('visible');

  notificationTimeout = window.setTimeout(() => {
    notification.classList.remove('visible');
    notificationTimeout = null;
  }, duration);
}

export { showNotification };

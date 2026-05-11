import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { GameState, updateState } from '../systems/state.js';
import { onInteract } from '../systems/input.js';
import { getPlayerPosition } from '../systems/player.js';
import { hidePickupPrompt, showPickupPrompt } from '../ui/overlay.js';
import { openLoreNote } from '../ui/lore.js';
import { playItemPickupSound } from '../systems/audio.js';

const LORE_NOTE_DEFINITIONS = [
  {
    id: 'note-security',
    title: 'Security Log 11:48 PM',
    body: 'Food court cameras caught the first rupture at closing. The lights failed in sequence, north wing to south. Something small moved through the skylight reflection before the bigger one arrived.',
    position: new THREE.Vector3(-33, 0.55, -33),
  },
  {
    id: 'note-employee',
    title: 'Employee Break Room',
    body: 'If you hear the quick one, do not run straight. It cuts corners faster than the tall one. Break line of sight, crouch, and let the old mall music cover your breathing.',
    position: new THREE.Vector3(34, 0.55, -33),
  },
  {
    id: 'note-gate',
    title: 'Maintenance Memo',
    body: 'The portal hum spikes near exposed wiring. The explosive needs to be planted at the red floor stain in the food court. Once armed, the gateway will collapse inward.',
    position: new THREE.Vector3(-8, 0.55, 10),
  },
  {
    id: 'note-survivor',
    title: 'Last Receipt',
    body: 'I made it to Candle Cart before the doors bent inward. The stores are moving around in the dark. If anyone finds this, the leaderboard screen means someone else survived.',
    position: new THREE.Vector3(12, 0.55, 10),
  },
];

const loreNotes = [];
let currentNearbyNote = null;
let unregisterInteract = null;

function createNoteMesh(note) {
  const group = new THREE.Group();
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.03, 0.4),
    new THREE.MeshLambertMaterial({
      color: 0xd8c7a3,
      emissive: new THREE.Color(0x332511),
      emissiveIntensity: 0.25,
    }),
  );
  const mark = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.01, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x6b0000 }),
  );
  const light = new THREE.PointLight(0xffcc88, 0.35, 2.5, 2);

  group.name = `LoreNote_${note.id}`;
  group.position.copy(note.position);
  paper.rotation.y = Math.PI * 0.08;
  group.add(paper);
  mark.position.y = 0.03;
  mark.position.z = -0.09;
  group.add(mark);
  light.position.y = 0.5;
  group.add(light);
  scene.add(group);

  return group;
}

function disposeNoteMesh(mesh) {
  mesh.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose());
    } else if (object.material) {
      object.material.dispose();
    }
  });
}

function clearLoreNotes() {
  loreNotes.forEach((note) => {
    scene.remove(note.mesh);
    disposeNoteMesh(note.mesh);
  });
  loreNotes.length = 0;
  currentNearbyNote = null;
}

function getFoundLoreIds() {
  return Array.isArray(GameState.loreNotesFound) ? GameState.loreNotesFound : [];
}

function readCurrentNote() {
  if (!currentNearbyNote) {
    return;
  }

  const foundIds = getFoundLoreIds();

  if (!foundIds.includes(currentNearbyNote.id)) {
    updateState({
      loreNotesFound: [...foundIds, currentNearbyNote.id],
    });
    playItemPickupSound();
  }

  openLoreNote(currentNearbyNote);
  hidePickupPrompt();
}

// Spawns collectible lore notes and registers their interaction hook.
function initLoreNotes() {
  clearLoreNotes();

  LORE_NOTE_DEFINITIONS.forEach((definition) => {
    loreNotes.push({
      ...definition,
      mesh: createNoteMesh(definition),
      bobTime: Math.random() * Math.PI * 2,
    });
  });

  if (!unregisterInteract) {
    unregisterInteract = onInteract(readCurrentNote);
  }
}

// Updates lore note idle animation and proximity read prompts.
function updateLoreNotes(delta) {
  const playerPosition = getPlayerPosition();
  let nearestNote = null;
  let nearestDistance = Infinity;

  loreNotes.forEach((note) => {
    note.bobTime += delta * 1.2;
    note.mesh.position.y = note.position.y + Math.sin(note.bobTime) * 0.04;
    note.mesh.rotation.y += delta * 0.25;

    const distance = playerPosition.distanceTo(note.position);

    if (distance < 1.8 && distance < nearestDistance) {
      nearestDistance = distance;
      nearestNote = note;
    }
  });

  if (nearestNote === currentNearbyNote) {
    return;
  }

  currentNearbyNote = nearestNote;

  if (currentNearbyNote) {
    showPickupPrompt(currentNearbyNote.title, 'Read');
    return;
  }

  hidePickupPrompt();
}

// Returns lore notes that have not been read in the current run.
function getUnreadLoreNotes() {
  const foundIds = getFoundLoreIds();

  return LORE_NOTE_DEFINITIONS.filter((note) => !foundIds.includes(note.id));
}

export {
  LORE_NOTE_DEFINITIONS,
  getUnreadLoreNotes,
  initLoreNotes,
  updateLoreNotes,
};

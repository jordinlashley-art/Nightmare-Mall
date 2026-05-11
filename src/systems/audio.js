import * as THREE from 'three';
import { GameState } from './state.js';
import { getPlayerPosition } from './player.js';
import { getDemonStates } from '../world/demon.js';

const PORTAL_POSITION = new THREE.Vector3(0, 0, 0);
const FOOTSTEP_MAX_DISTANCE = 34;
const PORTAL_HUM_DISTANCE = 32;
const MASTER_VOLUME = 0.75;
const AMBIENT_VOLUME = 0.18;
const PORTAL_VOLUME = 0.32;

let audioContext = null;
let masterGain = null;
let ambientGain = null;
let ambientFilter = null;
let ambientNoise = null;
let portalGain = null;
let portalFilter = null;
let portalOscillator = null;
let lastAliveState = true;
const footstepTimers = new Map();

function getAudioContextClass() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.AudioContext || window.webkitAudioContext || null;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function createNoiseBuffer(context, durationSeconds = 2) {
  const sampleRate = context.sampleRate;
  const frameCount = sampleRate * durationSeconds;
  const buffer = context.createBuffer(1, frameCount, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    channel[i] = (Math.random() * 2 - 1) * 0.35;
  }

  return buffer;
}

function createAmbientSoundscape(context) {
  ambientGain = context.createGain();
  ambientGain.gain.value = 0;
  ambientFilter = context.createBiquadFilter();
  ambientFilter.type = 'lowpass';
  ambientFilter.frequency.value = 520;
  ambientFilter.Q.value = 6;

  ambientNoise = context.createBufferSource();
  ambientNoise.buffer = createNoiseBuffer(context, 3);
  ambientNoise.loop = true;
  ambientNoise.connect(ambientFilter);
  ambientFilter.connect(ambientGain);
  ambientGain.connect(masterGain);
  ambientNoise.start();

  [42, 57].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = index === 0 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.035 : 0.02;
    oscillator.connect(gain);
    gain.connect(ambientGain);
    oscillator.start();
  });
}

function createPortalHum(context) {
  portalGain = context.createGain();
  portalGain.gain.value = 0;
  portalFilter = context.createBiquadFilter();
  portalFilter.type = 'lowpass';
  portalFilter.frequency.value = 180;
  portalFilter.Q.value = 10;
  portalOscillator = context.createOscillator();
  portalOscillator.type = 'sawtooth';
  portalOscillator.frequency.value = 68;
  portalOscillator.connect(portalFilter);
  portalFilter.connect(portalGain);
  portalGain.connect(masterGain);
  portalOscillator.start();
}

function ensureAudioSystem() {
  if (audioContext) {
    return audioContext;
  }

  const AudioContextClass = getAudioContextClass();

  if (!AudioContextClass) {
    return null;
  }

  audioContext = new AudioContextClass();
  masterGain = audioContext.createGain();
  masterGain.gain.value = MASTER_VOLUME;
  masterGain.connect(audioContext.destination);
  createAmbientSoundscape(audioContext);
  createPortalHum(audioContext);
  lastAliveState = GameState.isAlive;

  return audioContext;
}

function connectWithPan(source, panValue) {
  if (!audioContext || !masterGain) {
    return;
  }

  if (typeof audioContext.createStereoPanner === 'function') {
    const panner = audioContext.createStereoPanner();

    panner.pan.value = THREE.MathUtils.clamp(panValue, -1, 1);
    source.connect(panner);
    panner.connect(masterGain);
    return;
  }

  source.connect(masterGain);
}

function playNoiseBurst({
  duration,
  volume,
  filterFrequency,
  type = 'lowpass',
  pan = 0,
}) {
  const context = ensureAudioSystem();

  if (!context || !masterGain) {
    return;
  }

  const noise = context.createBufferSource();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const now = context.currentTime;

  noise.buffer = createNoiseBuffer(context, Math.max(0.1, duration));
  filter.type = type;
  filter.frequency.setValueAtTime(filterFrequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  noise.connect(filter);
  filter.connect(gain);
  connectWithPan(gain, pan);
  noise.start(now);
  noise.stop(now + duration + 0.03);
}

function playTone({
  frequency,
  duration,
  volume,
  type = 'sine',
  endFrequency = frequency,
  pan = 0,
}) {
  const context = ensureAudioSystem();

  if (!context || !masterGain) {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  connectWithPan(gain, pan);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function getSourcePan(sourcePosition, playerPosition) {
  const offset = sourcePosition.clone().sub(playerPosition);

  return THREE.MathUtils.clamp(offset.x / 18, -1, 1);
}

function updateLoopVolumes(delta) {
  if (!audioContext || !ambientGain || !portalGain || !ambientFilter || !portalFilter) {
    return;
  }

  const now = audioContext.currentTime;
  const playerPosition = getPlayerPosition();
  const portalDistance = playerPosition.distanceTo(PORTAL_POSITION);
  const portalProximity = GameState.explosivesPlanted
    ? 0
    : clamp01(1 - portalDistance / PORTAL_HUM_DISTANCE);
  const ambientTarget = GameState.isPaused ? AMBIENT_VOLUME * 0.35 : AMBIENT_VOLUME;
  const portalTarget = PORTAL_VOLUME * portalProximity * portalProximity;
  const wobble = Math.sin(performance.now() * 0.0015) * 60;

  ambientGain.gain.setTargetAtTime(ambientTarget, now, 0.6);
  ambientFilter.frequency.setTargetAtTime(440 + wobble, now, 0.4);
  portalGain.gain.setTargetAtTime(portalTarget, now, 0.2);
  portalFilter.frequency.setTargetAtTime(140 + portalProximity * 190, now, 0.2);

  if (portalOscillator) {
    portalOscillator.frequency.setTargetAtTime(58 + portalProximity * 22, now, 0.2);
  }

  if (GameState.isPaused) {
    masterGain.gain.setTargetAtTime(MASTER_VOLUME * 0.5, now, 0.2);
    return;
  }

  masterGain.gain.setTargetAtTime(MASTER_VOLUME, now, Math.max(0.02, delta));
}

function updateDemonFootsteps(delta) {
  const context = ensureAudioSystem();

  if (!context || GameState.isPaused || GameState.isAlive === false) {
    return;
  }

  const playerPosition = getPlayerPosition();

  getDemonStates().forEach((demonState, index) => {
    if (demonState.isDead) {
      return;
    }

    const distance = demonState.position.distanceTo(playerPosition);
    const proximity = clamp01(1 - distance / FOOTSTEP_MAX_DISTANCE);
    const key = demonState.id ?? `demon-${index}`;
    const behavior = demonState.behaviorState;
    const interval = behavior === 'HUNTING'
      ? 0.38
      : behavior === 'ALERTED'
        ? 0.52
        : 0.72;
    const timer = (footstepTimers.get(key) ?? Math.random() * interval) + delta;

    if (timer < interval || proximity <= 0) {
      footstepTimers.set(key, timer);
      return;
    }

    const volume = (0.08 + proximity * 0.35) * (demonState.audioWeight ?? 1);
    const pan = getSourcePan(demonState.position, playerPosition);

    footstepTimers.set(key, timer % interval);
    playNoiseBurst({
      duration: 0.16,
      volume,
      filterFrequency: 120 + proximity * 90,
      pan,
    });
    playTone({
      frequency: 42,
      endFrequency: 30,
      duration: 0.11,
      volume: volume * 0.6,
      type: 'sine',
      pan,
    });
  });
}

function updateJumpScareCue() {
  if (lastAliveState && GameState.isAlive === false) {
    playJumpScareStinger();
  }

  lastAliveState = GameState.isAlive;
}

// Initializes the Web Audio graph used by ambience and one-shot gameplay cues.
function initAudioSystem() {
  ensureAudioSystem();
}

// Resumes browser audio playback after a user gesture unlocks the context.
function resumeAudio() {
  const context = ensureAudioSystem();

  if (context?.state === 'suspended') {
    context.resume();
  }
}

// Updates ambient loops, portal hum, proximity footsteps, and catch stingers.
function updateAudio(delta) {
  ensureAudioSystem();
  updateLoopVolumes(delta);
  updateDemonFootsteps(delta);
  updateJumpScareCue();
}

// Plays the tactile click used when the player toggles the flashlight.
function playFlashlightClickSound() {
  resumeAudio();
  playNoiseBurst({
    duration: 0.045,
    volume: 0.16,
    filterFrequency: 2800,
    type: 'highpass',
  });
  playTone({
    frequency: 920,
    endFrequency: 420,
    duration: 0.06,
    volume: 0.05,
    type: 'square',
  });
}

// Plays the short confirmation sound used when an item is collected.
function playItemPickupSound() {
  resumeAudio();
  playTone({
    frequency: 520,
    endFrequency: 780,
    duration: 0.12,
    volume: 0.12,
    type: 'triangle',
  });
  playTone({
    frequency: 1040,
    endFrequency: 880,
    duration: 0.08,
    volume: 0.06,
    type: 'sine',
  });
}

// Plays the warped impact cue when the explosive planting sequence begins.
function playPortalPlantSound() {
  resumeAudio();
  playTone({
    frequency: 96,
    endFrequency: 42,
    duration: 0.42,
    volume: 0.26,
    type: 'sawtooth',
  });
  playNoiseBurst({
    duration: 0.5,
    volume: 0.12,
    filterFrequency: 420,
  });
}

// Plays the jump scare stinger when the demon catches the player.
function playJumpScareStinger() {
  resumeAudio();
  playTone({
    frequency: 880,
    endFrequency: 120,
    duration: 0.38,
    volume: 0.34,
    type: 'sawtooth',
  });
  playNoiseBurst({
    duration: 0.45,
    volume: 0.28,
    filterFrequency: 1800,
    type: 'bandpass',
  });
}

export {
  initAudioSystem,
  playFlashlightClickSound,
  playItemPickupSound,
  playJumpScareStinger,
  playPortalPlantSound,
  resumeAudio,
  updateAudio,
};

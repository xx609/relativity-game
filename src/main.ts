import './styles.css';
import { RelativityGame, type FrameInfo } from './game/RelativityGame';
import { TouchControls } from './game/TouchControls';
import { DEFAULT_LIGHT_SPEED } from './simulation/world';

function element<T extends HTMLElement>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing UI element: ${selector}`);
  return match;
}

const canvas = element<HTMLCanvasElement>('#world');
const game = new RelativityGame(canvas);
game.input.setActive(false);
const mobilePointer = window.matchMedia('(hover: none) and (pointer: coarse)');
const usesTouchControls = mobilePointer.matches || navigator.maxTouchPoints > 0;
document.body.classList.toggle('touch-input', usesTouchControls);

const ui = {
  startScreen: element<HTMLDivElement>('#start-screen'),
  enterButton: element<HTMLButtonElement>('#enter-button'),
  moveHint: element<HTMLDivElement>('#move-hint'),
  cursorHint: element<HTMLDivElement>('#cursor-hint'),
  playerSpeed: element<HTMLElement>('#player-speed'),
  playerSpeedBar: element<HTMLElement>('#player-speed-bar'),
  playerRatio: element<HTMLElement>('#player-ratio'),
  gamma: element<HTMLElement>('#gamma-readout'),
  pauseButton: element<HTMLButtonElement>('#pause-button'),
  resetButton: element<HTMLButtonElement>('#reset-button'),
  lightSpeed: element<HTMLInputElement>('#light-speed'),
  lightSpeedValue: element<HTMLOutputElement>('#light-speed-value'),
  compareButton: element<HTMLButtonElement>('#compare-button'),
  compareLabel: element<HTMLElement>('#compare-button span'),
  settingsButton: element<HTMLButtonElement>('#settings-button'),
  settingsPanel: element<HTMLElement>('#settings-panel'),
  fov: element<HTMLInputElement>('#fov-control'),
  fovOutput: element<HTMLOutputElement>('#fov-output'),
  sensitivity: element<HTMLInputElement>('#sensitivity-control'),
  sensitivityOutput: element<HTMLOutputElement>('#sensitivity-output'),
  toast: element<HTMLDivElement>('#toast'),
};

new TouchControls(
  element<HTMLElement>('#move-joystick'),
  element<HTMLButtonElement>('#jump-button'),
  game.input,
);

let hasEntered = false;
let wasPointerLocked = false;
let toastTimer = 0;
let lightSpeedWheelDelta = 0;

function setLightSpeed(value: number): void {
  if (!Number.isFinite(value)) return;
  const minimum = Number(ui.lightSpeed.min);
  const maximum = Number(ui.lightSpeed.max);
  const step = Number(ui.lightSpeed.step);
  const clamped = Math.max(minimum, Math.min(maximum, value));
  const stepped = minimum + Math.round((clamped - minimum) / step) * step;
  const next = Number(stepped.toFixed(10));

  ui.lightSpeed.value = String(next);
  ui.lightSpeedValue.value = next.toFixed(1);
  game.setLightSpeed(next);
}

function setEntered(): void {
  if (!hasEntered) {
    hasEntered = true;
    ui.moveHint.hidden = usesTouchControls;
    ui.cursorHint.hidden = usesTouchControls;
    ui.startScreen.classList.add('dismissed');
    window.setTimeout(() => { ui.startScreen.hidden = true; }, 650);
  }
  closeSettings();
  canvas.focus();
  if (!usesTouchControls) game.requestPointerLock();
}

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('visible'), 1200);
}

function setPaused(paused: boolean): void {
  game.simulation.setPaused(paused);
  ui.pauseButton.setAttribute('aria-pressed', String(paused));
  ui.pauseButton.querySelector('span')!.textContent = paused ? '▶' : 'Ⅱ';
  showToast(paused ? 'TIME HELD' : 'TIME FLOWING');
}

function resetWorld(): void {
  game.reset();
  setLightSpeed(DEFAULT_LIGHT_SPEED);
  ui.pauseButton.setAttribute('aria-pressed', 'false');
  ui.pauseButton.querySelector('span')!.textContent = 'Ⅱ';
  showToast('WORLD RESET');
}

function setComparison(classical: boolean): void {
  game.effects.relativistic = !classical;
  ui.compareButton.setAttribute('aria-pressed', String(classical));
  ui.compareLabel.textContent = classical ? 'CLS' : 'REL';
  showToast(classical ? 'CLASSICAL VIEW' : 'RELATIVISTIC VIEW');
}

function openSettings(): void {
  game.input.setActive(false);
  ui.settingsPanel.hidden = false;
  game.input.releaseLock();
  ui.settingsButton.setAttribute('aria-expanded', 'true');
}

function closeSettings(): void {
  game.input.setActive(hasEntered);
  ui.settingsPanel.hidden = true;
  ui.settingsButton.setAttribute('aria-expanded', 'false');
}

function updateHud(frame: FrameInfo): void {
  if (hasEntered && !ui.moveHint.hidden && frame.playerSpeed > 0.05) {
    ui.moveHint.hidden = true;
  }
  ui.playerSpeed.textContent = frame.playerSpeed.toFixed(1);
  ui.playerRatio.textContent = `${frame.playerRatio.toFixed(3)} c`;
  ui.gamma.textContent = `γ ${frame.gamma.toFixed(3)}`;
  ui.playerSpeedBar.style.width = `${Math.min(frame.playerRatio / 0.985, 1) * 100}%`;
}

ui.enterButton.addEventListener('click', setEntered);
canvas.addEventListener('click', () => {
  if (hasEntered && ui.settingsPanel.hidden && !usesTouchControls) game.requestPointerLock();
});

game.onLockChange = (locked) => {
  lightSpeedWheelDelta = 0;
  // Browsers can consume Escape while releasing pointer lock, so also dismiss
  // the hint on a user unlock. Opening settings or leaving the tab keeps it.
  if (wasPointerLocked && !locked && ui.settingsPanel.hidden && document.hasFocus()) {
    ui.cursorHint.hidden = true;
  }
  wasPointerLocked = locked;
};
game.onFrame = updateHud;

ui.pauseButton.addEventListener('click', () => setPaused(!game.simulation.paused));
ui.resetButton.addEventListener('click', resetWorld);
ui.lightSpeed.addEventListener('input', () => {
  setLightSpeed(Number(ui.lightSpeed.value));
});
ui.lightSpeed.addEventListener('dblclick', () => {
  setLightSpeed(DEFAULT_LIGHT_SPEED);
  showToast('c RESTORED');
});
ui.compareButton.addEventListener('click', () => {
  setComparison(game.effects.relativistic);
});

ui.settingsButton.addEventListener('click', () => {
  if (ui.settingsPanel.hidden) openSettings();
  else closeSettings();
});

element<HTMLInputElement>('#effect-doppler').addEventListener('change', (event) => {
  game.effects.doppler = (event.currentTarget as HTMLInputElement).checked;
});
element<HTMLInputElement>('#effect-clocks').addEventListener('change', (event) => {
  game.effects.clocks = (event.currentTarget as HTMLInputElement).checked;
});
element<HTMLInputElement>('#effect-contraction').addEventListener('change', (event) => {
  game.effects.contraction = (event.currentTarget as HTMLInputElement).checked;
});
element<HTMLInputElement>('#effect-delay').addEventListener('change', (event) => {
  game.effects.lightDelay = (event.currentTarget as HTMLInputElement).checked;
});
element<HTMLInputElement>('#effect-grid').addEventListener('change', (event) => {
  void game.setSpacetimeGrid((event.currentTarget as HTMLInputElement).checked);
});
element<HTMLInputElement>('#reduced-motion').addEventListener('change', (event) => {
  game.effects.reducedMotion = (event.currentTarget as HTMLInputElement).checked;
});
element<HTMLInputElement>('#low-distortion').addEventListener('change', (event) => {
  game.effects.lowDistortion = (event.currentTarget as HTMLInputElement).checked;
});

ui.fov.addEventListener('input', () => {
  const value = Number(ui.fov.value);
  game.setFov(value);
  ui.fovOutput.value = `${value}°`;
});
ui.sensitivity.addEventListener('input', () => {
  const value = Number(ui.sensitivity.value);
  game.input.sensitivity = value;
  ui.sensitivityOutput.value = `${value.toFixed(1)}×`;
});

window.addEventListener('wheel', (event) => {
  const target = event.target;
  const overLightControl = target instanceof Element && Boolean(target.closest('.light-control'));
  if (!overLightControl && (!game.input.isLocked || !ui.settingsPanel.hidden)) return;

  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 1 / 3
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 1 : 1 / 100);
  if (lightSpeedWheelDelta !== 0 && Math.sign(delta) !== Math.sign(lightSpeedWheelDelta)) {
    lightSpeedWheelDelta = 0;
  }
  lightSpeedWheelDelta += delta;

  const steps = Math.trunc(Math.abs(lightSpeedWheelDelta));
  if (steps === 0) return;
  const direction = -Math.sign(lightSpeedWheelDelta);
  lightSpeedWheelDelta -= Math.sign(lightSpeedWheelDelta) * steps;
  setLightSpeed(Number(ui.lightSpeed.value) + direction * steps * Number(ui.lightSpeed.step));
}, { passive: false });

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    if (hasEntered) ui.cursorHint.hidden = true;
    game.input.releaseLock();
    if (!ui.settingsPanel.hidden) closeSettings();
    return;
  }
  const source = event.target;
  if (source instanceof HTMLInputElement) return;
  if (event.code === 'KeyP') setPaused(!game.simulation.paused);
  if (event.code === 'KeyR') resetWorld();
  if (event.code === 'KeyC') setComparison(game.effects.relativistic);
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Escape' && hasEntered) ui.cursorHint.hidden = true;
});

game.start();

import './styles.css';
import { RelativityGame, type FrameInfo } from './game/RelativityGame';
import { DEFAULT_LIGHT_SPEED } from './simulation/world';

function element<T extends HTMLElement>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing UI element: ${selector}`);
  return match;
}

const canvas = element<HTMLCanvasElement>('#world');
const game = new RelativityGame(canvas);
game.input.setActive(false);

const ui = {
  startScreen: element<HTMLDivElement>('#start-screen'),
  enterButton: element<HTMLButtonElement>('#enter-button'),
  moveHint: element<HTMLDivElement>('#move-hint'),
  cursorHint: element<HTMLDivElement>('#cursor-hint'),
  playerSpeed: element<HTMLElement>('#player-speed'),
  playerSpeedBar: element<HTMLElement>('#player-speed-bar'),
  playerRatio: element<HTMLElement>('#player-ratio'),
  gamma: element<HTMLElement>('#gamma-readout'),
  movementMode: element<HTMLElement>('#movement-mode'),
  altitude: element<HTMLElement>('#altitude-readout'),
  targetPanel: element<HTMLElement>('#target-panel'),
  targetName: element<HTMLElement>('#target-name'),
  targetSpeed: element<HTMLElement>('#target-speed'),
  targetArrow: element<HTMLElement>('#target-arrow'),
  closingMeter: element<HTMLElement>('#closing-meter-fill'),
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

let hasEntered = false;
let wasPointerLocked = false;
let toastTimer = 0;

function setEntered(): void {
  if (!hasEntered) {
    hasEntered = true;
    ui.moveHint.hidden = false;
    ui.cursorHint.hidden = false;
    ui.startScreen.classList.add('dismissed');
    window.setTimeout(() => { ui.startScreen.hidden = true; }, 650);
  }
  closeSettings();
  canvas.focus();
  game.requestPointerLock();
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
  ui.lightSpeed.value = String(DEFAULT_LIGHT_SPEED);
  ui.lightSpeedValue.value = DEFAULT_LIGHT_SPEED.toFixed(1);
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
  ui.movementMode.textContent = frame.flying ? 'FLYING' : frame.grounded ? 'WALKING' : 'AIRBORNE';
  ui.altitude.textContent = `${frame.altitude.toFixed(1)} u ↑`;

  const target = frame.target;
  ui.targetPanel.hidden = !target;
  document.body.classList.toggle('targeting', Boolean(target));
  if (!target) return;

  ui.targetName.textContent = target.name;
  ui.targetSpeed.innerHTML = `${target.speed.toFixed(1)} <em>u/s</em>`;
  const closingRatio = target.closingSpeed / target.maxClosingSpeed;
  ui.targetArrow.textContent = closingRatio >= 0 ? '↓' : '↑';
  ui.targetArrow.style.color = closingRatio >= 0 ? '#426651' : '#a86646';
  ui.closingMeter.style.height = `${Math.max(8, Math.min(100, Math.abs(closingRatio) * 100))}%`;
  ui.closingMeter.style.background = closingRatio >= 0 ? '#75946a' : '#bd8662';
}

ui.enterButton.addEventListener('click', setEntered);
canvas.addEventListener('click', () => {
  if (hasEntered && ui.settingsPanel.hidden) game.requestPointerLock();
});

game.onLockChange = (locked) => {
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
  const value = Number(ui.lightSpeed.value);
  game.setLightSpeed(value);
  ui.lightSpeedValue.value = value.toFixed(1);
});
ui.lightSpeed.addEventListener('dblclick', () => {
  ui.lightSpeed.value = String(DEFAULT_LIGHT_SPEED);
  ui.lightSpeedValue.value = DEFAULT_LIGHT_SPEED.toFixed(1);
  game.setLightSpeed(DEFAULT_LIGHT_SPEED);
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

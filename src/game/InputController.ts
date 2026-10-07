import type { MovementInput } from '../simulation/world';

const MOVEMENT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Space', 'KeyF',
]);
const DOUBLE_TAP_MS = 300;

export class InputController {
  yaw = 0;
  pitch = 0;
  sensitivity = 1;
  private readonly keys = new Set<string>();
  private enabled = false;
  private active = true;
  private jumpQueued = false;
  private flightToggleQueued = false;
  private lastSpacePress = -Infinity;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  get isLocked(): boolean {
    return document.pointerLockElement === this.element;
  }

  requestLock(): void {
    // Embedded preview surfaces may intentionally disallow pointer lock.
    // A regular desktop browser grants it from the same user gesture.
    void this.element.requestPointerLock().catch(() => undefined);
  }

  releaseLock(): void {
    if (this.isLocked) document.exitPointerLock();
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.clear();
  }

  reset(): void {
    this.clear();
  }

  movement(): MovementInput {
    const input: MovementInput = {
      forward: Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
        - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')),
      right: Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
        - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      yaw: this.yaw,
      pitch: this.pitch,
      jump: this.jumpQueued,
      vertical: Number(this.keys.has('Space'))
        - Number(this.keys.has('ControlLeft') || this.keys.has('ControlRight')),
      toggleFlight: this.flightToggleQueued,
    };
    this.jumpQueued = false;
    this.flightToggleQueued = false;
    return input;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || !MOVEMENT_KEYS.has(event.code) || event.altKey || event.metaKey) return;
    if (!this.isLocked && event.target instanceof Element
      && event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    event.preventDefault();
    if (!event.repeat && !this.keys.has(event.code)) {
      if (event.code === 'Space') {
        if (event.timeStamp - this.lastSpacePress <= DOUBLE_TAP_MS) {
          this.flightToggleQueued = true;
          this.jumpQueued = false;
          this.lastSpacePress = -Infinity;
        } else {
          this.jumpQueued = true;
          this.lastSpacePress = event.timeStamp;
        }
      }
      if (event.code === 'KeyF') {
        this.flightToggleQueued = true;
        this.lastSpacePress = -Infinity;
      }
    }
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly clear = (): void => {
    this.keys.clear();
    this.jumpQueued = false;
    this.flightToggleQueued = false;
    this.lastSpacePress = -Infinity;
  };

  private readonly onPointerLockChange = (): void => {
    this.enabled = this.isLocked;
    if (!this.enabled) this.clear();
    this.element.dispatchEvent(new CustomEvent('looklockchange', { detail: this.enabled }));
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.enabled) return;
    const scale = 0.0018 * this.sensitivity;
    this.yaw -= event.movementX * scale;
    this.pitch -= event.movementY * scale;
    this.pitch = Math.max(-Math.PI * 0.47, Math.min(Math.PI * 0.47, this.pitch));
  };
}

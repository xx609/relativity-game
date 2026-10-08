import type { MovementInput } from '../simulation/world';

const MOVEMENT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space', 'KeyF',
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
  private virtualForward = 0;
  private virtualRight = 0;
  private virtualJumpHeld = false;
  private touchLookPointer: number | null = null;
  private touchLookX = 0;
  private touchLookY = 0;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    element.addEventListener('pointerdown', this.onTouchLookStart);
    element.addEventListener('pointermove', this.onTouchLookMove);
    element.addEventListener('pointerup', this.onTouchLookEnd);
    element.addEventListener('pointercancel', this.onTouchLookEnd);
    element.addEventListener('lostpointercapture', this.onTouchLookEnd);
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

  setVirtualMovement(forward: number, right: number): void {
    if (!this.active) return;
    this.virtualForward = Math.max(-1, Math.min(1, forward));
    this.virtualRight = Math.max(-1, Math.min(1, right));
  }

  pressVirtualJump(timeStamp = performance.now()): void {
    if (!this.active || this.virtualJumpHeld) return;
    this.virtualJumpHeld = true;
    this.queueJumpPress(timeStamp);
  }

  releaseVirtualJump(): void {
    this.virtualJumpHeld = false;
  }

  movement(): MovementInput {
    const keyboardForward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const keyboardRight = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
      - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const input: MovementInput = {
      forward: Math.max(-1, Math.min(1, keyboardForward + this.virtualForward)),
      right: Math.max(-1, Math.min(1, keyboardRight + this.virtualRight)),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      yaw: this.yaw,
      pitch: this.pitch,
      jump: this.jumpQueued,
      vertical: Number(this.keys.has('Space') || this.virtualJumpHeld)
        - Number(this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')),
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
    this.element.removeEventListener('pointerdown', this.onTouchLookStart);
    this.element.removeEventListener('pointermove', this.onTouchLookMove);
    this.element.removeEventListener('pointerup', this.onTouchLookEnd);
    this.element.removeEventListener('pointercancel', this.onTouchLookEnd);
    this.element.removeEventListener('lostpointercapture', this.onTouchLookEnd);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || !MOVEMENT_KEYS.has(event.code) || event.altKey || event.metaKey) return;
    if (!this.isLocked && event.target instanceof Element
      && event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    event.preventDefault();
    if (!event.repeat && !this.keys.has(event.code)) {
      if (event.code === 'Space') {
        this.queueJumpPress(event.timeStamp);
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
    this.virtualForward = 0;
    this.virtualRight = 0;
    this.virtualJumpHeld = false;
    this.touchLookPointer = null;
  };

  private readonly onPointerLockChange = (): void => {
    this.enabled = this.isLocked;
    if (!this.enabled) this.clear();
    this.element.dispatchEvent(new CustomEvent('looklockchange', { detail: this.enabled }));
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.enabled) return;
    const scale = 0.0018 * this.sensitivity;
    this.applyLookDelta(event.movementX, event.movementY, scale);
  };

  private queueJumpPress(timeStamp: number): void {
    if (timeStamp - this.lastSpacePress <= DOUBLE_TAP_MS) {
      this.flightToggleQueued = true;
      this.jumpQueued = false;
      this.lastSpacePress = -Infinity;
    } else {
      this.jumpQueued = true;
      this.lastSpacePress = timeStamp;
    }
  }

  private applyLookDelta(deltaX: number, deltaY: number, scale: number): void {
    this.yaw -= deltaX * scale;
    this.pitch -= deltaY * scale;
    this.pitch = Math.max(-Math.PI * 0.47, Math.min(Math.PI * 0.47, this.pitch));
  }

  private readonly onTouchLookStart = (event: PointerEvent): void => {
    if (!this.active || event.pointerType !== 'touch' || this.touchLookPointer !== null) return;
    event.preventDefault();
    this.touchLookPointer = event.pointerId;
    this.touchLookX = event.clientX;
    this.touchLookY = event.clientY;
    this.element.setPointerCapture?.(event.pointerId);
  };

  private readonly onTouchLookMove = (event: PointerEvent): void => {
    if (!this.active || event.pointerId !== this.touchLookPointer) return;
    event.preventDefault();
    const deltaX = event.clientX - this.touchLookX;
    const deltaY = event.clientY - this.touchLookY;
    this.touchLookX = event.clientX;
    this.touchLookY = event.clientY;
    this.applyLookDelta(deltaX, deltaY, 0.004 * this.sensitivity);
  };

  private readonly onTouchLookEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.touchLookPointer) this.touchLookPointer = null;
  };
}

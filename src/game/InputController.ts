import type { MovementInput } from '../simulation/world';

export class InputController {
  yaw = 0;
  pitch = 0;
  sensitivity = 1;
  private readonly keys = new Set<string>();
  private enabled = false;

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

  movement(): MovementInput {
    return {
      forward: Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
        - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')),
      right: Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
        - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      yaw: this.yaw,
    };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code.startsWith('Arrow')) event.preventDefault();
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly clear = (): void => {
    this.keys.clear();
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

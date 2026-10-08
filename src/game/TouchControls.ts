import type { InputController } from './InputController';

const DEAD_ZONE = 0.12;

export class TouchControls {
  private joystickPointer: number | null = null;
  private jumpPointer: number | null = null;

  constructor(
    private readonly joystick: HTMLElement,
    private readonly jumpButton: HTMLButtonElement,
    private readonly input: InputController,
  ) {
    joystick.addEventListener('pointerdown', this.onJoystickStart);
    joystick.addEventListener('pointermove', this.onJoystickMove);
    joystick.addEventListener('pointerup', this.onJoystickEnd);
    joystick.addEventListener('pointercancel', this.onJoystickEnd);
    joystick.addEventListener('lostpointercapture', this.onJoystickEnd);
    jumpButton.addEventListener('pointerdown', this.onJumpStart);
    jumpButton.addEventListener('pointerup', this.onJumpEnd);
    jumpButton.addEventListener('pointercancel', this.onJumpEnd);
    jumpButton.addEventListener('lostpointercapture', this.onJumpEnd);
    joystick.addEventListener('contextmenu', this.preventDefault);
    jumpButton.addEventListener('contextmenu', this.preventDefault);
  }

  destroy(): void {
    this.joystick.removeEventListener('pointerdown', this.onJoystickStart);
    this.joystick.removeEventListener('pointermove', this.onJoystickMove);
    this.joystick.removeEventListener('pointerup', this.onJoystickEnd);
    this.joystick.removeEventListener('pointercancel', this.onJoystickEnd);
    this.joystick.removeEventListener('lostpointercapture', this.onJoystickEnd);
    this.jumpButton.removeEventListener('pointerdown', this.onJumpStart);
    this.jumpButton.removeEventListener('pointerup', this.onJumpEnd);
    this.jumpButton.removeEventListener('pointercancel', this.onJumpEnd);
    this.jumpButton.removeEventListener('lostpointercapture', this.onJumpEnd);
    this.joystick.removeEventListener('contextmenu', this.preventDefault);
    this.jumpButton.removeEventListener('contextmenu', this.preventDefault);
  }

  private readonly preventDefault = (event: Event): void => event.preventDefault();

  private readonly onJoystickStart = (event: PointerEvent): void => {
    if (this.joystickPointer !== null) return;
    event.preventDefault();
    this.joystickPointer = event.pointerId;
    this.joystick.classList.add('active');
    this.joystick.setPointerCapture(event.pointerId);
    this.updateJoystick(event);
  };

  private readonly onJoystickMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.joystickPointer) return;
    event.preventDefault();
    this.updateJoystick(event);
  };

  private readonly onJoystickEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.joystickPointer) return;
    this.joystickPointer = null;
    this.joystick.classList.remove('active');
    this.joystick.style.setProperty('--stick-x', '0px');
    this.joystick.style.setProperty('--stick-y', '0px');
    this.input.setVirtualMovement(0, 0);
  };

  private updateJoystick(event: PointerEvent): void {
    const bounds = this.joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2);
    const rawX = (event.clientX - (bounds.left + bounds.width / 2)) / radius;
    const rawY = (event.clientY - (bounds.top + bounds.height / 2)) / radius;
    const rawLength = Math.hypot(rawX, rawY);
    const limitedLength = Math.min(rawLength, 1);
    const directionX = rawLength > 0 ? rawX / rawLength : 0;
    const directionY = rawLength > 0 ? rawY / rawLength : 0;
    const strength = limitedLength <= DEAD_ZONE
      ? 0
      : (limitedLength - DEAD_ZONE) / (1 - DEAD_ZONE);
    const x = directionX * strength;
    const y = directionY * strength;
    const visualTravel = Math.min(bounds.width, bounds.height) * 0.27;

    this.joystick.style.setProperty('--stick-x', `${directionX * limitedLength * visualTravel}px`);
    this.joystick.style.setProperty('--stick-y', `${directionY * limitedLength * visualTravel}px`);
    this.input.setVirtualMovement(-y, x);
  }

  private readonly onJumpStart = (event: PointerEvent): void => {
    if (this.jumpPointer !== null) return;
    event.preventDefault();
    this.jumpPointer = event.pointerId;
    this.jumpButton.classList.add('active');
    this.jumpButton.setAttribute('aria-pressed', 'true');
    this.jumpButton.setPointerCapture(event.pointerId);
    this.input.pressVirtualJump(event.timeStamp);
  };

  private readonly onJumpEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.jumpPointer) return;
    this.jumpPointer = null;
    this.jumpButton.classList.remove('active');
    this.jumpButton.setAttribute('aria-pressed', 'false');
    this.input.releaseVirtualJump();
  };
}

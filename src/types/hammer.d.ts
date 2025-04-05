declare interface HammerStatic {
  new(element: HTMLElement | SVGElement, options?: any): HammerManager;
  DIRECTION_ALL: number;
  DIRECTION_DOWN: number;
  DIRECTION_HORIZONTAL: number;
  DIRECTION_LEFT: number;
  DIRECTION_NONE: number;
  DIRECTION_RIGHT: number;
  DIRECTION_UP: number;
  DIRECTION_VERTICAL: number;
  Tap: new(options?: any) => any;
}

declare interface HammerManager {
  get(eventName: string): any;
  on(eventName: string, handler: (event: any) => void): void;
  add(recognizer: any): void;
  destroy(): void;
}

declare interface Window {
  Hammer: HammerStatic;
} 
interface HammerManager {
  get(recognizer: string): any;
  add(recognizer: any): void;
  on(event: string, handler: (event: any) => void): void;
  destroy(): void;
}

interface HammerStatic {
  new(element: HTMLElement): HammerManager;
  DIRECTION_ALL: number;
  Tap: {
    new(options: { event: string; taps: number }): any;
  };
}

interface WebGLImageFilterOptions {
  vShaderSource?: string;
  fShaderSource?: string;
}

interface WebGLImageFilter {
  new(options?: WebGLImageFilterOptions): WebGLImageFilter;
  addFilter(name: string, ...args: any[]): void;
  apply(canvas: HTMLCanvasElement): HTMLCanvasElement;
}

declare global {
  interface Window {
    Hammer: HammerStatic;
    WebGLImageFilter: WebGLImageFilter;
  }
}

export {}; 
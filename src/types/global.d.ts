interface HammerManager {
  get(recognizer: string): any;
  add(recognizer: any | any[]): void;
  on(event: string, handler: (event: any) => void): void;
  destroy(): void;
}

interface HammerRecognizer {
  recognizeWith(otherRecognizer: HammerRecognizer): HammerRecognizer;
}

interface HammerStatic {
  new(element: HTMLElement): HammerManager;
  DIRECTION_ALL: number;
  Tap: {
    new(options: { event: string; taps: number }): HammerRecognizer;
  };
  Manager: {
    new(element: HTMLElement, options?: any): HammerManager;
  };
  Pan: {
    new(options?: { direction?: number; threshold?: number }): HammerRecognizer;
  };
  Rotate: {
    new(options?: { threshold?: number }): HammerRecognizer;
  };
  Pinch: {
    new(options?: any): HammerRecognizer;
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
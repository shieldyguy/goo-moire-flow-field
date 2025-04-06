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
    WebGLImageFilter: {
      new(options?: WebGLImageFilterOptions): WebGLImageFilter;
    };
  }
}

export {}; 
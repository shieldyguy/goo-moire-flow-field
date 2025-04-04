declare global {
  interface Window {
    WebGLImageFilter: any;
  }
}

export class WebGLImageFilterWrapper {
  private filter: any;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.filter = new window.WebGLImageFilter({ canvas });
  }

  applyBlur(radius: number) {
    this.filter.reset();
    this.filter.addFilter('blur', radius);
    return this;
  }

  applyThreshold(threshold: number) {
    this.filter.reset();
    // We'll use brightness and contrast to create a threshold effect
    const brightness = threshold * 2 - 1;
    this.filter.addFilter('brightness', brightness);
    this.filter.addFilter('contrast', 100);
    return this;
  }

  apply(input: HTMLCanvasElement) {
    return this.filter.apply(input);
  }

  cleanup() {
    // The library handles cleanup automatically
  }
} 
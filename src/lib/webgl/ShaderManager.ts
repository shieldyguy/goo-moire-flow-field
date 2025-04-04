import { WebGLContext } from './WebGLContext';

// Import shaders
import dotVert from '@/shaders/dot.vert?raw';
import dotFrag from '@/shaders/dot.frag?raw';
import blurVert from '@/shaders/blur.vert?raw';
import blurFrag from '@/shaders/blur.frag?raw';
import thresholdVert from '@/shaders/threshold.vert?raw';
import thresholdFrag from '@/shaders/threshold.frag?raw';
import compositeVert from '@/shaders/composite.vert?raw';
import compositeFrag from '@/shaders/composite.frag?raw';

export class ShaderManager {
  private gl: WebGLRenderingContext;
  private shaders: Map<string, WebGLProgram>;

  constructor(context: WebGLContext) {
    this.gl = context.getContext();
    this.shaders = new Map();
  }

  async loadShader(name: string): Promise<void> {
    if (this.shaders.has(name)) {
      return;
    }

    let vertexSource: string;
    let fragmentSource: string;

    switch (name) {
      case 'dot':
        vertexSource = dotVert;
        fragmentSource = dotFrag;
        break;
      case 'blur':
        vertexSource = blurVert;
        fragmentSource = blurFrag;
        break;
      case 'threshold':
        vertexSource = thresholdVert;
        fragmentSource = thresholdFrag;
        break;
      case 'composite':
        vertexSource = compositeVert;
        fragmentSource = compositeFrag;
        break;
      default:
        throw new Error(`Unknown shader: ${name}`);
    }

    const program = this.createProgram(vertexSource, fragmentSource);
    this.shaders.set(name, program);
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);

    const program = this.gl.createProgram();
    if (!program) {
      throw new Error('Failed to create program');
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Failed to link program: ${error}`);
    }

    // Clean up shaders after program creation
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return program;
  }

  private compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Failed to compile shader: ${error}`);
    }

    return shader;
  }

  getShader(name: string): WebGLProgram {
    const program = this.shaders.get(name);
    if (!program) {
      throw new Error(`Shader not found: ${name}`);
    }
    return program;
  }

  useShader(name: string): void {
    const program = this.getShader(name);
    this.gl.useProgram(program);
  }

  cleanup(): void {
    for (const program of this.shaders.values()) {
      this.gl.deleteProgram(program);
    }
    this.shaders.clear();
  }
} 
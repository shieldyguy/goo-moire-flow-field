export class WebGLContext {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement | null = null;
  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  private uniforms: {
    color: WebGLUniformLocation | null;
    size: WebGLUniformLocation | null;
    offset: WebGLUniformLocation | null;
    rotation: WebGLUniformLocation | null;
  };

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;
    this.canvas = canvas;
    this.uniforms = {
      color: null,
      size: null,
      offset: null,
      rotation: null
    };
    this.initShaders();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
  }

  private initShaders() {
    const gl = this.gl;

    // Create shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;

    // Compile vertex shader
    gl.shaderSource(vertexShader, `
      attribute vec2 a_position;
      uniform vec4 u_color;
      uniform float u_size;
      uniform vec2 u_offset;
      uniform float u_rotation;

      void main() {
        float c = cos(u_rotation);
        float s = sin(u_rotation);
        vec2 pos = a_position;
        pos = vec2(
          pos.x * c - pos.y * s,
          pos.x * s + pos.y * c
        );
        pos += u_offset;
        gl_Position = vec4(pos, 0, 1);
        gl_PointSize = u_size;
      }
    `);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
    }

    // Compile fragment shader
    gl.shaderSource(fragmentShader, `
      precision mediump float;
      uniform vec4 u_color;
      void main() {
        gl_FragColor = u_color;
      }
    `);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
    }

    // Create and link program
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(this.program));
    }

    // Use the program and get uniform locations
    gl.useProgram(this.program);
    this.uniforms.color = gl.getUniformLocation(this.program, 'u_color');
    this.uniforms.size = gl.getUniformLocation(this.program, 'u_size');
    this.uniforms.offset = gl.getUniformLocation(this.program, 'u_offset');
    this.uniforms.rotation = gl.getUniformLocation(this.program, 'u_rotation');

    // Get attribute location
    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
  }

  public compileShader(source: string, type: number): WebGLShader {
    if (!this.gl) {
      throw new Error('WebGL context not initialized');
    }

    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${error}`);
    }

    return shader;
  }

  public createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    if (!this.gl) {
      throw new Error('WebGL context not initialized');
    }

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
      throw new Error(`Program linking error: ${error}`);
    }

    return program;
  }

  public getContext(): WebGLRenderingContext {
    if (!this.gl) {
      throw new Error('WebGL context not initialized');
    }
    return this.gl;
  }

  public resize(width: number, height: number) {
    if (!this.gl || !this.canvas) {
      throw new Error('WebGL context not initialized');
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  public clear() {
    if (!this.gl) {
      throw new Error('WebGL context not initialized');
    }
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  getUniforms() {
    return this.uniforms;
  }

  useProgram() {
    if (this.program) {
      this.gl.useProgram(this.program);
    }
  }
} 
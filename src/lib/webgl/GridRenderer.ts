import { parseHslToRgb } from "./hslToRgb";

// ─── Shaders ───

const VERT_SRC = `
precision highp float;
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG_TEMPLATE = `
precision highp float;

uniform vec2  u_resolution;
uniform float u_spacing;
uniform float u_size;
uniform float u_rotation;
uniform vec3  u_color;
uniform vec2  u_wrappedOffset;

const float AA = 1.5;

void main() {
  vec2 p = gl_FragCoord.xy - u_resolution * 0.5;

  float c = cos(u_rotation);
  float s = sin(u_rotation);
  vec2 local = vec2(p.x * c + p.y * s, -p.x * s + p.y * c);
  vec2 uv = local - vec2(u_wrappedOffset.x, -u_wrappedOffset.y);

  float shape = 0.0;

#if SHAPE_TYPE == 0
  // DOTS
  vec2 cell = mod(uv, u_spacing) - u_spacing * 0.5;
  float d = length(cell);
  float radius = u_size * 0.5;
  shape = smoothstep(radius + AA, radius - AA, d);
#elif SHAPE_TYPE == 1
  // LINES (horizontal in rotation-local space)
  float cellY = mod(uv.y, u_spacing) - u_spacing * 0.5;
  float halfWidth = u_size * 0.5;
  shape = smoothstep(halfWidth + AA, halfWidth - AA, abs(cellY));
#endif

  gl_FragColor = vec4(u_color, shape);
}
`;

// ─── Types ───

export interface GridLayerParams {
  spacing: number;
  size: number;
  rotation: number;
  color: string;
  type: "dots" | "lines" | "squares";
}

interface ProgramInfo {
  program: WebGLProgram;
  a_position: number;
  u_resolution: WebGLUniformLocation | null;
  u_spacing: WebGLUniformLocation | null;
  u_size: WebGLUniformLocation | null;
  u_rotation: WebGLUniformLocation | null;
  u_color: WebGLUniformLocation | null;
  u_wrappedOffset: WebGLUniformLocation | null;
}

// ─── GridRenderer ───

export class GridRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private programs = new Map<string, ProgramInfo>();
  private colorCache = new Map<string, [number, number, number]>();
  private quadBuffer: WebGLBuffer;
  private width = 0;
  private height = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL not available for GridRenderer");
    this.gl = gl;

    // Full-screen quad: two triangles covering clip space
    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]);
    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  resize(w: number, h: number): void {
    if (this.width === w && this.height === h) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  clear(): void {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  drawLayer(
    layer: GridLayerParams,
    offsetX: number,
    offsetY: number,
    dpr: number,
  ): void {
    const gl = this.gl;
    const shapeKey = layer.type === "lines" ? "lines" : "dots";
    const info = this.getProgram(shapeKey);

    gl.useProgram(info.program);

    // Bind quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(info.a_position);
    gl.vertexAttribPointer(info.a_position, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const spacing = layer.spacing * dpr;
    const size = layer.size * dpr;
    const rad = (layer.rotation * Math.PI) / 180;

    // DPR-scale offset to match physical-pixel coordinate space
    const ox = offsetX * dpr;
    const oy = offsetY * dpr;

    // Compute wrapped offset in rotation-local space
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const localX = ox * cosR + oy * sinR;
    const localY = -ox * sinR + oy * cosR;
    const wrappedLocalX = ((localX % spacing) + spacing) % spacing;
    const wrappedLocalY = ((localY % spacing) + spacing) % spacing;

    let rgb = this.colorCache.get(layer.color);
    if (!rgb) {
      rgb = parseHslToRgb(layer.color);
      this.colorCache.set(layer.color, rgb);
    }
    const [r, g, b] = rgb;

    gl.uniform2f(info.u_resolution, this.width, this.height);
    gl.uniform1f(info.u_spacing, spacing);
    gl.uniform1f(info.u_size, size);
    gl.uniform1f(info.u_rotation, rad);
    gl.uniform3f(info.u_color, r, g, b);
    gl.uniform2f(info.u_wrappedOffset, wrappedLocalX, wrappedLocalY);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    const gl = this.gl;
    for (const info of this.programs.values()) {
      gl.deleteProgram(info.program);
    }
    this.programs.clear();
    gl.deleteBuffer(this.quadBuffer);
  }

  // ─── Private ───

  private getProgram(shapeKey: string): ProgramInfo {
    let info = this.programs.get(shapeKey);
    if (info) return info;

    const shapeType = shapeKey === "lines" ? 1 : 0;
    const fragSrc = `#define SHAPE_TYPE ${shapeType}\n` + FRAG_TEMPLATE;

    const gl = this.gl;
    const program = this.compileProgram(VERT_SRC, fragSrc);

    info = {
      program,
      a_position: gl.getAttribLocation(program, "a_position"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_spacing: gl.getUniformLocation(program, "u_spacing"),
      u_size: gl.getUniformLocation(program, "u_size"),
      u_rotation: gl.getUniformLocation(program, "u_rotation"),
      u_color: gl.getUniformLocation(program, "u_color"),
      u_wrappedOffset: gl.getUniformLocation(program, "u_wrappedOffset"),
    };
    this.programs.set(shapeKey, info);
    return info;
  }

  private compileProgram(vertSrc: string, fragSrc: string): WebGLProgram {
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vertSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(vs);
      gl.deleteShader(vs);
      throw new Error("Vertex shader compile failed: " + log);
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(fs);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error("Fragment shader compile failed: " + log);
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error("Program link failed: " + log);
    }

    // Shaders can be detached after linking
    gl.detachShader(program, vs);
    gl.detachShader(program, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
  }
}

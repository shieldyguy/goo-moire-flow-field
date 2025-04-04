import { WebGLContext } from './WebGLContext';
import { ShaderManager } from './ShaderManager';

export class PostProcessor {
  private gl: WebGLRenderingContext;
  private shaderManager: ShaderManager;
  private width: number;
  private height: number;
  
  // Framebuffers for ping-pong rendering
  private fbo1: WebGLFramebuffer | null;
  private fbo2: WebGLFramebuffer | null;
  private texture1: WebGLTexture | null;
  private texture2: WebGLTexture | null;
  
  // Full-screen quad buffers
  private quadBuffer: WebGLBuffer | null;
  private texCoordBuffer: WebGLBuffer | null;
  
  constructor(context: WebGLContext, shaderManager: ShaderManager) {
    this.gl = context.getContext();
    this.shaderManager = shaderManager;
    this.width = 0;
    this.height = 0;
    
    // Initialize framebuffers
    this.fbo1 = this.gl.createFramebuffer();
    this.fbo2 = this.gl.createFramebuffer();
    this.texture1 = this.gl.createTexture();
    this.texture2 = this.gl.createTexture();
    
    // Initialize quad buffers
    this.quadBuffer = this.gl.createBuffer();
    this.texCoordBuffer = this.gl.createBuffer();
    
    // Set up full-screen quad
    this.setupQuad();
  }
  
  private setupQuad() {
    // Full-screen quad vertices (in clip space)
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);
    
    // Texture coordinates
    const texCoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1
    ]);
    
    // Set up vertex buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    
    // Set up texture coordinate buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
  }
  
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    
    // Resize textures
    this.setupTexture(this.texture1!, width, height);
    this.setupTexture(this.texture2!, width, height);
  }
  
  private setupTexture(texture: WebGLTexture, width: number, height: number) {
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
  }
  
  private renderToTexture(fbo: WebGLFramebuffer, texture: WebGLTexture) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    );
    this.gl.viewport(0, 0, this.width, this.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }
  
  private drawFullScreenQuad(program: WebGLProgram) {
    // Bind position buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    const positionLocation = this.gl.getAttribLocation(program, 'a_position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    // Bind texture coordinate buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    const texCoordLocation = this.gl.getAttribLocation(program, 'a_texCoord');
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    // Draw quad
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
    // Clean up
    this.gl.disableVertexAttribArray(positionLocation);
    this.gl.disableVertexAttribArray(texCoordLocation);
  }
  
  applyBlur(sourceTexture: WebGLTexture, blurAmount: number, blurSpread: number): WebGLTexture {
    const program = this.shaderManager.getShader('blur');
    this.shaderManager.useShader('blur');
    
    // Set up uniforms
    const resolutionLocation = this.gl.getUniformLocation(program, 'u_resolution');
    this.gl.uniform2f(resolutionLocation, this.width, this.height);
    
    const blurAmountLocation = this.gl.getUniformLocation(program, 'u_blurAmount');
    this.gl.uniform1f(blurAmountLocation, blurAmount);
    
    const blurSpreadLocation = this.gl.getUniformLocation(program, 'u_blurSpread');
    this.gl.uniform1f(blurSpreadLocation, blurSpread);
    
    // First pass - horizontal blur
    this.renderToTexture(this.fbo1!, this.texture1!);
    const directionLocation = this.gl.getUniformLocation(program, 'u_direction');
    this.gl.uniform2f(directionLocation, 1, 0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, sourceTexture);
    this.drawFullScreenQuad(program);
    
    // Second pass - vertical blur
    this.renderToTexture(this.fbo2!, this.texture2!);
    this.gl.uniform2f(directionLocation, 0, 1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture1!);
    this.drawFullScreenQuad(program);
    
    return this.texture2!;
  }
  
  applyThreshold(sourceTexture: WebGLTexture, thresholdMultiply: number, thresholdOffset: number, smoothness: number): WebGLTexture {
    const program = this.shaderManager.getShader('threshold');
    this.shaderManager.useShader('threshold');
    
    // Set up uniforms
    const multiplyLocation = this.gl.getUniformLocation(program, 'u_thresholdMultiply');
    this.gl.uniform1f(multiplyLocation, thresholdMultiply);
    
    const offsetLocation = this.gl.getUniformLocation(program, 'u_thresholdOffset');
    this.gl.uniform1f(offsetLocation, thresholdOffset);
    
    const smoothnessLocation = this.gl.getUniformLocation(program, 'u_smoothness');
    this.gl.uniform1f(smoothnessLocation, smoothness);
    
    // Apply threshold
    this.renderToTexture(this.fbo1!, this.texture1!);
    this.gl.bindTexture(this.gl.TEXTURE_2D, sourceTexture);
    this.drawFullScreenQuad(program);
    
    return this.texture1!;
  }
  
  composite(sourceTexture: WebGLTexture, backgroundColor: [number, number, number, number]): void {
    const program = this.shaderManager.getShader('composite');
    this.shaderManager.useShader('composite');
    
    // Set up uniforms
    const backgroundColorLocation = this.gl.getUniformLocation(program, 'u_backgroundColor');
    this.gl.uniform4fv(backgroundColorLocation, backgroundColor);
    
    // Render to screen
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, this.width, this.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.bindTexture(this.gl.TEXTURE_2D, sourceTexture);
    this.drawFullScreenQuad(program);
  }
  
  cleanup() {
    this.gl.deleteFramebuffer(this.fbo1);
    this.gl.deleteFramebuffer(this.fbo2);
    this.gl.deleteTexture(this.texture1);
    this.gl.deleteTexture(this.texture2);
    this.gl.deleteBuffer(this.quadBuffer);
    this.gl.deleteBuffer(this.texCoordBuffer);
  }
} 
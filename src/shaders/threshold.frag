precision mediump float;

uniform sampler2D u_image;
uniform float u_thresholdMultiply;
uniform float u_thresholdOffset;
uniform float u_smoothness;

varying vec2 v_texCoord;

void main() {
  vec4 color = texture2D(u_image, v_texCoord);
  
  // Apply color matrix-like transformation to alpha
  float multipliedAlpha = color.a * u_thresholdMultiply;
  float adjustedAlpha = multipliedAlpha + u_thresholdOffset;
  
  // Apply smooth transition
  float finalAlpha = smoothstep(0.0, u_smoothness, adjustedAlpha);
  
  // Keep original color but apply transformed alpha
  gl_FragColor = vec4(color.rgb, finalAlpha);
} 
precision mediump float;

uniform sampler2D u_image;
uniform vec4 u_backgroundColor;

varying vec2 v_texCoord;

void main() {
  vec4 color = texture2D(u_image, v_texCoord);
  
  // Blend with background color
  gl_FragColor = mix(u_backgroundColor, color, color.a);
} 
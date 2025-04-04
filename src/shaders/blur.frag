precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_blurAmount;
uniform float u_blurSpread;
uniform vec2 u_direction;

varying vec2 v_texCoord;

void main() {
  vec4 color = vec4(0.0);
  float total = 0.0;
  
  // Calculate the spread of the blur
  float spread = u_blurAmount * u_blurSpread;
  
  // Sample in a 5x5 grid
  for(int x = -2; x <= 2; x++) {
    for(int y = -2; y <= 2; y++) {
      // Calculate offset based on direction and spread
      vec2 offset = vec2(float(x), float(y)) * spread * u_direction / u_resolution;
      vec4 sample = texture2D(u_image, v_texCoord + offset);
      
      // Calculate weight based on distance from center
      float weight = 1.0 - length(vec2(x, y)) / 3.0;
      weight = max(0.0, weight);
      
      color += sample * weight;
      total += weight;
    }
  }
  
  gl_FragColor = color / total;
} 
attribute vec2 a_position;

uniform vec4 u_color;
uniform float u_size;
uniform vec2 u_offset;
uniform float u_rotation;

void main() {
  // Apply rotation
  float c = cos(u_rotation);
  float s = sin(u_rotation);
  vec2 pos = a_position;
  pos = vec2(
    pos.x * c - pos.y * s,
    pos.x * s + pos.y * c
  );
  
  // Apply offset
  pos += u_offset;
  
  // Set position
  gl_Position = vec4(pos, 0, 1);
  gl_PointSize = u_size;
} 
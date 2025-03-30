attribute float aSize;
varying vec3 vColor;

uniform float uTime;

#include ../includes/hash.glsl

void main() {
    float dist = length(position.xz);
    float maxDist = 15.0;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Create unique animation for each particle
    float randomOffset = hash(position) * 6.28318; // Random phase offset
    float randomSpeed = hash(position + 1.0) * 0.5 + 0.5; // Random speed between 0.5 and 1.0
    float sizeAnimation = sin(uTime * randomSpeed + randomOffset) * 0.5 + 0.5;

    gl_PointSize = aSize * sizeAnimation * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    vec3 innerColor = vec3(0.73, 0.09, 0.39); // hot core
    vec3 outerColor = vec3(0.1, 0.05, 0.08); // space dirt

    float t = smoothstep(0.0, maxDist, dist);
    vColor = mix(innerColor, outerColor, t);
}
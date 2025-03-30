uniform float uTime;

varying vec3 vWorldPosition; // from vertex shader

#include ../includes/hash.glsl
#include ../includes/noise.glsl
#include ../includes/fbm.glsl

void main() {
    vec3 dir = normalize(vWorldPosition - cameraPosition);
    float t = smoothstep(-1.2, 0.8, dir.y);

    // Distort with fbm noise
    vec3 p = vWorldPosition * 0.01;
    float base = fbm(p + vec3(0.0, 0.0, uTime * 0.1));
    float warp = fbm(p + base * 4.0 + vec3(0.0, uTime * 0.5, 0.0));
    float nebula = mix(base, warp, 0.7);

    t += (nebula - 0.5) * 0.3;

    vec3 colorBottom = vec3(0.99, 0.82, 0.45);
    vec3 colorTop = vec3(0.47, 0.2, 0.6);
    vec3 nebulaColor = mix(vec3(0.8, 0.3, 0.9), vec3(0.1, 0.2, 0.6), smoothstep(0.2, 0.8, nebula));
    nebulaColor = mix(nebulaColor, vec3(1.0, 0.5, 0.0), pow(nebula, 3.0));

    vec3 skyColor = mix(colorBottom, colorTop, clamp(t, 0.0, 1.0));

    skyColor = mix(skyColor, nebulaColor, smoothstep(0.4, 0.8, nebula) * 0.5);

    float radial = 1.0 - smoothstep(0.0, 200.0, length(vWorldPosition.xz));
    skyColor += vec3(1.0, 0.9, 0.6) * radial * 0.15;

    gl_FragColor = vec4(skyColor, 1.0);
}
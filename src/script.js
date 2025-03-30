import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import GUI from "lil-gui";
import particlesVertexShader from "./shaders/particles/vertex.glsl";
import particlesFragmentShader from "./shaders/particles/fragment.glsl";
import gpgpuParticlesFragmentShader from "./shaders/gpgpu/particles.glsl";
import groundVertexShader from "./shaders/ground/vertex.glsl";
import groundFragmentShader from "./shaders/ground/fragment.glsl";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import skydomeVertexShader from "./shaders/skydome/vertex.glsl";
import skydomeFragmentShader from "./shaders/skydome/fragment.glsl";
/**
 * Base
 */
// Debug
const showGUI =
  new URLSearchParams(window.location.search).get("debug") === "true";
const gui = showGUI ? new GUI({ width: 340 }) : null;

// Camera positions configuration
const initialCameraPosition = {
  desktop: {
    x: 8,
    y: 6,
    z: 16,
  },
  mobile: {
    x: 12,
    y: 8,
    z: 24,
  },
};

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
  isMobile: window.innerWidth < 1024,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);
  sizes.isMobile = sizes.width < 1024;

  // Update camera position on resize
  const position = sizes.isMobile
    ? initialCameraPosition.mobile
    : initialCameraPosition.desktop;
  camera.position.set(position.x, position.y, position.z);

  // Materials
  particles.material.uniforms.uResolution.value.set(
    sizes.width * sizes.pixelRatio,
    sizes.height * sizes.pixelRatio
  );

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(sizes.pixelRatio);
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  35,
  sizes.width / sizes.height,
  0.01,
  600
);

// Set initial camera position based on device type
const position = sizes.isMobile
  ? initialCameraPosition.mobile
  : initialCameraPosition.desktop;
camera.position.set(position.x, position.y, position.z);

scene.add(camera);

// Sky
const skyDomeGeometry = new THREE.SphereGeometry(200, 16, 16);
const skyDomeMaterial = new THREE.ShaderMaterial({
  vertexShader: skydomeVertexShader,
  fragmentShader: skydomeFragmentShader,
  side: THREE.BackSide,
  uniforms: {
    uTime: { value: 0 },
  },
});
const skyDome = new THREE.Mesh(skyDomeGeometry, skyDomeMaterial);
scene.add(skyDome);

// Ground
const groundParticles = {};
const groundSize = 50;
const groundRadius = groundSize * 0.5;
const innerRadius = 0.55; // Radius of the empty inner circle
const particleCount = 20000; // Use a fixed number of particles

// Create ground particles geometry
const groundPositions = new Float32Array(particleCount * 3);
const groundSizes = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
  const i3 = i * 3;

  // Generate random angle and radius for polar coordinates
  const angle = Math.random() * Math.PI * 2;

  // Use a power function to create denser distribution in the center
  // Higher power = more concentration in center
  // Scale the random value to start from innerRadius
  const radius =
    innerRadius + (groundRadius - innerRadius) * Math.pow(Math.random(), 1.5);

  // Convert polar to cartesian coordinates
  groundPositions[i3] = Math.cos(angle) * radius;
  groundPositions[i3 + 1] = -2 + (Math.random() - 0.5) * 0.2; // Slight height variation
  groundPositions[i3 + 2] = Math.sin(angle) * radius;

  // Size (random for more natural look)
  // Size (random for more natural look)
  groundSizes[i] = 0.05 + Math.random() * 0.35;
}

groundParticles.geometry = new THREE.BufferGeometry();
groundParticles.geometry.setAttribute(
  "position",
  new THREE.BufferAttribute(groundPositions, 3)
);
groundParticles.geometry.setAttribute(
  "aSize",
  new THREE.BufferAttribute(groundSizes, 1)
);

// Ground particles material
groundParticles.material = new THREE.ShaderMaterial({
  vertexShader: groundVertexShader,
  fragmentShader: groundFragmentShader,
  transparent: true,
  vertexColors: true,
  uniforms: {
    uTime: { value: 0 },
  },
});

// Create ground points
groundParticles.points = new THREE.Points(
  groundParticles.geometry,
  groundParticles.material
);
scene.add(groundParticles.points);

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.5; // Prevents looking below the ground
controls.minDistance = 5; // Prevents getting too close to the ground
controls.maxDistance = 50; // Prevents getting too far

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(sizes.pixelRatio);

/**
 * Load model
 */
const model = await gltfLoader.loadAsync("./tree4.glb");
/**
 * Base Geometry
 */
const baseGeometry = {};
baseGeometry.instance = model.scene.children[0].geometry;
baseGeometry.count = baseGeometry.instance.attributes.position.count;
/**
 * GPU Compute
 */
// Setup
const gpgpu = {};
gpgpu.size = Math.ceil(Math.sqrt(baseGeometry.count));
gpgpu.computation = new GPUComputationRenderer(
  gpgpu.size,
  gpgpu.size,
  renderer
);

const offsetY = -2; // move model 2 units down (adjust as needed)

// Base particles
const baseParticlesTexture = gpgpu.computation.createTexture();
for (let i = 0; i < baseGeometry.count; i++) {
  const i3 = i * 3;
  const i4 = i * 4;

  const x = baseGeometry.instance.attributes.position.array[i3 + 0];
  const y = baseGeometry.instance.attributes.position.array[i3 + 1] + offsetY;
  const z = baseGeometry.instance.attributes.position.array[i3 + 2];

  baseParticlesTexture.image.data[i4 + 0] = x;
  baseParticlesTexture.image.data[i4 + 1] = y;
  baseParticlesTexture.image.data[i4 + 2] = z;
  baseParticlesTexture.image.data[i4 + 3] = Math.random();
}

// Particles variable
gpgpu.particlesVariable = gpgpu.computation.addVariable(
  "uParticles",
  gpgpuParticlesFragmentShader,
  baseParticlesTexture
);

gpgpu.computation.setVariableDependencies(gpgpu.particlesVariable, [
  gpgpu.particlesVariable,
]);

// Uniforms
gpgpu.particlesVariable.material.uniforms.uTime = new THREE.Uniform(0.0);
gpgpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0.0);
gpgpu.particlesVariable.material.uniforms.uBase = new THREE.Uniform(
  baseParticlesTexture
);
gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence =
  new THREE.Uniform(0.6);
gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength =
  new THREE.Uniform(3.5);
gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency =
  new THREE.Uniform(0.6);
gpgpu.particlesVariable.material.uniforms.uFlowFieldHeight = new THREE.Uniform(
  0.0
);

gpgpu.computation.init();

// Debug
gpgpu.debug = new THREE.Mesh(
  new THREE.PlaneGeometry(3, 3),
  new THREE.MeshBasicMaterial({
    map: gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable)
      .texture,
  })
);
gpgpu.debug.position.x = 3;
gpgpu.debug.visible = false;
scene.add(gpgpu.debug);

/**
 * Particles
 */
const particles = {};

const particlesUvArray = new Float32Array(baseGeometry.count * 2);
const sizesArray = new Float32Array(baseGeometry.count);

for (let i = 0; i < gpgpu.size; i++) {
  for (let j = 0; j < gpgpu.size; j++) {
    const index = i * gpgpu.size + j;
    const i2 = index * 2;
    const uvX = (j + 0.5) / gpgpu.size;
    const uvY = (i + 0.5) / gpgpu.size;

    particlesUvArray[i2 + 0] = uvX;
    particlesUvArray[i2 + 1] = uvY;

    sizesArray[index] = Math.random();
  }
}

particles.geometry = new THREE.BufferGeometry();
particles.geometry.setDrawRange(0, baseGeometry.count);
particles.geometry.setAttribute(
  "aParticlesUv",
  new THREE.BufferAttribute(particlesUvArray, 2)
);
particles.geometry.setAttribute(
  "aColor",
  baseGeometry.instance.attributes.color
);
particles.geometry.setAttribute(
  "aSize",
  new THREE.BufferAttribute(sizesArray, 1)
);

// Material
particles.material = new THREE.ShaderMaterial({
  vertexShader: particlesVertexShader,
  fragmentShader: particlesFragmentShader,
  uniforms: {
    uSize: new THREE.Uniform(0.07),
    uResolution: new THREE.Uniform(
      new THREE.Vector2(
        sizes.width * sizes.pixelRatio,
        sizes.height * sizes.pixelRatio
      )
    ),
    uParticlesTexture: new THREE.Uniform(),
  },
});

// Points
particles.points = new THREE.Points(particles.geometry, particles.material);
particles.points.frustumCulled = false;
scene.add(particles.points);

/**
 * Tweaks
 */
if (showGUI) {
  gui
    .add(particles.material.uniforms.uSize, "value")
    .min(0)
    .max(1)
    .step(0.001)
    .name("Particle Size");
  gui
    .add(gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence, "value")
    .min(0)
    .max(1)
    .step(0.001)
    .name("Flow Field Influence");
  gui
    .add(gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength, "value")
    .min(0)
    .max(10)
    .step(0.01)
    .name("Flow Field Strength");
  gui
    .add(gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency, "value")
    .min(0)
    .max(1)
    .step(0.001)
    .name("Flow Field Frequency");
  gui
    .add(gpgpu.particlesVariable.material.uniforms.uFlowFieldHeight, "value")
    .min(-5)
    .max(5)
    .step(0.1)
    .name("Flow Field Height");
}

/**
 * Animate
 */
const clock = new THREE.Clock();
let previousTime = 0;

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - previousTime;
  previousTime = elapsedTime;

  // Update controls
  controls.update();

  // Update sky animation
  skyDomeMaterial.uniforms.uTime.value = performance.now() * 0.001;

  // Update ground animation
  groundParticles.material.uniforms.uTime.value = elapsedTime;

  // Update uniforms
  gpgpu.particlesVariable.material.uniforms.uTime.value = elapsedTime;
  gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime;

  // GPGPU Update
  gpgpu.computation.compute();
  particles.material.uniforms.uParticlesTexture.value =
    gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture;

  // Render normal scene
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

tick();

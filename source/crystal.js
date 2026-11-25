import * as THREE from "./vendor/three.module.js";

const TAU = Math.PI * 2;
const SQRT3 = Math.sqrt(3);

function generator(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function geometryBuilder() {
  const positions = [];
  const birth = [];
  const tone = [];
  const edges = [];
  const edgeBirth = [];

  function triangle(a, b, c, times, tint) {
    positions.push(...a, ...b, ...c);
    birth.push(...times);
    tone.push(tint, tint, tint);
  }

  function edge(a, b, first, last) {
    edges.push(...a, ...b);
    edgeBirth.push(first, last);
  }

  function blade(x, y, z, angle, length, width, first, last, tint, shape = "twig") {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const outline = [[-1, 0], [-0.62, 0.39], [0, 1], [0.64, 0.44], [1, 0], [0, -0.60]];
    const profile = shape === "needle"
      ? [[0, 0.5], [0.13, 0.94], [0.83, 0.72], [1, 0.01]]
      : [[0, 0.58], [0.19, 1], [0.55, 0.74], [0.87, 0.49], [1, 0.008]];
    const silhouette = profile.flatMap(([at, taper], i) => {
      if (i === profile.length - 1) return [[at, taper]];
      const [next, nextTaper] = profile[i + 1];
      return [[at, taper], [(at + next) / 2, (taper + nextTaper) / 2]];
    });
    const rings = silhouette.map(([distance, taper]) => outline.map(([cross, height]) => [
      x + dx * length * distance - dy * width * cross * taper,
      y + dy * length * distance + dx * width * cross * taper,
      z + width * height * taper * 0.62
    ]));
    const times = silhouette.map(([distance]) => first + (last - first) * distance);
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < outline.length; j++) {
        const k = (j + 1) % outline.length;
        const a = rings[i][j], b = rings[i][k], c = rings[i + 1][k], d = rings[i + 1][j];
        const t0 = times[i], t1 = times[i + 1];
        triangle(a, b, c, [t0, t0, t1], tint);
        triangle(a, c, d, [t0, t1, t1], tint);
        if (j === 0 || j === 2 || j === 4) edge(a, d, t0, t1);
        if (i === 2 && j < 4) edge(a, b, t0, t0);
      }
    }
  }

  function plate(radius, angle, z, height, tint) {
    const ring = (r, h) => Array.from({ length: 6 }, (_, i) => {
      const a = i * TAU / 6 + angle;
      return [Math.cos(a) * r, Math.sin(a) * r, z + h];
    });
    const face = ring(radius * 0.79, height);
    const rim = ring(radius, height * 0.21);
    const base = ring(radius * 0.87, -height * 0.7);
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const tintStep = tint + (i % 3) * 0.12;
      triangle([0, 0, z + height * 1.07], face[i], face[j], [0, 0, 0], tintStep);
      triangle(face[i], rim[i], rim[j], [0, 0, 0], tintStep + 0.2);
      triangle(face[i], rim[j], face[j], [0, 0, 0], tintStep + 0.2);
      triangle(rim[i], base[i], base[j], [0, 0, 0], tintStep);
      triangle(rim[i], base[j], rim[j], [0, 0, 0], tintStep);
      edge(face[i], face[j], 0, 0);
      edge(rim[i], rim[j], 0, 0);
      edge(face[i], rim[i], 0, 0);
    }
    for (const ratio of [0.56, 0.39, 0.22]) {
      const inset = ring(radius * ratio, height * 1.065);
      for (let i = 0; i < 6; i++) edge(inset[i], inset[(i + 1) % 6], 0, 0);
    }
  }

  function build() {
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    mesh.setAttribute("birth", new THREE.Float32BufferAttribute(birth, 1));
    mesh.setAttribute("tone", new THREE.Float32BufferAttribute(tone, 1));
    mesh.computeVertexNormals();
    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.Float32BufferAttribute(edges, 3));
    lines.setAttribute("birth", new THREE.Float32BufferAttribute(edgeBirth, 1));
    return { mesh, lines };
  }
  return { blade, plate, build };
}

function dendriteGeometry(seed, compact) {
  const rand = generator(seed);
  const shape = geometryBuilder();
  const tips = [];
  shape.plate(compact ? 0.81 : 0.71, Math.PI / 2, 0, 0.17, 0.16);
  for (let arm = 0; arm < 6; arm++) {
    const angle = Math.PI / 2 + arm * TAU / 6;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const length = (compact ? 3.20 : 3.78) * (0.963 + rand() * 0.063);
    const root = 0.55;
    tips.push([dx * length, dy * length, 0]);
    shape.blade(dx * root, dy * root, 0, angle, length - root, 0.23, 0.035, 0.89, rand() * 0.45);
    const groups = compact
      ? [[0.44, 1.32, 0.25], [0.64, 1.20, 0.20], [0.81, 0.70, 0.16]]
      : [[0.31, 0.83, 0.17], [0.45, 1.28, 0.23], [0.60, 1.38, 0.21], [0.74, 1.14, 0.17], [0.87, 0.70, 0.13]];
    for (const [fraction, sideLength, width] of groups) {
      for (const side of [-1, 1]) {
        const branchAngle = angle + side * (1.01 + rand() * 0.08);
        const r = length * (fraction + (rand() - 0.5) * 0.023);
        const l = sideLength * (0.90 + rand() * 0.19);
        const start = 0.055 + 0.855 * (r - root) / (length - root);
        const end = Math.min(0.98, start + 0.27);
        const tint = 0.16 + 0.62 * rand();
        shape.blade(dx * r, dy * r, 0.018, branchAngle, l, width * .89, start, end, tint);
        for (const frac of (width > 0.16 ? [0.50, 0.73] : [0.60])) {
          const sx = dx * r + Math.cos(branchAngle) * l * frac;
          const sy = dy * r + Math.sin(branchAngle) * l * frac;
          const twigStart = start + frac * (end - start) + .018;
          shape.blade(sx, sy, 0.025, angle + side * 0.28, l * (0.27 + rand() * 0.14), width * 0.40,
            twigStart, Math.min(1.01, twigStart + 0.13), 0.52 + rand() * 0.29);
        }
      }
    }
  }
  return { ...shape.build(), tips };
}

function needleGeometry() {
  const shape = geometryBuilder();
  const rand = generator(745);
  for (let i = 0; i < 7; i++) {
    const angle = 1.01 + (i - 3) * 0.091;
    const length = 3.6 + rand() * 1.5;
    const x = -Math.cos(angle) * length * 0.54 + (i - 3) * 0.16;
    const y = -Math.sin(angle) * length * 0.53 + (rand() - 0.5) * 0.61;
    shape.blade(x, y, i * 0.05, angle, length, 0.11 + rand() * 0.13, i * 0.04, 0.9 + i * 0.014, 0.24 + rand() * 0.7, "needle");
  }
  return shape.build();
}

const vertex = `
  attribute float birth;
  attribute float tone;
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying float vBirth;
  varying float vTone;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vLocal = position;
    vBirth = birth;
    vTone = tone;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
  }
`;
const fragment = `
  uniform vec3 tint;
  uniform float growth;
  uniform float glint;
  uniform float exposure;
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying float vBirth;
  varying float vTone;
  void main(){
    if(vBirth > growth) discard;
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1. : -1.);
    vec3 l = normalize(vec3(-.48,.73,.84));
    vec3 h = normalize(l + vec3(0.,0.,1.));
    float diffuse = max(dot(n,l),0.);
    float spec = pow(max(dot(n,h),0.),19.);
    float rim = pow(1.-abs(n.z),2.25);
    float ripple = sin(44.*vLocal.x + 61.*vLocal.y + 3.*sin(vLocal.y*10.)) * .5 + .5;
    float fractures = pow(ripple, 16.) * .065;
    float beam = exp(-27.*pow(vLocal.x + .58*vLocal.y - glint,2.));
    float fresh = exp(-70.*abs(growth-vBirth)) * step(growth,1.03);
    vec3 base = tint * (.22 + .43*diffuse + vTone*.23 + fractures);
    vec3 pearl = vec3(.83,.97,1.);
    vec3 c = base + pearl*(.41*spec + .32*rim + .33*beam + .54*fresh);
    gl_FragColor = vec4(min(c * exposure,vec3(1.)),1.);
  }
`;
const edgeVertex = `
  attribute float birth;
  varying float vBirth;
  varying vec3 vLocal;
  void main(){
    vBirth = birth;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
  }
`;
const edgeFragment = `
  uniform float growth;
  uniform float glint;
  uniform vec3 tint;
  varying float vBirth;
  varying vec3 vLocal;
  void main(){
    if(vBirth > growth) discard;
    float light = exp(-13.*pow(vLocal.x+.58*vLocal.y-glint,2.));
    gl_FragColor = vec4(mix(tint,vec3(.89,.98,1.),.68),.32+light*.46);
  }
`;

export function createIceStage(width, height) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const viewWidth = 1920, viewHeight = 1080;
  const camera = new THREE.OrthographicCamera(0, viewWidth, viewHeight, 0, 0.1, 4000);
  camera.position.z = 1800;
  const objects = new Map();
  for (const [key, geometry] of [
    ["hero", dendriteGeometry(212, false)], ["growth", dendriteGeometry(944, false)],
    ["branch", dendriteGeometry(1989, true)], ["needle", needleGeometry()]
  ]) {
    const uniforms = {
      tint: { value: new THREE.Vector3(0.37, 0.75, 0.93) },
      growth: { value: 1.05 }, glint: { value: -12 }, exposure: { value: 1.0 }
    };
    const facets = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, side: THREE.DoubleSide });
    const edges = new THREE.ShaderMaterial({ uniforms, vertexShader: edgeVertex, fragmentShader: edgeFragment, transparent: true, depthWrite: false });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry.mesh, facets), new THREE.LineSegments(geometry.lines, edges));
    group.visible = false;
    scene.add(group);
    objects.set(key, { group, uniforms, tips: geometry.tips });
  }

  function draw(placements) {
    for (const { group } of objects.values()) group.visible = false;
    for (const { key, x, y, size, rx = 0, ry = 0, rz = 0, grow = 1.05, glint = -12, tint = [0.37, 0.75, 0.93], light = 1 } of placements) {
      const { group, uniforms } = objects.get(key);
      group.visible = true;
      group.position.set(x, viewHeight - y, 0);
      group.scale.setScalar(size);
      group.rotation.set(rx, ry, rz);
      uniforms.tint.value.set(...tint);
      uniforms.growth.value = grow;
      uniforms.glint.value = glint;
      uniforms.exposure.value = light;
    }
    renderer.render(scene, camera);
    return renderer.domElement;
  }

  function tipPixels(key) {
    const { group, tips } = objects.get(key);
    return tips.map(point => {
      const v = group.localToWorld(new THREE.Vector3(...point));
      return [v.x, viewHeight - v.y];
    });
  }
  return { draw, tipPixels };
}

export const hexHeight = SQRT3 / 2;

import { createIceStage, hexHeight } from "./crystal.js";

const W = 1920, H = 1080, TAU = Math.PI * 2;
const canvas = document.querySelector("#frame");
const ctx = canvas.getContext("2d", { alpha: false });
const timeline = await fetch("./timeline.json").then(response => response.json());
const photograph = new Image();
photograph.src = "./assets/bentley-579A.jpg";
await Promise.all([
  document.fonts.load("760 100px IceSerif", "雪花为什么有六个角"),
  document.fonts.load("550 52px IceSans", "水汽在冰晶表面凝华"),
  photograph.decode()
]);
await document.fonts.ready;

const stage = createIceStage(1440, 810);
const clamp = x => Math.min(1, Math.max(0, x));
const mix = (a, b, u) => a + (b - a) * u;
function ease(a, b, value) {
  const u = clamp((value - a) / (b - a));
  return u * u * (3 - 2 * u);
}
function easeOut(a, b, value) {
  return 1 - (1 - clamp((value - a) / (b - a))) ** 3;
}
function windowOpacity(t, start, end, ramp = 0.3) {
  return ease(start, start + ramp, t) * (1 - ease(end - ramp, end, t));
}
const cyan = "#a5e5ff", sky = "#def3ff", paperInk = "#142e48", amber = "#f0c887";

function rgba(r, g, b, a) {
  return "rgba(" + r + "," + g + "," + b + "," + clamp(a) + ")";
}

function random(seed) {
  seed = (Math.imul(seed, 747796405) + 2891336453) >>> 0;
  seed = Math.imul((seed >>> ((seed >>> 28) + 4)) ^ seed, 277803737) >>> 0;
  return ((seed ^ (seed >>> 22)) >>> 0) / 4294967296;
}

function colorWash(x, y, radius, rgb, strength) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgba(...rgb, strength));
  g.addColorStop(0.46, rgba(...rgb, strength * 0.37));
  g.addColorStop(1, rgba(...rgb, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function text(value, x, y, {
  size = 50, weight = 550, family = "IceSans", color = sky, alpha = 1, align = "left"
} = {}) {
  if (alpha < 0.002) return;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  ctx.font = weight + " " + size + "px " + family;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}

function path(points, color, width = 1, close = false, fill = null) {
  ctx.beginPath();
  for (const [i, [x, y]] of points.entries()) i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  if (close) ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function dot(x, y, r, color, line = null) {
  if (r <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (line) {
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}

function hex(cx, cy, radius, angle = -Math.PI / 2) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = angle + i * TAU / 6;
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
  });
}

function gradientFrame(top, bottom) {
  const g = ctx.createLinearGradient(0, 0, W * 0.45, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

const specks = Array.from({ length: 120 }, (_, i) => ({
  x: random(800 + i) * (W + 160) - 80,
  y: random(1100 + i) * (H + 160) - 80,
  radius: 0.7 + random(1600 + i) ** 4 * 4.4,
  z: 0.25 + random(1700 + i) * 0.75,
  offset: random(2200 + i) * TAU
}));
const lensDust = Array.from({ length: 15 }, (_, i) => ({
  x: random(4600 + i) * W, y: random(4700 + i) * H,
  radius: 13 + 69 * random(4900 + i) ** 2, offset: random(5100 + i) * TAU
}));
const fiberTile = document.createElement("canvas");
fiberTile.width = 250;
fiberTile.height = 250;
const fiber = fiberTile.getContext("2d");
for (let i = 0; i < 800; i++) {
  fiber.fillStyle = i % 2 ? "rgba(254,246,220,.13)" : "rgba(16,31,46,.12)";
  fiber.fillRect(random(i + 640) * 250, random(i + 1000) * 250, 1 + random(i + 2000) * 2, 1);
}
const fiberPattern = ctx.createPattern(fiberTile, "repeat");

function grain(alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fiberPattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function air(t, alpha = 1, flow = 1) {
  for (const p of specks) {
    const x = ((p.x + 80 + t * (12 + 27 * p.z) * flow) % (W + 160) + W + 160) % (W + 160) - 80;
    const y = (p.y + 80 + t * 8 * p.z) % (H + 160) - 80 + 15 * Math.sin(t * .26 + p.offset);
    const pulse = 0.50 + Math.sin(p.offset + t * .93) * 0.25;
    dot(x, y, p.radius, rgba(171, 227, 250, alpha * p.z * pulse));
  }
}

function defocus(t, strength) {
  for (const p of lensDust) {
    const x = p.x + Math.sin(t * .26 + p.offset) * 96;
    const y = p.y + Math.cos(t * .17 + p.offset) * 50;
    colorWash(x, y, p.radius, [89, 198, 241], strength * (0.11 + 0.12 * Math.sin(p.offset + .5 * t) ** 2));
  }
}

function iceLayer(placements, alpha = 1, bloom = 0) {
  if (alpha < 0.002) return;
  const surface = stage.draw(placements);
  if (bloom > .002) {
    ctx.save();
    ctx.globalAlpha = alpha * bloom;
    ctx.filter = "blur(13px)";
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(surface, 0, 0, W, H);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(surface, 0, 0, W, H);
  ctx.restore();
}

function ring(cx, cy, r, color, width = 1, squash = 1) {
  if (r <= 0) return;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * squash, 0, 0, TAU);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function flare(x, y, amount, width = 82) {
  if (amount < 0.005) return;
  colorWash(x, y, width, [83, 202, 255], amount * 0.46);
  const g = ctx.createLinearGradient(x - width * 2, y, x + width * 2, y);
  g.addColorStop(0, "rgba(131,219,255,0)");
  g.addColorStop(.48, rgba(131,219,255,amount*.30));
  g.addColorStop(.5, rgba(224,249,255,amount*.83));
  g.addColorStop(.52, rgba(131,219,255,amount*.30));
  g.addColorStop(1, "rgba(131,219,255,0)");
  path([[x - width * 2,y], [x + width * 2,y]], g, 1.7);
  dot(x, y, 2.6, rgba(226, 249, 255, amount));
}

function slideText(value, x, y, t, start, style) {
  const u = easeOut(start, start + .6, t);
  text(value, x, y + (1 - u) * 25, { ...style, alpha: (style.alpha ?? 1) * u });
}

function lineCaption(t, light) {
  const entry = timeline.captions.find(([start, end]) => t >= start && t < end);
  if (!entry) return;
  const [start, end, value] = entry;
  const a = windowOpacity(t, start, end, 0.28);
  const strip = ctx.createLinearGradient(0, 855, 0, 1080);
  strip.addColorStop(0, light ? rgba(226,240,245,0) : rgba(2,10,20,0));
  strip.addColorStop(0.42, light ? rgba(226,240,245,a*.71) : rgba(2,10,20,a*.80));
  strip.addColorStop(1, light ? rgba(226,240,245,a) : rgba(2,10,20,a));
  ctx.fillStyle = strip;
  ctx.fillRect(0, 855, W, 225);
  text(value, W / 2, 978 + 8 * (1 - ease(start, start + 0.28, t)), {
    size: 53, weight: 570, alpha: a, color: light ? "#142e48" : "#eef8ff", align: "center"
  });
}

function macro(t) {
  gradientFrame("#040a15", "#0c2235");
  colorWash(1350, 433, 850, [35, 121, 176], .76);
  colorWash(1900, 80, 1040, [44, 113, 181], .44);
  const focus = ease(4.22, 5.27, t);
  const x = mix(1353 - 43 * ease(0, 3.1, t), 960, focus);
  const y = mix(484, 525, focus);
  const lightTime = 3.10;
  const face = ease(0.14, lightTime + .22, t);
  const snap = Math.exp(-5 * Math.abs(t - lightTime));
  const size = mix(177 - 56 * face, 384, focus);
  const rx = mix(-0.72, -0.10, face) + focus * 0.09;
  const ry = mix(1.06, -0.05, face) + focus * 0.09;
  const rz = mix(-0.59, 0.06, face) * (1 - focus);
  defocus(t, .82);
  air(t, .67);
  for (const off of [-32, 27, 70]) {
    path([[1330 + off, 0], [1690 + off, 0], [1020 + off, 985]], null, 1, true, "rgba(104,204,249,.026)");
  }
  colorWash(x, y, 620 + focus * 180, [56, 184, 226], .35 + snap * .22);
  iceLayer([{ key: "hero", x, y, size, rx, ry, rz,
    tint: [.37, .77, .97], glint: mix(-6, 6, ease(1.92, 4.1, t)), light: 1.02 + .28 * snap }],
    ease(0, .35, t), .11 + .68 * snap);
  for (const [i, [tx, ty]] of stage.tipPixels("hero").entries()) {
    const onset = lightTime + .016 * i;
    flare(tx, ty, Math.exp(-4 * Math.abs(t - onset)) * (1 - focus) * .82, 48 + (i % 3) * 7);
  }
  const a = 1 - ease(4.23, 4.95, t);
  slideText("雪花为什么", 114, 439, t, .31, { family: "IceSerif", size: 116, weight: 770, alpha: a });
  slideText("有六个角？", 115, 593, t, .58, { family: "IceSerif", size: 128, weight: 790, color: cyan, alpha: a });
  path([[119, 653], [119 + 163 * easeOut(.93, 1.84, t), 653]], rgba(165, 229, 255, a * .68), 3);
  grain(.39);
}

function buildLattice() {
  const nodes = new Map(), edges = new Map();
  const radius = 62;
  function nodeId([x, y]) { return Math.round(x * 100) + ":" + Math.round(y * 100); }
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      if (Math.abs(q + r) > 3) continue;
      const points = hex(2 * hexHeight * radius * (q + r / 2), 1.5 * radius * r, radius);
      for (let i = 0; i < 6; i++) {
        const a = points[i], b = points[(i + 1) % 6], ai = nodeId(a), bi = nodeId(b);
        nodes.set(ai, a);
        edges.set([ai, bi].sort().join("|"), [a, b]);
      }
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
const lattice = buildLattice();
const directions = hex(0, 0, 1);

function latticeShot(t) {
  gradientFrame("#f1f7f5", "#bedce9");
  colorWash(1390, 381, 750, [237, 252, 255], .75);
  colorWash(116, 88, 660, [255, 255, 246], .54);
  const enter = easeOut(5.20, 6.4, t);
  const shrink = ease(13.57, 14.21, t);
  const x = mix(mix(961, 1301, enter), 1288, shrink);
  const y = mix(526, 484, enter);
  const spin = mix(-.18, 0, enter) - .06 * shrink;
  const reveal = ease(5.36, 9.47, t);
  const scale = mix(mix(1.62, 1.05, enter), .24, shrink);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);
  const field = 480 * reveal;
  for (const [a, b] of lattice.edges) {
    const d = Math.hypot((a[0] + b[0]) * .5, (a[1] + b[1]) * .5);
    const opacity = ease(d - 39, d + 18, field) * (1 - .73 * shrink);
    path([a, b], rgba(31, 103, 146, .46 * opacity), 2.2);
  }
  for (const [x, y] of lattice.nodes) {
    const d = Math.hypot(x, y);
    const a = ease(d - 21, d + 32, field) * (1 - .73 * shrink);
    if (a > 0.002) {
      dot(x, y, 5, rgba(43, 111, 156, .68 * a));
      dot(x - .7, y - .9, 1.5, rgba(237, 250, 255, .85 * a));
    }
  }
  const emphasize = .55 + .45 * ease(5.24, 6.49, t);
  const core = mix(mix(215 / scale, 62, enter), 125 / scale, shrink ** 1.7);
  path(hex(0, 0, core), rgba(16, 92, 144, emphasize), 4.2, true, rgba(82, 172, 216, emphasize * (.19 + .44 * shrink)));
  for (const [i, [dx, dy]] of directions.entries()) {
    const a = easeOut(9.67 + i * .23, 10.23 + i * .23, t);
    if (a <= .001) continue;
    const range = mix(62 + a * 357, 216 / scale, shrink);
    path([[0, 0], [dx * range, dy * range]], rgba(7, 99, 155, a * .83), 2.8);
    dot(dx * range, dy * range, 9, "#0f729c");
    dot(dx * range, dy * range, 16, null, rgba(16, 117, 172, .52 * a));
  }
  const arc = easeOut(11.1, 11.9, t);
  if (arc > 0.002) {
    ctx.beginPath();
    ctx.arc(0, 0, 148, -Math.PI / 2, -Math.PI / 2 + arc * TAU / 6);
    ctx.lineWidth = 5;
    ctx.strokeStyle = rgba(12, 108, 158, (1 - shrink) * arc);
    ctx.stroke();
    text("60°", 105, -154, { size: 43, weight: 740, alpha: (1 - ease(13.23, 13.57, t)) * arc, color: "#0d6696" });
  }
  ctx.restore();
  const a = 1 - ease(13.46, 14.11, t);
  slideText("冰的", 113, 405, t, 5.75, { size: 91, weight: 740, family: "IceSerif", color: paperInk, alpha: a });
  slideText("六方结构", 113, 545, t, 6.01, { size: 115, weight: 770, family: "IceSerif", color: "#174f73", alpha: a });
  slideText("俯视示意", 120, 641, t, 6.54, { size: 41, color: "#355c78", alpha: a });
  grain(.42);
  lineCaption(t, true);
}

const streams = Array.from({ length: 96 }, (_, i) => ({
  axis: i % 6, start: 14.4 + random(300 + i) * 7.8, duration: .78 + random(600 + i) * 1.12,
  offset: (random(2400 + i) - .5) * 1.12, radius: 125 + 290 * random(3100 + i),
  bend: (random(3500 + i) - .5) * 140, brightness: .26 + random(6400 + i) * .57
}));

function vapor(t, x, y, targetRadius, facing) {
  for (const p of streams) {
    const u = (t - p.start) / p.duration;
    if (u < 0 || u >= 1) continue;
    const angle = -Math.PI / 2 + p.axis * TAU / 6 - facing;
    const curve = k => {
      const a = angle + p.offset * (1 - k);
      const r = targetRadius + p.radius * (1 - k) ** 1.3;
      const bend = p.bend * Math.sin(k * Math.PI);
      return [x + Math.cos(a) * r + Math.sin(a) * bend,
              y + Math.sin(a) * r - Math.cos(a) * bend];
    };
    const head = curve(u), tail = curve(Math.max(0, u - .105));
    const a = Math.sin(Math.PI * u) ** .68 * p.brightness;
    path([tail, head], rgba(118, 228, 247, a * .73), 2.35);
    dot(...head, 2.15 + a * 3.25, rgba(206, 250, 253, a));
    if (u > .79) colorWash(head[0], head[1], 29, [80, 232, 249], a * .59);
  }
}

function growthShot(t) {
  gradientFrame("#05141b", "#051f30");
  const reveal = ease(14.42, 22.29, t);
  const pull = ease(17.50, 22.27, t);
  const x = mix(1288, 1182, pull);
  const y = mix(483, 475, pull);
  const grow = 0.025 + 1.025 * reveal;
  const size = mix(183, 101, pull);
  const rz = mix(.06, -.04, reveal);
  colorWash(x, y, 740, [23, 133, 158], .46);
  colorWash(1802, 101, 860, [38, 114, 164], .38);
  defocus(t, .48);
  air(t, .53, .53);
  const fieldRadius = 111 + 308 * ease(14.58, 22.4, t);
  ring(x, y, fieldRadius, "rgba(83,193,220,.10)", 1.3);
  ring(x, y, fieldRadius + 94, "rgba(83,193,220,.065)", 1);
  const axesAlpha = .72 * (1 - ease(14.68, 16.67, t));
  if (axesAlpha > .002) {
    const rays = hex(x, y, mix(216, 259, ease(14.2, 15.9, t)), -Math.PI / 2 - rz);
    for (const [tx, ty] of rays) {
      path([[x, y], [tx, ty]], rgba(123, 220, 241, axesAlpha), 2);
      dot(tx, ty, 4.5, rgba(160, 231, 252, axesAlpha));
    }
  }
  vapor(t, x, y, size * (0.6 + 3.19 * clamp((grow - .035) / .855)), rz);
  const active = ease(16, 20.3, t) * (1 - ease(20.7, 23.4, t));
  iceLayer([{ key: "growth", x, y, size, rx: .24 * (1 - pull), ry: -.09 + .12 * pull,
    rz, grow, glint: mix(-4, 4, ease(17.84, 22.7, t)), tint: [.32, .81, .91], light: 1.06 + .12 * active }],
    1, .15 + .22 * active);
  const a = 1 - ease(23.05, 23.62, t);
  slideText("水汽凝华", 114, 415, t, 14.49, { family: "IceSerif", size: 93, weight: 750, alpha: a });
  slideText("生长示意", 121, 495, t, 14.81, { size: 38, weight: 490, color: "#a6d6e7", alpha: a });
  grain(.36);
  lineCaption(t, false);
}

function symmetryShot(t) {
  gradientFrame("#041024", "#141c3e");
  const x = 1301, y = 495;
  const arrive = ease(23.7, 24.63, t);
  const scan = ease(25.33, 26.65, t);
  const tail = ease(26.65, 30.85, t);
  const radius = mix(98, 410, scan) + tail * 252;
  colorWash(x, y, 705, [62, 112, 205], .53);
  colorWash(1740, 727, 590, [41, 142, 199], .42);
  defocus(t, .46);
  air(t, .68, .44);
  const cloudStrength = windowOpacity(t, 24.8, 30.86, 1.5);
  for (let i = 0; i < 11; i++) {
    const angle = i * TAU / 11 + .16 * (t - 26.65);
    const r = 280 + 97 * random(31000 + i);
    colorWash(x + Math.cos(angle) * r, y + Math.sin(angle) * r * .91,
      230 + 62 * random(32000 + i), [134, 205, 244], cloudStrength * .10);
  }
  ring(x, y, 436, "rgba(159,216,254,.16)", 1.3);
  ring(x, y, 470, "rgba(159,216,254,.09)", 1.0);
  ring(x, y, radius, rgba(161, 222, 255, .61 * ease(25.18, 25.48, t) * (1 - tail)), 2.8);
  ring(x, y, radius - 19, rgba(84, 203, 250, .16 * ease(25.18, 25.48, t) * (1 - tail)), 7.0);
  const glint = mix(-5.2, 5, ease(25.88, 28.87, t));
  const growth = mix(.79, 1.06, ease(26.65, 27.48, t));
  iceLayer([{ key: "hero", x, y, size: 106 + 10 * (1 - arrive), rx: .13 * (1 - arrive),
    ry: -.36 * (1 - arrive), rz: -.06 + .06 * arrive, glint, grow: growth,
    tint: [.48, .72, .99], light: 1.10 }]);
  const pulse = Math.exp(-2.8 * Math.abs(t - 26.65));
  const fade = 1 - ease(31.82, 32.36, t);
  const points = stage.tipPixels("hero");
  for (const [endX, endY] of points) {
    const a = ease(26.24, 26.65, t) * fade;
    const extent = .15 + .85 * clamp((growth - .035) / .855);
    const tx = mix(x, endX, extent), ty = mix(y, endY, extent);
    const ox = x + (tx - x) * 1.08;
    const oy = y + (ty - y) * 1.08;
    path([[tx, ty], [ox, oy]], rgba(171, 230, 255, a * .64), 1.6);
    dot(ox, oy, 5.0, rgba(187, 236, 255, a * .95));
    ring(ox, oy, 13 + pulse * 13, rgba(157, 226, 255, a * (.34 + pulse * .49)), 1.3);
    flare(tx, ty, pulse * .69, 54);
  }
  slideText("六条枝", 111, 423, t, 24.03, { family: "IceSerif", size: 113, weight: 770, alpha: fade });
  slideText("一起长", 111, 573, t, 24.35, { family: "IceSerif", size: 113, weight: 770, alpha: fade, color: "#b8d7ff" });
  slideText("相近的温度和水汽", 118, 673, t, 25.41, { size: 45, weight: 550, alpha: fade, color: "#b8d7ff" });
  grain(.36);
  lineCaption(t, false);
}

function bezier(p0, p1, p2, p3, u) {
  const v = 1 - u;
  return [v ** 3 * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u ** 3 * p3[0],
          v ** 3 * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u ** 3 * p3[1]];
}

function traceRoute(t, origin, end, control1, control2, start, arrive, rgb) {
  const progress = easeOut(start, arrive, t);
  const visible = ease(32.4, start + .08, t);
  const dim = 1 - .63 * ease(arrive + .28, arrive + 2.33, t);
  const points = Array.from({ length: 33 }, (_, i) => bezier(origin, control1, control2, end, i * progress / 32));
  path(points, rgba(...rgb, .18 * dim * visible), 7);
  path(points, rgba(...rgb, .76 * dim * visible), 2.5);
  const [x, y] = points.at(-1);
  const crystalAlpha = visible * (1 - ease(arrive, arrive + .68, t));
  flare(x, y, Math.sin(progress * Math.PI) ** .63 * .84 * visible, 78);
  path(hex(x, y, 14 + progress * 4, progress * 1.42), rgba(...rgb, crystalAlpha), 2.6, true, rgba(...rgb, .26 * crystalAlpha));
  dot(x, y, 4.2, rgba(...rgb, dim * visible));
}

function pathsShot(t) {
  gradientFrame("#061621", "#0d192a");
  const open = ease(32.44, 34.28, t);
  colorWash(486, 448, 755, [108, 76, 47], .62 * open);
  colorWash(1426, 473, 752, [37, 103, 176], .73 * open);
  colorWash(958, 74, 500, [104, 166, 181], .34);
  defocus(t, .51);
  air(t, .52, .81);
  const titleA = 1 - ease(42.92, 43.60, t);
  slideText("两条云中路径", W / 2, 153, t, 32.72, {
    size: 71, weight: 760, family: "IceSerif", align: "center", alpha: titleA
  });
  traceRoute(t, [838, 258], [480, 485], [807, 416], [663, 357], 32.59, 34.18, [231, 193, 124]);
  traceRoute(t, [1077, 258], [1425, 482], [1249, 203], [1326, 325], 32.84, 34.63, [136, 206, 255]);
  const needle = ease(34.19, 36.62, t);
  const branch = ease(34.63, 37.85, t);
  const beforeArchive = ease(42.88, 43.72, t);
  const xRight = mix(1425, 1428, beforeArchive);
  const yRight = mix(484, 483, beforeArchive);
  const idle = ease(38, 42.5, t);
  if (needle > .001 || branch > .001) {
    iceLayer([
      { key: "needle", x: 480, y: 499, size: 111, rx: .29, ry: -.31 + idle * .08, rz: -.25 + .12 * idle,
        grow: 1.06 * needle, tint: [.80, .65, .43], glint: mix(-4, 6, ease(34.45, 38.4, t)), light: 1.18 },
      { key: "branch", x: xRight, y: yRight, size: mix(79 + 6 * idle, 92, beforeArchive),
        rx: .22 * (1 - beforeArchive), ry: -.32 * (1 - beforeArchive), rz: mix(.24, .12, idle) * (1 - beforeArchive),
        grow: 1.06 * branch, tint: [.36, .72, 1], glint: mix(-4, 4, ease(35.51, 39.3, t)), light: 1.14 }
    ]);
  }
  const a = ease(37.05, 38.15, t) * titleA;
  text("约 −5°C", 480, 791, { size: 64, weight: 745, align: "center", color: amber, alpha: a });
  text("针状冰晶", 480, 852, { size: 41, weight: 535, align: "center", color: "#f9e9c9", alpha: a });
  text("约 −15°C", 1425, 791, { size: 64, weight: 745, align: "center", color: "#a6dfff", alpha: a });
  text("树枝状冰晶", 1425, 852, { size: 41, weight: 535, align: "center", color: "#ddf3ff", alpha: a });
  slideText("形态示意", 112, 117, t, 35.0, { size: 35, alpha: a * .9, color: "#c8dbe3" });
  grain(.44);
  lineCaption(t, false);
}

function archiveShot(t) {
  gradientFrame("#eee9df", "#cfdde1");
  colorWash(427, 178, 760, [255, 251, 231], .74);
  colorWash(1556, 607, 710, [185, 208, 215], .39);
  grain(.74);
  const reveal = easeOut(43.7, 44.78, t);
  const x = 914 + 10 * (1 - reveal), y = 145 + 15 * (1 - reveal);
  const width = 872, height = width * photograph.naturalHeight / photograph.naturalWidth;
  ctx.save();
  ctx.shadowColor = "rgba(9,23,41,.34)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#f2efe8";
  ctx.fillRect(x - 22, y - 22, width + 44, height + 44);
  ctx.restore();
  ctx.drawImage(photograph, x, y, width, height);
  const revealLine = ease(44.14, 46.23, t);
  const photoCenter = [x + .565 * width, y + .47 * height];
  const photoTips = [[.527,.106],[.817,.246],[.859,.595],[.615,.843],[.302,.713],[.283,.334]];
  const callout = windowOpacity(t, 44.64, 48.93, .61);
  ctx.save();
  ctx.globalAlpha = callout;
  for (const [i, [u, v]] of photoTips.entries()) {
    const s = easeOut(44.8 + i * .20, 45.43 + i * .20, t);
    const tx = x + width * u, ty = y + height * v;
    const vx = tx - photoCenter[0], vy = ty - photoCenter[1], length = Math.hypot(vx, vy);
    const ox = tx + vx / length * 27, oy = ty + vy / length * 27;
    if (s < .001) continue;
    ring(ox, oy, 14 + (1 - s) * 10, rgba(189, 231, 242, s * .82), 1.6);
    dot(ox, oy, 3.6, rgba(203, 241, 253, s * .92));
  }
  ctx.restore();
  path([[x, y + height + 57], [x + width * revealLine, y + height + 57]], "rgba(40,72,83,.37)", 1.5);
  text("Smithsonian Institution Archives", x, 1011, { size: 32, weight: 530, color: "#304b56", alpha: reveal });
  const info = 1 - ease(48.64, 49.31, t);
  slideText("显微镜下的", 114, 402, t, 44.11, { family: "IceSerif", size: 91, weight: 735, color: paperInk, alpha: info });
  slideText("雪晶", 108, 542, t, 44.31, { family: "IceSerif", size: 131, weight: 780, color: "#174b62", alpha: info });
  slideText("班特利显微摄影 · 约 1890 年", 118, 645, t, 44.73, { size: 39, color: "#34596c", alpha: info });
  slideText("六个角，来自冰的排列。", 114, 430, t, 49.36, {
    family: "IceSerif", size: 62, weight: 785, color: paperInk
  });
  slideText("枝条的形状，", 115, 549, t, 50.05, {
    family: "IceSerif", size: 61, weight: 740, color: "#174b62"
  });
  slideText("由云里的环境塑造。", 115, 634, t, 50.61, {
    family: "IceSerif", size: 61, weight: 740, color: "#174b62"
  });
}

function iceCut(t, cut, x, y, radius, rgb, alpha, width) {
  const delta = (t - cut) / width;
  if (Math.abs(delta) < 1) colorWash(x, y, radius * (1 + .23 * delta), rgb, (1 - Math.abs(delta)) ** 1.8 * alpha);
}

function transitionDetails(t) {
  iceCut(t, 5.2, 960, 529, 1190, [211, 246, 255], .83, .30);
  iceCut(t, 14.2, 1288, 492, 685, [194, 241, 248], .48, .33);
  iceCut(t, 23.7, 1260, 503, 920, [99, 198, 249], .43, .34);
  iceCut(t, 32.4, 964, 254, 990, [141, 191, 240], .45, .32);
  const shutter = 1 - Math.abs(t - 43.70) / .16;
  if (shutter > 0) {
    ctx.fillStyle = rgba(234, 241, 228, .61 * shutter ** 1.35);
    ctx.fillRect(0, 0, W, H);
  }
}

const sceneDraw = {
  macro, lattice: latticeShot, growth: growthShot, symmetry: symmetryShot, paths: pathsShot, archive: archiveShot
};
window.DUR = timeline.duration;
window.render = t => {
  const time = Math.max(0, Math.min(timeline.duration - .0001, t));
  const shot = timeline.shots.find(({ out }) => time < out);
  sceneDraw[shot.id](time);
  transitionDetails(time);
};
window.render(0);
window.READY = true;

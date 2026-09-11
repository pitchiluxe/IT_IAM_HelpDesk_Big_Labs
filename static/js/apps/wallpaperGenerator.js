/**
 * wallpaperGenerator.js — procedurally generated wallpapers and themes.
 *
 * Ported from the IAM_SSO_3D reference project. Uses a seeded RNG to drive
 * SVG drawing routines, so the same seed always produces the same image.
 * Generated wallpapers are stored as just their seed (8 chars) in localStorage
 * and re-rendered on demand — no data URIs needed.
 */

// ---- Seeded RNG (mulberry32) ----
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function span(r, lo, hi) { return lo + r() * (hi - lo); }

// ---- Palettes (dark, low-contrast — easy on the eyes behind windows) ----
const PALETTES = [
  { name: 'Midnight', bg: ['#0a0d12', '#111a24'], ink: '#4ec9b0', accent: '#7fd1c1' },
  { name: 'Cobalt',   bg: ['#080f1e', '#12203a'], ink: '#5b8def', accent: '#89b4ff' },
  { name: 'Graphite', bg: ['#0c0c0e', '#1a1a1f'], ink: '#8a95a3', accent: '#c3ccd8' },
  { name: 'Plum',     bg: ['#120a18', '#241033'], ink: '#b57edc', accent: '#d3aef0' },
  { name: 'Ember',    bg: ['#140b06', '#2a1408'], ink: '#d7853d', accent: '#f0b477' },
  { name: 'Moss',     bg: ['#07120c', '#0f2418'], ink: '#5aa871', accent: '#8fd3a3' },
  { name: 'Slate',    bg: ['#0b0f14', '#16202b'], ink: '#6b8ba4', accent: '#a3c0d6' },
  { name: 'Rust',     bg: ['#150a0a', '#2b1212'], ink: '#c1615b', accent: '#e59a95' },
  { name: 'Azure',    bg: ['#0a1020', '#102844'], ink: '#3da5e0', accent: '#6bc4f5' },
  { name: 'Sand',     bg: ['#1a160e', '#2e2618'], ink: '#c4a96a', accent: '#e0c890' },
];

const MOTIFS = ['Mesh', 'Orbit', 'Lattice', 'Drift', 'Ridge', 'Bloom'];
const W = 1920, H = 1080;

// ---- Drawing routines (each returns SVG fragment) ----
function mesh(r, ink, accent) {
  const count = Math.round(span(r, 14, 26));
  const nodes = Array.from({ length: count }, () => ({
    x: span(r, 60, W - 60), y: span(r, 60, H - 60), size: span(r, 2, 5),
  }));
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const others = nodes.map((n, j) => ({ n, j, d: Math.hypot(n.x - a.x, n.y - a.y) }))
      .filter(o => o.j !== i).sort((p, q) => p.d - q.d).slice(0, 2);
    for (const o of others) edges.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${o.n.x.toFixed(1)} ${o.n.y.toFixed(1)}`);
  }
  return `<path d="${edges.join('')}" stroke="${ink}" stroke-width="0.8" fill="none" opacity="0.20"/>` +
    nodes.map(n => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.size.toFixed(1)}" fill="${accent}" opacity="0.42"/>`).join('');
}

function orbit(r, ink, accent) {
  const cx = span(r, W * 0.3, W * 0.7), cy = span(r, H * 0.3, H * 0.7);
  const rings = Math.round(span(r, 7, 14)), gap = span(r, 55, 110);
  const out = [];
  for (let i = 1; i <= rings; i++) {
    const radius = i * gap;
    const dash = r() > 0.6 ? ` stroke-dasharray="${span(r, 4, 22).toFixed(0)} ${span(r, 6, 26).toFixed(0)}"` : '';
    out.push(`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${radius.toFixed(0)}" fill="none" stroke="${ink}" stroke-width="${span(r, 0.6, 1.6).toFixed(2)}" opacity="${(0.30 - i * 0.016).toFixed(3)}"${dash}/>`);
  }
  out.push(`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="7" fill="${accent}" opacity="0.5"/>`);
  return out.join('');
}

function lattice(r, ink, accent) {
  const step = span(r, 70, 130), skew = span(r, -0.35, 0.35);
  const out = [];
  for (let x = -H; x < W + H; x += step) out.push(`M${x.toFixed(0)} 0L${(x + skew * H).toFixed(0)} ${H}`);
  for (let y = 0; y < H; y += step) out.push(`M0 ${y.toFixed(0)}L${W} ${y.toFixed(0)}`);
  const dots = Math.round(span(r, 5, 12));
  const marks = Array.from({ length: dots }, () => {
    const gx = Math.round(span(r, 1, W / step - 1)) * step;
    const gy = Math.round(span(r, 1, H / step - 1)) * step;
    return `<rect x="${(gx - 4).toFixed(0)}" y="${(gy - 4).toFixed(0)}" width="8" height="8" fill="${accent}" opacity="0.45"/>`;
  }).join('');
  return `<path d="${out.join('')}" stroke="${ink}" stroke-width="0.6" fill="none" opacity="0.13"/>${marks}`;
}

function drift(r, ink, accent) {
  const lines = Math.round(span(r, 8, 16)), amp = span(r, 30, 110);
  const out = [];
  for (let i = 0; i < lines; i++) {
    const y = (H / (lines + 1)) * (i + 1);
    const phase = span(r, 0, Math.PI * 2);
    const pts = [];
    for (let x = 0; x <= W; x += 60) {
      const yy = y + Math.sin(x / span(r, 240, 420) + phase) * amp * (0.4 + r() * 0.2);
      pts.push(`${x === 0 ? 'M' : 'L'}${x} ${yy.toFixed(1)}`);
    }
    out.push(`<path d="${pts.join('')}" fill="none" stroke="${i % 4 === 0 ? accent : ink}" stroke-width="${span(r, 0.7, 1.8).toFixed(2)}" opacity="${span(r, 0.10, 0.28).toFixed(3)}"/>`);
  }
  return out.join('');
}

function ridge(r, ink, accent) {
  const layers = Math.round(span(r, 3, 6));
  const out = [];
  for (let i = 0; i < layers; i++) {
    const base = H * (0.55 + i * 0.09);
    const pts = [`M0 ${H}`, `L0 ${base.toFixed(0)}`];
    for (let x = 0; x <= W; x += span(r, 90, 200)) pts.push(`L${x.toFixed(0)} ${(base - span(r, 0, 130)).toFixed(0)}`);
    pts.push(`L${W} ${H}Z`);
    out.push(`<path d="${pts.join('')}" fill="${i === layers - 1 ? accent : ink}" opacity="${(0.06 + i * 0.02).toFixed(3)}"/>`);
  }
  return out.join('');
}

function bloom(r, ink, accent) {
  const count = Math.round(span(r, 5, 11));
  return Array.from({ length: count }, (_, i) => {
    const cx = span(r, 0, W), cy = span(r, 0, H), rad = span(r, 140, 460);
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" fill="${i % 3 === 0 ? accent : ink}" opacity="${span(r, 0.03, 0.09).toFixed(3)}"/>`;
  }).join('');
}

const DRAW = { Mesh: mesh, Orbit: orbit, Lattice: lattice, Drift: drift, Ridge: ridge, Bloom: bloom };

// ---- Public API ----
export function seedToId(seed, kind) { return `gen-${kind}-${(seed >>> 0).toString(36)}`; }

export function idToSeed(id) {
  const m = /^gen-(wall|lock)-([0-9a-z]+)$/.exec(id);
  if (!m) return null;
  const seed = parseInt(m[2], 36);
  if (!Number.isFinite(seed)) return null;
  return { seed, kind: m[1] };
}

export function randomSeed() { return Math.floor(Math.random() * 0xffffffff) >>> 0; }

/**
 * Build one wallpaper SVG from a seed. Returns { id, label, css } where css
 * is a complete CSS background value (gradient + SVG data URI).
 */
export function generateWallpaper(seed, kind = 'wall') {
  const r = rng(seed);
  const palette = PALETTES[Math.floor(r() * PALETTES.length)];
  const motif = MOTIFS[Math.floor(r() * MOTIFS.length)];
  const angle = Math.round(span(r, 100, 200));
  const strength = kind === 'lock' ? 0.75 : 1;
  const art = DRAW[motif](r, palette.ink, palette.accent);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
    `<defs><linearGradient id='g' gradientTransform='rotate(${angle})'>` +
    `<stop offset='0' stop-color='${palette.bg[0]}'/><stop offset='1' stop-color='${palette.bg[1]}'/>` +
    `</linearGradient></defs>` +
    `<rect width='${W}' height='${H}' fill='url(#g)'/>` +
    `<g opacity='${strength}'>${art}</g></svg>`;
  return {
    id: seedToId(seed, kind),
    label: `${palette.name} ${motif}`,
    css: `${palette.bg[0]} url("data:image/svg+xml,${encodeURIComponent(svg)}") center/cover no-repeat`,
    thumb: `url("data:image/svg+xml,${encodeURIComponent(svg)}") center/cover`,
  };
}

/**
 * Generate a batch of unique wallpapers, avoiding seeds already in use.
 */
export function generateBatch(count, kind, existingIds = []) {
  const taken = new Set(existingIds);
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 20) {
    guard++;
    const wp = generateWallpaper(randomSeed(), kind);
    if (taken.has(wp.id)) continue;
    taken.add(wp.id);
    out.push(wp);
  }
  return out;
}

// ---- Generated theme colors ----
const THEME_HUES = [
  { name: 'Teal',    h: 172 }, { name: 'Blue',   h: 210 }, { name: 'Indigo', h: 240 },
  { name: 'Purple',  h: 270 }, { name: 'Pink',   h: 320 }, { name: 'Rose',   h: 340 },
  { name: 'Red',     h: 0   }, { name: 'Orange', h: 30  }, { name: 'Amber',  h: 45  },
  { name: 'Green',   h: 140 }, { name: 'Lime',   h: 90  }, { name: 'Cyan',   h: 190 },
];

function hsl(h, s, l) { return `hsl(${h}, ${s}%, ${l}%)`; }

/**
 * Generate a random theme color scheme from a seed.
 * Returns { accent, taskbarBg, winBg, winBorder, text } matching the app's THEMES format.
 */
export function generateTheme(seed) {
  const r = rng(seed);
  const huePick = THEME_HUES[Math.floor(r() * THEME_HUES.length)];
  const isDark = r() > 0.3; // 70% chance dark
  const h = huePick.h + Math.round(span(r, -15, 15));
  const sat = Math.round(span(r, 55, 80));
  if (isDark) {
    const lightness = Math.round(span(r, 45, 62));
    return {
      id: `gen-theme-${(seed >>> 0).toString(36)}`,
      label: `${huePick.name} Dark`,
      accent: hsl(h, sat, lightness),
      taskbarBg: `rgba(${Math.round(span(r, 15, 35))},${Math.round(span(r, 15, 35))},${Math.round(span(r, 18, 40))},0.85)`,
      winBg: hsl(h, Math.round(sat * 0.3), Math.round(span(r, 10, 16))),
      winBorder: hsl(h, Math.round(sat * 0.4), Math.round(span(r, 20, 28))),
      text: '#e0e0e0',
      mode: 'dark',
    };
  } else {
    const lightness = Math.round(span(r, 45, 58));
    return {
      id: `gen-theme-${(seed >>> 0).toString(36)}`,
      label: `${huePick.name} Light`,
      accent: hsl(h, sat, lightness),
      taskbarBg: `rgba(255,255,255,0.78)`,
      winBg: '#f3f3f3',
      winBorder: '#e5e5e5',
      text: '#1b1b1b',
      mode: 'light',
    };
  }
}

export function generateThemeBatch(count, existingIds = []) {
  const taken = new Set(existingIds);
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 20) {
    guard++;
    const t = generateTheme(randomSeed());
    if (taken.has(t.id)) continue;
    taken.add(t.id);
    out.push(t);
  }
  return out;
}

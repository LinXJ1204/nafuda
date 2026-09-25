// Generated slab picture: a PSA-Sim style label (cert, card, grade) above an original card face
// whose colors come from a hash of the cert. No real card art is used anywhere. All text goes
// in through textContent.

import { svg } from './dom.ts'

/// Deterministic colors per cert (FNV-1a over the cert string).
export function paletteOf(cert: string): { hue: number; hue2: number } {
  let h = 0x811c9dc5
  for (const c of cert) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0
  const hue = h % 360
  return { hue, hue2: (hue + 40 + ((h >>> 9) % 80)) % 360 }
}

/// "GEM MT 10" → { words: "GEM MT", number: "10" }; anything else keeps the whole text as words.
export function splitGrade(grade: string): { words: string; number: string } {
  const m = /^(.*?)\s*(\d+(?:\.\d)?)$/.exec(grade.trim())
  return m ? { words: m[1], number: m[2] } : { words: grade.trim(), number: '' }
}

/// "Nafuda Dragon - Holo #001 (demo card)" → { name: "Nafuda Dragon", detail: "Holo #001" }
export function splitCard(card: string): { name: string; detail: string } {
  const plain = card.replace(/\s*\(demo card\)\s*$/i, '').trim()
  const [name, ...rest] = plain.split(/\s+-\s+/)
  return { name: name || plain, detail: rest.join(' - ') }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

let uid = 0

export function slabArt(opts: { cert: string; card: string; grade: string; size?: 'large' | 'small' }): SVGElement {
  const { cert } = opts
  const id = `slab${++uid}`
  const { hue, hue2 } = paletteOf(cert)
  const grade = splitGrade(opts.grade)
  const card = splitCard(opts.card)
  const text = (content: string, attrs: Record<string, string | number>) => svg('text', attrs, content)

  const defs = svg(
    'defs',
    {},
    svg(
      'linearGradient',
      { id: `${id}-frame`, x1: 0, y1: 0, x2: 1, y2: 1 },
      svg('stop', { offset: '0', 'stop-color': `hsl(${hue} 55% 42%)` }),
      svg('stop', { offset: '1', 'stop-color': `hsl(${hue2} 60% 30%)` }),
    ),
    svg(
      'linearGradient',
      { id: `${id}-sky`, x1: 0, y1: 0, x2: 0, y2: 1 },
      svg('stop', { offset: '0', 'stop-color': `hsl(${hue2} 70% 82%)` }),
      svg('stop', { offset: '1', 'stop-color': `hsl(${hue} 60% 62%)` }),
    ),
    svg(
      'linearGradient',
      { id: `${id}-sheen`, x1: 0, y1: 0, x2: 1, y2: 1 },
      svg('stop', { offset: '0.35', 'stop-color': '#fff', 'stop-opacity': 0 }),
      svg('stop', { offset: '0.5', 'stop-color': '#fff', 'stop-opacity': 0.28 }),
      svg('stop', { offset: '0.62', 'stop-color': '#fff', 'stop-opacity': 0 }),
    ),
    // 青海波 (seigaiha) waves
    svg(
      'pattern',
      { id: `${id}-waves`, width: 24, height: 12, patternUnits: 'userSpaceOnUse' },
      ...[0, 24, 12].flatMap((cx, i) =>
        [12, 8, 4].map((r) =>
          svg('circle', {
            cx,
            cy: i < 2 ? 12 : 18,
            r,
            fill: 'none',
            stroke: `hsl(${hue} 50% 96%)`,
            'stroke-opacity': 0.55,
            'stroke-width': 1.2,
          }),
        ),
      ),
    ),
  )

  const slab = svg('rect', { x: 2, y: 2, width: 296, height: 476, rx: 16, fill: 'hsl(210 16% 88%)', stroke: 'hsl(210 10% 62%)', 'stroke-width': 2 })
  const well = svg('rect', { x: 14, y: 108, width: 272, height: 322, rx: 8, fill: 'hsl(210 14% 80%)' })

  const label = svg(
    'g',
    {},
    svg('rect', { x: 14, y: 14, width: 272, height: 84, rx: 6, fill: '#fbf8f1', stroke: '#c8352b', 'stroke-width': 3 }),
    text('PSA-SIM', { x: 26, y: 34, 'font-size': 11, 'font-weight': 800, fill: '#c8352b', 'letter-spacing': 1.5, 'font-family': 'system-ui, sans-serif' }),
    text(clip(card.name.toUpperCase(), 22), { x: 26, y: 54, 'font-size': 13, 'font-weight': 700, fill: '#1d1b19', 'font-family': 'system-ui, sans-serif' }),
    text(clip(card.detail.toUpperCase(), 26), { x: 26, y: 70, 'font-size': 10, fill: '#4a453e', 'font-family': 'system-ui, sans-serif' }),
    text(`CERT #${cert}`, { x: 26, y: 88, 'font-size': 10, fill: '#1d1b19', 'font-family': 'ui-monospace, Menlo, monospace' }),
    text(clip(grade.words, 10), { x: 274, y: 40, 'font-size': 11, 'font-weight': 700, fill: '#1d1b19', 'text-anchor': 'end', 'font-family': 'system-ui, sans-serif' }),
    text(grade.number, { x: 274, y: 84, 'font-size': 38, 'font-weight': 800, fill: '#1d1b19', 'text-anchor': 'end', 'font-family': 'system-ui, sans-serif' }),
  )

  const face = svg(
    'g',
    {},
    svg('rect', { x: 42, y: 118, width: 216, height: 302, rx: 10, fill: `url(#${id}-frame)` }),
    svg('rect', { x: 52, y: 128, width: 196, height: 24, rx: 4, fill: 'rgba(255,255,255,0.88)' }),
    text(clip(card.name, 24), { x: 60, y: 145, 'font-size': 13, 'font-weight': 700, fill: '#1d1b19', 'font-family': 'system-ui, sans-serif' }),
    svg('rect', { x: 52, y: 158, width: 196, height: 170, rx: 4, fill: `url(#${id}-sky)` }),
    svg('rect', { x: 52, y: 158, width: 196, height: 170, rx: 4, fill: `url(#${id}-waves)` }),
    svg('circle', { cx: 150, cy: 236, r: 46, fill: `hsl(${hue} 70% 96%)`, 'fill-opacity': 0.9 }),
    text(card.name.charAt(0).toUpperCase(), {
      x: 150,
      y: 252,
      'font-size': 46,
      'font-weight': 700,
      fill: `hsl(${hue} 55% 38%)`,
      'text-anchor': 'middle',
      'font-family': '"Hiragino Mincho ProN", "Noto Serif JP", serif',
    }),
    svg('rect', { x: 52, y: 336, width: 196, height: 58, rx: 4, fill: 'rgba(255,255,255,0.82)' }),
    text(clip(card.detail || 'Demo card', 28), { x: 60, y: 356, 'font-size': 11, fill: '#1d1b19', 'font-family': 'system-ui, sans-serif' }),
    text('Original placeholder card · not a real product', { x: 60, y: 374, 'font-size': 8.5, fill: '#4a453e', 'font-family': 'system-ui, sans-serif' }),
    text('DEMO', { x: 238, y: 410, 'font-size': 9, 'font-weight': 800, fill: 'rgba(255,255,255,0.8)', 'text-anchor': 'end', 'letter-spacing': 2, 'font-family': 'system-ui, sans-serif' }),
  )

  const chip = svg(
    'g',
    {},
    svg('rect', { x: 92, y: 440, width: 22, height: 16, rx: 3, fill: '#c9a54a', stroke: '#8a6d24', 'stroke-width': 1 }),
    svg('path', { d: 'M97 448h12M103 443v10', stroke: '#8a6d24', 'stroke-width': 1 }),
    text('CHIP SEALED · SIM', { x: 120, y: 452, 'font-size': 9, 'font-weight': 700, fill: 'hsl(210 10% 38%)', 'letter-spacing': 0.8, 'font-family': 'system-ui, sans-serif' }),
  )

  const sheen = svg('rect', { x: 2, y: 2, width: 296, height: 476, rx: 16, fill: `url(#${id}-sheen)`, 'pointer-events': 'none' })

  const root = svg('svg', { viewBox: '0 0 300 480', class: `slab-art ${opts.size ?? 'large'}`, role: 'img' }, defs, slab, well, label, face, chip, sheen)
  root.setAttribute('aria-label', `Slab for cert ${cert}: ${opts.card}, ${opts.grade}`)
  return root
}

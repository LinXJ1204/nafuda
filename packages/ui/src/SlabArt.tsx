// Generated slab picture: a grader-styled label above an original card face whose colors come
// from a hash of grader + cert. No real card art or real grader branding is used. React escapes
// all text.

import { useId } from 'react'
import { graderByLabel } from '@nafuda/core/deployment.ts'
import { paletteOf, splitCard, splitGrade } from '@nafuda/core/slab.ts'

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

type Props = {
  grader: string
  cert: string
  card: string
  grade: string
  attributes?: Record<string, string>
  className?: string
  /// highlight the chip (used by the tap animation)
  chipGlow?: boolean
}

export function SlabArt({ grader, cert, card, grade, attributes = {}, className = '', chipGlow = false }: Props) {
  const id = useId().replace(/:/g, '')
  const g = graderByLabel(grader)
  const color = g?.color ?? '#c8352b'
  const short = (g?.short ?? grader).toUpperCase()
  const { hue, hue2 } = paletteOf(`${grader}:${cert}`)
  const gr = splitGrade(grade)
  const c = splitCard(card)
  const subgrades = Object.entries(attributes).filter(([k]) => k.startsWith('subgrade.'))
  const isBgs = grader === 'bgs-sim'
  const labelFill = isBgs ? '#f4f1ea' : '#fbf8f1'
  const sans = 'system-ui, sans-serif'

  return (
    <svg viewBox="0 0 300 480" className={`block h-auto w-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.18)] ${className}`} role="img" aria-label={`${short} slab, cert ${cert}: ${card}, ${grade}`}>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 55% 42%)`} />
          <stop offset="1" stopColor={`hsl(${hue2} 60% 30%)`} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue2} 70% 82%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 60% 62%)`} />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {isBgs && (
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#b8913a" />
            <stop offset="0.5" stopColor="#f0d78a" />
            <stop offset="1" stopColor="#b8913a" />
          </linearGradient>
        )}
        <pattern id={`${id}w`} width="24" height="12" patternUnits="userSpaceOnUse">
          {[0, 24, 12].flatMap((cx, i) =>
            [12, 8, 4].map((r) => (
              <circle key={`${cx}-${r}`} cx={cx} cy={i < 2 ? 12 : 18} r={r} fill="none" stroke={`hsl(${hue} 50% 96%)`} strokeOpacity="0.55" strokeWidth="1.2" />
            )),
          )}
        </pattern>
      </defs>

      {/* case */}
      <rect x="2" y="2" width="296" height="476" rx="16" fill="hsl(210 16% 88%)" stroke="hsl(210 10% 62%)" strokeWidth="2" />
      <rect x="14" y="108" width="272" height="322" rx="8" fill="hsl(210 14% 80%)" />

      {/* label */}
      <rect x="14" y="14" width="272" height="84" rx="6" fill={labelFill} stroke={isBgs ? `url(#${id}g)` : color} strokeWidth="3" />
      <text x="26" y="33" fontSize="11" fontWeight="800" fill={color} letterSpacing="1.5" fontFamily={sans}>
        {short}
      </text>
      <text x="26" y="52" fontSize="13" fontWeight="700" fill="#1d1b19" fontFamily={sans}>
        {clip(c.name.toUpperCase(), isBgs ? 13 : 22)}
      </text>
      <text x="26" y="67" fontSize="10" fill="#4a453e" fontFamily={sans}>
        {clip(c.detail.toUpperCase(), 26)}
      </text>
      <text x="26" y="87" fontSize="10" fill="#1d1b19" fontFamily="ui-monospace, Menlo, monospace">
        {`CERT #${cert}`}
      </text>
      {isBgs && subgrades.length > 0 ? (
        <g fontFamily={sans} fill="#1d1b19">
          {subgrades.slice(0, 4).map(([k, v], i) => (
            <text key={k} x={158} y={33 + i * 13} fontSize="9">
              <tspan fontWeight="700">{k.replace('subgrade.', '').slice(0, 4).toUpperCase()}</tspan> {v}
            </text>
          ))}
        </g>
      ) : (
        <text x="274" y="38" fontSize="11" fontWeight="700" fill="#1d1b19" textAnchor="end" fontFamily={sans}>
          {clip(gr.words, 12)}
        </text>
      )}
      <text x="274" y="84" fontSize="36" fontWeight="800" fill="#1d1b19" textAnchor="end" fontFamily={sans}>
        {gr.number}
      </text>

      {/* card face */}
      <rect x="42" y="118" width="216" height="302" rx="10" fill={`url(#${id}f)`} />
      <rect x="52" y="128" width="196" height="24" rx="4" fill="rgba(255,255,255,0.88)" />
      <text x="60" y="145" fontSize="13" fontWeight="700" fill="#1d1b19" fontFamily={sans}>
        {clip(c.name, 24)}
      </text>
      <rect x="52" y="158" width="196" height="170" rx="4" fill={`url(#${id}s)`} />
      <rect x="52" y="158" width="196" height="170" rx="4" fill={`url(#${id}w)`} />
      <circle cx="150" cy="236" r="46" fill={`hsl(${hue} 70% 96%)`} fillOpacity="0.9" />
      <text x="150" y="252" fontSize="46" fontWeight="700" fill={`hsl(${hue} 55% 38%)`} textAnchor="middle" fontFamily='"Hiragino Mincho ProN", "Noto Serif JP", serif'>
        {c.name.charAt(0).toUpperCase()}
      </text>
      <rect x="52" y="336" width="196" height="58" rx="4" fill="rgba(255,255,255,0.82)" />
      <text x="60" y="356" fontSize="11" fill="#1d1b19" fontFamily={sans}>
        {clip(c.detail || 'Demo card', 28)}
      </text>
      <text x="60" y="374" fontSize="8.5" fill="#4a453e" fontFamily={sans}>
        Original placeholder card · not a real product
      </text>
      <text x="238" y="410" fontSize="9" fontWeight="800" fill="rgba(255,255,255,0.8)" textAnchor="end" letterSpacing="2" fontFamily={sans}>
        DEMO
      </text>

      {/* chip */}
      <g>
        {chipGlow && <circle className="tap-ring" cx="103" cy="448" r="14" fill="none" stroke={color} strokeWidth="2" />}
        <rect x="92" y="440" width="22" height="16" rx="3" fill="#c9a54a" stroke="#8a6d24" strokeWidth="1" />
        <path d="M97 448h12M103 443v10" stroke="#8a6d24" strokeWidth="1" />
        <text x="120" y="452" fontSize="9" fontWeight="700" fill="hsl(210 10% 38%)" letterSpacing="0.8" fontFamily={sans}>
          CHIP SEALED · SIM
        </text>
      </g>

      <rect x="2" y="2" width="296" height="476" rx="16" fill={`url(#${id}h)`} pointerEvents="none" />
    </svg>
  )
}

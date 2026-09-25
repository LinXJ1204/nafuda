// DOM helpers shared by the consumer and grader pages.
// Chain data only ever reaches the DOM through textContent or attributes, never innerHTML.

import type { Address } from 'viem'
import { DEMO_ACCOUNTS } from './config.ts'

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

export const scan = (kind: 'address' | 'tx' | 'block', v: string) => `https://sepolia.etherscan.io/${kind}/${v}`
export const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  Object.assign(node, props)
  node.append(...children)
  return node
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export function svg(tag: string, attrs: Record<string, string | number> = {}, ...children: (Node | string)[]): SVGElement {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  node.append(...children)
  return node
}

export function demoName(address: Address): string | undefined {
  return Object.entries(DEMO_ACCOUNTS).find(([, a]) => a.toLowerCase() === address.toLowerCase())?.[0]
}

export function accountLabel(address: Address | null): string {
  if (!address) return '—'
  const who = demoName(address)
  return who ? `${short(address)} (${who})` : short(address)
}

export const external = (href: string, text: string, className = '') =>
  el('a', { href, target: '_blank', rel: 'noreferrer', className, textContent: text })

export function addressLink(address: Address | null) {
  if (!address) return el('span', { textContent: '—' })
  return external(scan('address', address), accountLabel(address), 'mono')
}

export const txLink = (hash: string) => external(scan('tx', hash), short(hash), 'mono')

export function kv(rows: [string, Node | string][]) {
  const dl = el('dl', { className: 'kv' })
  for (const [k, v] of rows) dl.append(el('dt', { textContent: k }), el('dd', {}, v))
  return dl
}

export async function busy(button: HTMLButtonElement, fn: () => Promise<void>) {
  button.disabled = true
  try {
    await fn()
  } finally {
    button.disabled = false
  }
}

export const muted = (text: string) => el('p', { className: 'muted', textContent: text })
export const errorText = (text: string) => el('p', { className: 'error', textContent: text })

/// First line of an error message (viem errors are long and multi-line).
export const firstLine = (e: unknown) => (e instanceof Error ? e.message : String(e)).split('\n')[0]

export function formatTime(d: Date | null): string {
  return d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

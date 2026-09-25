// Formatting helpers.

import { collectorOf } from '@nafuda/core/deployment.ts'

export const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`
export const scan = (kind: 'address' | 'tx' | 'block', v: string) => `https://sepolia.etherscan.io/${kind}/${v}`
export const nameOf = (address: string | null | undefined) => collectorOf(address)?.name ?? null
export const who = (address: string | null | undefined) => (address ? (nameOf(address) ?? short(address)) : '—')

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

export const formatTime = (date: string | Date | null | undefined) =>
  date ? new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const jpy = (v: number | null | undefined) => (v == null ? '—' : `¥${Number(v).toLocaleString('en-US')}`)

export const compactJpy = (v: number) =>
  v >= 1_000_000 ? `¥${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `¥${Math.round(v / 1000)}k` : `¥${v}`

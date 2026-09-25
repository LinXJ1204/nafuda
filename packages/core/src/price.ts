// Declared sale price, carried in the `data` argument of ERC-1155 safeTransferFrom:
// "NFDP" (4 bytes) + uint256 price in JPY. The seller declares it; nobody verifies it.

import type { Hex } from 'viem'

export const PRICE_MAGIC = '0x4e464450'

export function encodePrice(jpy: number): Hex {
  if (!Number.isSafeInteger(jpy) || jpy < 0) throw new Error('price must be a whole number of yen')
  return `${PRICE_MAGIC}${BigInt(jpy).toString(16).padStart(64, '0')}` as Hex
}

export function decodePrice(data: string): number | null {
  if (!data.toLowerCase().startsWith(PRICE_MAGIC) || data.length !== 2 + 8 + 64) return null
  const v = BigInt(`0x${data.slice(10)}`)
  return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : null
}

export const formatJpy = (jpy: number) => `¥${jpy.toLocaleString('en-US')}`

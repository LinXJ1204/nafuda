// An EAC role bitmap drawn as it is stored: 32 role slots (one nybble each) for the base roles,
// and 32 for their admins, 128 bits higher. Lit slots are the roles held.

import { useState } from 'react'
import { ROLE } from '@nafuda/core/roles.ts'

/// bit position → role name (exact bigint arithmetic; roles go up to 1 << 124)
const NAMES: Record<number, string> = {}
for (const [k, v] of Object.entries(ROLE)) {
  if (typeof v !== 'bigint') continue
  let b = 0
  let x = v
  while (x > 1n) {
    x >>= 1n
    b++
  }
  NAMES[b] = k
}

function Row({ bitmap, offset, label }: { bitmap: bigint; offset: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-right text-[10px] font-semibold tracking-wide text-muted uppercase">{label}</span>
      <div className="grid flex-1 grid-cols-[repeat(32,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: 32 }, (_, i) => {
          const bit = offset + i * 4
          const on = (bitmap >> BigInt(bit)) & 1n
          const name = NAMES[bit - offset] ? `${NAMES[bit - offset]}${offset ? ' admin' : ''}` : `slot ${i}`
          return <span key={i} title={`${name} (bit ${bit})`} className={`aspect-square rounded-[3px] ${on ? 'bg-accent shadow-[0_0_6px_var(--accent)]' : 'bg-line'}`} />
        })}
      </div>
    </div>
  )
}

export function RoleBitmap({ items }: { items: { key: string; label: string; bitmap: bigint }[] }) {
  const [sel, setSel] = useState(items[0]?.key)
  const item = items.find((i) => i.key === sel) ?? items[0]
  if (!item) return null
  const held = [...Array(64).keys()]
    .map((i) => (i < 32 ? i * 4 : 128 + (i - 32) * 4))
    .filter((bit) => (item.bitmap >> BigInt(bit)) & 1n)
    .map((bit) => (bit >= 128 ? `${NAMES[bit - 128] ?? `bit ${bit}`} admin` : (NAMES[bit] ?? `bit ${bit}`)))
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <button
            key={i.key}
            onClick={() => setSel(i.key)}
            className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs ${i.key === item.key ? 'border-accent bg-accent/10 font-semibold text-accent' : 'border-line text-muted hover:text-ink'}`}
          >
            {i.label}
          </button>
        ))}
      </div>
      <div className="grid gap-1.5 rounded-xl bg-raised p-3">
        <Row bitmap={item.bitmap} offset={0} label="roles" />
        <Row bitmap={item.bitmap} offset={128} label="admins" />
      </div>
      <p className="mt-2 font-mono text-[11px] break-all text-faint">0x{item.bitmap.toString(16).padStart(64, '0')}</p>
      <p className="mt-1 text-sm">
        {held.length ? (
          <>
            Holds <strong>{held.length}</strong> role{held.length > 1 ? 's' : ''}: <span className="font-mono text-xs">{held.slice(0, 8).join(', ')}{held.length > 8 ? ', …' : ''}</span>
          </>
        ) : (
          <span className="text-muted">Holds no roles here.</span>
        )}
      </p>
    </div>
  )
}

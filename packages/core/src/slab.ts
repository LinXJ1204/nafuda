// Pure helpers for the generated slab picture (no DOM).

/// Deterministic colors per grader + cert (FNV-1a).
export function paletteOf(key: string): { hue: number; hue2: number } {
  let h = 0x811c9dc5
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0
  const hue = h % 360
  return { hue, hue2: (hue + 40 + ((h >>> 9) % 80)) % 360 }
}

/// "GEM MT 10" → { words: "GEM MT", number: "10" }
export function splitGrade(grade: string): { words: string; number: string } {
  const m = /^(.*?)\s*(\d+(?:\.\d)?)$/.exec(grade.trim())
  return m ? { words: m[1], number: m[2] } : { words: grade.trim(), number: '' }
}

/// Numeric score of a grade, for sorting and charts ("GEM MINT 9.5" → 9.5).
export const gradeScore = (grade: string) => Number(splitGrade(grade).number || 0)

/// "Nafuda Dragon - Holo #001 (demo card)" → { name: "Nafuda Dragon", detail: "Holo #001", rarity: "Holo" }
export function splitCard(card: string): { name: string; detail: string; rarity: string } {
  const plain = card.replace(/\s*\(demo card\)\s*$/i, '').trim()
  const [name, ...rest] = plain.split(/\s+-\s+/)
  const detail = rest.join(' - ')
  return { name: name || plain, detail, rarity: /^(\w+)/.exec(detail)?.[1] ?? '' }
}

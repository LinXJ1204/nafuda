// Card categories as ENS text records (docs/plan/upgrades.md, U1, light version). A grader whose
// controller supports extra records (v2) can classify a card at issuance with `card.*` keys,
// modeled on the fields PSA shows on a cert page. Game names are real and only classify: every
// card in the demo is fictional. Covered by categories.test.ts.

export const MAX_ATTRIBUTES = 8 // TitleControllerV2.MAX_ATTRIBUTES

export const GROUPS = {
  tcg: {
    label: 'Trading card games',
    key: 'card.game',
    options: { pokemon: 'Pokémon', yugioh: 'Yu-Gi-Oh!', 'one-piece': 'One Piece', mtg: 'Magic: The Gathering', 'duel-masters': 'Duel Masters' },
  },
  sports: {
    label: 'Sports',
    key: 'card.sport',
    options: { baseball: 'Baseball', basketball: 'Basketball', soccer: 'Soccer', football: 'Football' },
  },
  'non-sport': { label: 'Non-sport', key: null, options: {} },
} as const satisfies Record<string, { label: string; key: string | null; options: Record<string, string> }>

export type Group = keyof typeof GROUPS
export const LANGUAGES = { JPN: 'Japanese', ENG: 'English' } as const

/// Every `card.*` key the apps label, in display order. Any other `card.*` key is shown as is.
export const CARD_FIELDS: [string, string][] = [
  ['card.category', 'Category'],
  ['card.game', 'Game'],
  ['card.sport', 'Sport'],
  ['card.year', 'Year'],
  ['card.brand', 'Brand'],
  ['card.number', 'Number'],
  ['card.subject', 'Subject'],
  ['card.variety', 'Variety'],
  ['card.language', 'Language'],
]

const options = (g: Group): Record<string, string> => GROUPS[g].options

/// The label a title is filed under: the game or sport when there is one, else the group.
export function classify(attributes: Record<string, string>): { group: Group; kind: string | null; label: string } | null {
  const group = attributes['card.category'] as Group | undefined
  if (!group || !(group in GROUPS)) return null
  const key = GROUPS[group].key
  const kind = key ? (attributes[key] ?? null) : null
  return { group, kind, label: (kind && options(group)[kind]) || kind || GROUPS[group].label }
}

/// Human-readable card fields, for a details list.
export function cardFields(attributes: Record<string, string>): [string, string][] {
  const known = new Map(CARD_FIELDS)
  const value = (k: string, v: string) => {
    if (k === 'card.category') return GROUPS[v as Group]?.label ?? v
    if (k === 'card.game') return options('tcg')[v] ?? v
    if (k === 'card.sport') return options('sports')[v] ?? v
    if (k === 'card.language') return LANGUAGES[v as keyof typeof LANGUAGES] ?? v
    return v
  }
  const entries = Object.entries(attributes).filter(([k]) => k.startsWith('card.'))
  const order = (k: string) => {
    const i = CARD_FIELDS.findIndex(([f]) => f === k)
    return i < 0 ? CARD_FIELDS.length : i
  }
  return entries.sort(([a], [b]) => order(a) - order(b)).map(([k, v]) => [known.get(k) ?? k, value(k, v)])
}

export type CategoryForm = { group: Group | ''; kind: string; year: string; language: string }
export const NO_CATEGORY: CategoryForm = { group: '', kind: '', year: '', language: '' }

/// The text records a category form becomes (empty fields are left out).
export function categoryAttributes(form: CategoryForm): Record<string, string> {
  if (!form.group) return {}
  const out: Record<string, string> = { 'card.category': form.group }
  const key = GROUPS[form.group].key
  if (key && form.kind) out[key] = form.kind
  if (form.year) out['card.year'] = form.year
  if (form.language) out['card.language'] = form.language
  return out
}

/// Why a category form cannot be issued, or null. `thisYear` is passed in (pure).
export function checkCategory(form: CategoryForm, thisYear: number): string | null {
  if (!form.group) return form.kind || form.year || form.language ? 'Pick a category first.' : null
  if (!(form.group in GROUPS)) return 'Unknown category.'
  const key = GROUPS[form.group].key
  if (key && !form.kind) return `Pick the ${key === 'card.game' ? 'game' : 'sport'}.`
  if (form.kind && !(form.kind in options(form.group))) return `Unknown ${key === 'card.game' ? 'game' : 'sport'}: ${form.kind}.`
  if (form.year && (!/^\d{4}$/.test(form.year) || Number(form.year) < 1900 || Number(form.year) > thisYear)) return `The year is four digits, 1900–${thisYear}.`
  if (form.language && !(form.language in LANGUAGES)) return 'Unknown language.'
  return null
}

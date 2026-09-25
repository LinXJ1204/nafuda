// Title tiles for Explore and the holder view. Built from the event index only: no per-title
// ENS resolution here, so a public RPC is not hammered. The title page resolves through ENS.

import { accountLabel, el } from '../lib/dom.ts'
import type { IndexedTitle } from '../lib/events.ts'
import { titleHash } from '../lib/routes.ts'
import { slabArt, splitCard } from '../lib/slab-art.ts'

export function titleGrid(titles: IndexedTitle[]): HTMLElement {
  return el(
    'div',
    { className: 'gallery' },
    ...titles.map((t) => {
      const card = splitCard(t.card)
      const transfers = t.history.length - 1
      return el(
        'a',
        { className: 'tile', href: titleHash(t.cert) },
        el('div', { className: 'tile-art' }, slabArt({ cert: t.cert, card: t.card, grade: t.grade, size: 'small' })),
        el(
          'div',
          { className: 'tile-body' },
          el('strong', { textContent: card.name }),
          el('span', { className: 'tile-sub', textContent: [card.detail, t.grade].filter(Boolean).join(' · ') }),
          el('span', { className: 'mono tile-cert', textContent: `#${t.cert}` }),
          el(
            'span',
            { className: 'tile-foot' },
            el('span', { textContent: `Held by ${accountLabel(t.holder)}` }),
            el('span', { textContent: transfers ? `${transfers} transfer${transfers > 1 ? 's' : ''}` : 'Never transferred' }),
          ),
        ),
      )
    }),
  )
}

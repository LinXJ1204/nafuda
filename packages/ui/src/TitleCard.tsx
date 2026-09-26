import { classify } from '@nafuda/core/categories.ts'
import { splitCard } from '@nafuda/core/slab.ts'
import { useOpenAsks, type Title } from './api.ts'
import { AppLink, Avatar, GraderBadge, Skeleton, useLinks } from './components.tsx'
import { jpy, who } from './format.ts'
import { SlabArt } from './SlabArt.tsx'

export function TitleCard({ t }: { t: Title }) {
  const links = useLinks()
  const asks = useOpenAsks()
  const ask = asks.data?.find((o) => o.grader === t.grader && o.cert === t.cert)
  const c = splitCard(t.card)
  const cls = classify(t.attributes)
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
      <AppLink to={links.title(t.grader, t.cert)} className="block bg-raised px-6 pt-5 pb-3 no-underline">
        <SlabArt grader={t.grader} cert={t.cert} card={t.card} grade={t.grade} attributes={t.attributes} />
      </AppLink>
      {ask && <span className="absolute top-2 right-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent shadow">Asking {jpy(ask.priceJpy)}</span>}
      <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <AppLink to={links.title(t.grader, t.cert)} className="truncate font-bold no-underline hover:text-accent">
            {c.name}
          </AppLink>
          <GraderBadge label={t.grader} />
        </div>
        <div className="text-[13px] text-muted">
          {c.detail} · {t.grade}
        </div>
        {cls && (
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full border border-line bg-raised px-2 py-0.5 text-[11px] font-semibold" title="card.* ENS text records, set by the grader at issuance">
              {cls.label}
              {t.attributes['card.language'] ? ` · ${t.attributes['card.language']}` : ''}
              {t.attributes['card.year'] ? ` · ${t.attributes['card.year']}` : ''}
            </span>
          </div>
        )}
        <div className="font-mono text-[12px] text-faint">#{t.cert}</div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Avatar address={t.holder} size={16} /> {who(t.holder)}
          </span>
          <span>{t.lastPriceJpy ? `last ${jpy(t.lastPriceJpy)}` : t.transferCount ? `${t.transferCount} transfers` : 'never traded'}</span>
        </div>
      </div>
    </div>
  )
}

export function TitleGrid({ items, loading }: { items?: Title[]; loading?: boolean }) {
  if (loading && !items)
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/5]" />
        ))}
      </div>
    )
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items?.map((t) => (
        <TitleCard key={`${t.grader}:${t.cert}`} t={t} />
      ))}
    </div>
  )
}

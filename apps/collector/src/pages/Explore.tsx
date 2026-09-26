import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { GRADERS } from '@nafuda/core/deployment.ts'
import { useCategories, useTitles } from '@nafuda/ui/api.ts'
import { GROUPS, type Group } from '@nafuda/core/categories.ts'
import { Button, Empty } from '@nafuda/ui/components.tsx'
import { TitleGrid } from '@nafuda/ui/TitleCard.tsx'

const SORTS = [
  ['recent', 'Recently active'],
  ['newest', 'Newest issued'],
  ['traded', 'Most traded'],
  ['grade', 'Highest grade'],
  ['price', 'Highest last price'],
] as const

export function ExplorePage() {
  const [params, setParams] = useSearchParams()
  const grader = params.get('grader') ?? ''
  const sort = params.get('sort') ?? 'recent'
  const minGrade = params.get('minGrade') ?? ''
  const q = params.get('q') ?? ''
  const forTrade = params.get('forTrade') ?? ''
  const category = params.get('category') ?? ''
  const [limit, setLimit] = useState(40)
  const titles = useTitles({ grader, sort, minGrade: minGrade ? Number(minGrade) : undefined, q, limit, forTrade: forTrade ? 1 : undefined, category })
  const categories = useCategories()
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Explore titles</h1>
          <p className="mt-1 text-sm text-muted">{titles.data ? `${titles.data.total} titles` : 'Loading…'} · live from chain events</p>
        </div>
        <input
          value={q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="Search cert, card or address"
          className="w-full max-w-sm rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={grader === '' ? 'primary' : 'secondary'} onClick={() => set('grader', '')}>
          All graders
        </Button>
        {GRADERS.map((g) => (
          <Button key={g.label} size="sm" variant={grader === g.label ? 'primary' : 'secondary'} onClick={() => set('grader', g.label)}>
            <span className="size-2 rounded-full" style={{ background: g.color }} />
            {g.short}
          </Button>
        ))}
        <span className="mx-2 hidden h-5 w-px bg-line sm:block" />
        <Button size="sm" variant={forTrade ? 'primary' : 'secondary'} onClick={() => set('forTrade', forTrade ? '' : '1')}>
          For trade only
        </Button>
        <select value={minGrade} onChange={(e) => set('minGrade', e.target.value)} className="rounded-xl border border-line bg-card px-2.5 py-1.5 text-sm">
          <option value="">Any grade</option>
          <option value="10">10 only</option>
          <option value="9.5">9.5 and up</option>
          <option value="9">9 and up</option>
          <option value="8">8 and up</option>
        </select>
        <select value={sort} onChange={(e) => set('sort', e.target.value)} className="rounded-xl border border-line bg-card px-2.5 py-1.5 text-sm">
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {!!categories.data?.items.length && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted" title="card.* ENS text records. Only graders on controller v2 can record a category, and only at issuance">
            Category
          </span>
          <Button size="sm" variant={category === '' ? 'primary' : 'secondary'} onClick={() => set('category', '')}>
            All
          </Button>
          {categories.data.items.map((c) => {
            const value = c.kind ?? c.category
            const group = GROUPS[c.category as Group]
            const label = (c.kind && (group?.options as Record<string, string> | undefined)?.[c.kind]) || c.kind || group?.label || c.category
            return (
              <Button key={value} size="sm" variant={category === value ? 'primary' : 'secondary'} onClick={() => set('category', category === value ? '' : value)}>
                {label} <span className="text-faint">{c.n}</span>
              </Button>
            )
          })}
          <span className="text-xs text-faint">{categories.data.unclassified} titles issued without a category</span>
        </div>
      )}
      <div className="mt-6">
        {titles.data && titles.data.items.length === 0 ? <Empty>No titles match.</Empty> : <TitleGrid items={titles.data?.items} loading={titles.isLoading} />}
      </div>
      {titles.data && titles.data.total > titles.data.items.length && (
        <div className="mt-6 text-center">
          <Button onClick={() => setLimit((l) => l + 40)}>Load more</Button>
        </div>
      )}
    </>
  )
}

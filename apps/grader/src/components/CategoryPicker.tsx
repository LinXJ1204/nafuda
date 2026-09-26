// Optional card category for the Issue page: stored as `card.*` ENS text records, so only a
// controller with extra records (v2) can take it.

import { GROUPS, LANGUAGES, NO_CATEGORY, type CategoryForm, type Group } from '@nafuda/core/categories.ts'
import type { Grader } from '@nafuda/core/deployment.ts'
import { Button } from '@nafuda/ui/components.tsx'

const select = 'rounded-lg border border-line bg-card px-2 py-1.5 text-sm'

export function CategoryPicker({ grader, value, onChange, problem }: { grader: Grader; value: CategoryForm; onChange: (v: CategoryForm) => void; problem: string | null }) {
  if (grader.controllerVersion !== 2)
    return (
      <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
        Card category: {grader.short}&apos;s controller (v1) has no extra records. Graders on controller v2, like BGS-Sim, can file each title under a game or sport as ENS
        text records (<span className="font-mono">card.category</span>, <span className="font-mono">card.game</span> …).
      </p>
    )
  const group = value.group ? GROUPS[value.group] : null
  const set = (patch: Partial<CategoryForm>) => onChange({ ...value, ...patch })
  return (
    <>
      <label className="mt-4 block text-sm text-muted">
        Card category <span className="text-faint">(optional; ENS text records <span className="font-mono">card.*</span>, fixed at issuance)</span>
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button size="sm" variant={!value.group ? 'primary' : 'secondary'} onClick={() => onChange(NO_CATEGORY)}>
          None
        </Button>
        {(Object.keys(GROUPS) as Group[]).map((g) => (
          <Button key={g} size="sm" variant={value.group === g ? 'primary' : 'secondary'} onClick={() => set({ group: g, kind: '' })}>
            {GROUPS[g].label}
          </Button>
        ))}
      </div>
      {group && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {group.key && (
            <select aria-label={group.key === 'card.game' ? 'Game' : 'Sport'} value={value.kind} onChange={(e) => set({ kind: e.target.value })} className={select}>
              <option value="">{group.key === 'card.game' ? 'Game…' : 'Sport…'}</option>
              {Object.entries(group.options).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <input aria-label="Year" value={value.year} onChange={(e) => set({ year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="Year (e.g. 2025)" className={select} />
          <select aria-label="Language" value={value.language} onChange={(e) => set({ language: e.target.value })} className={select}>
            <option value="">Language…</option>
            {Object.entries(LANGUAGES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      {problem && <p className="mt-2 text-xs text-bad">{problem}</p>}
    </>
  )
}

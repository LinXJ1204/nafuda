// How ENSv2 resolves this title, level by level, read live: the registry at each label, where the
// Universal Resolver finds a resolver (the grader's controller, as an ENSIP-10 wildcard for every
// cert), and what that resolver answers.

import { useQuery } from '@tanstack/react-query'
import { UNIVERSAL_RESOLVER } from '@nafuda/core/deployment.ts'
import { AddressLink, Card, Skeleton } from '@nafuda/ui/components.tsx'
import { resolutionPath, type ResolvedTitle } from '@nafuda/ui/ens.ts'
import { short } from '@nafuda/ui/format.ts'

export function ResolutionPath({ grader, cert, title }: { grader: string; cert: string; title: ResolvedTitle }) {
  const path = useQuery({ queryKey: ['path', grader, cert], queryFn: () => resolutionPath(grader, cert), staleTime: 300_000 })
  const steps = path.data ? [...path.data].reverse() : null // root first
  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-xl font-bold">How ENS resolves this name</h2>
      <p className="mt-1 text-sm text-muted">
        Read live from the ENSv2 registries. The Universal Resolver ({short(UNIVERSAL_RESOLVER)}) walks down the tree and asks the nearest resolver.
      </p>
      {!steps ? (
        <Skeleton className="mt-4 h-72" />
      ) : (
        <ol className="mt-5 grid gap-0">
          {steps.map((s, i) => {
            const isTitle = i === steps.length - 1
            return (
              <li key={s.name} className="grid grid-cols-[32px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className={`mt-1 grid size-7 place-items-center rounded-full border-2 text-[11px] font-bold ${s.answers ? 'border-accent bg-accent text-on-accent' : isTitle ? 'border-accent text-accent' : 'border-line text-muted'}`}>
                    {i}
                  </span>
                  {!isTitle && <span className={`w-0.5 flex-1 ${s.answers || steps[i + 1]?.answers ? 'bg-accent' : 'bg-line'}`} style={{ minHeight: 18 }} />}
                </div>
                <div className={`mb-3 rounded-xl border px-3 py-2 ${s.answers ? 'border-accent bg-accent/5' : 'border-line'}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{s.name}</span>
                    <span className="text-[11px] text-muted">{s.label === '' ? 'RootRegistry' : isTitle ? 'the title (ERC-1155 token)' : 'registry'}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                    {s.registry ? (
                      <span>
                        registry <AddressLink address={s.registry} />
                      </span>
                    ) : (
                      isTitle && <span>no subregistry, no resolver of its own</span>
                    )}
                    {s.resolver && (
                      <span>
                        resolver <AddressLink address={s.resolver} />
                      </span>
                    )}
                  </div>
                  {s.answers && (
                    <div className="mt-2 rounded-lg bg-card px-2.5 py-1.5 text-xs">
                      <strong className="text-accent">Resolver found here.</strong> The grader's TitleController answers for every{' '}
                      <span className="font-mono">{'<cert>'}</span> below it (ENSIP-10 wildcard) and computes records from on-chain state, so they can never go
                      stale.
                    </div>
                  )}
                  {isTitle && (
                    <div className="mt-2 grid gap-1 rounded-lg bg-card px-2.5 py-2 font-mono text-[11px]">
                      <span>
                        addr() → <span className="text-accent">{title.holder ?? '0x0'}</span>
                      </span>
                      <span>
                        text("slab.chip") → <span className="text-accent">{title.chip ?? '""'}</span>
                      </span>
                      <span>
                        text("title.status") → <span className="text-accent">{title.status}</span>
                      </span>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

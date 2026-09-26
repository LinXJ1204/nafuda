import { Card, AddressLink, Pill, Skeleton } from '@nafuda/ui/components.tsx'
import { decodeRoles } from '@nafuda/core/roles.ts'
import { useGraderTrust } from '@nafuda/ui/trust.ts'
import { TrustList } from '@nafuda/ui/TrustList.tsx'
import { NAFUDA_REGISTRY } from '@nafuda/core/deployment.ts'
import { useConsole } from '../console.tsx'
import { AccessMap } from '../components/AccessMap.tsx'

const roles = (b: bigint) => decodeRoles(b).join(', ') || 'none'

export function TrustPage() {
  const { grader } = useConsole()
  const trust = useGraderTrust(grader.label)
  const d = trust.data
  const locked = d?.checks.filter((c) => c.group === 'lock').every((c) => c.ok)
  return (
    <>
      <h1 className="mt-8 text-3xl font-bold">What {grader.short} can and cannot do</h1>
      <p className="mt-1 text-sm text-muted">Every line is read from Sepolia when this page loads. Nothing here is a claim you have to take on trust.</p>
      <div className="mt-6">
        <AccessMap />
      </div>
      {!d ? (
        <Skeleton className="mt-6 h-96" />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-bold">Issued titles are out of the grader's hands</h2>
            <TrustList checks={d.checks.filter((c) => c.group === 'titles')} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              Final lock <Pill tone={locked ? 'ok' : 'warn'}>{locked ? 'Applied' : 'Not applied yet'}</Pill>
            </h2>
            <p className="mb-4 text-sm text-muted">
              {locked
                ? 'The one-way lock has been applied: the whole path from .eth to every title is fixed. New graders can still be added.'
                : 'Until the one-way lock (scripts/src/lock.ts) runs, the operator could still swap a grader subtree. It is irreversible, so it runs once the demo deployment is final.'}
            </p>
            <TrustList checks={d.checks.filter((c) => c.group === 'lock')} />
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h2 className="mb-3 text-lg font-bold">Raw on-chain data</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-[max-content_1fr]">
              <dt className="text-muted">Grader</dt>
              <dd>
                <AddressLink address={grader.grader} />
              </dd>
              <dt className="text-muted">Grader roles on its title registry</dt>
              <dd className="font-mono text-xs">{roles(d.facts.graderRootRoles)}</dd>
              <dt className="text-muted">Title registry</dt>
              <dd>
                <AddressLink address={grader.registry} />
              </dd>
              <dt className="text-muted">Controller (v{grader.controllerVersion})</dt>
              <dd>
                <AddressLink address={grader.controller} />
              </dd>
              <dt className="text-muted">nafuda.eth registry</dt>
              <dd>
                <AddressLink address={NAFUDA_REGISTRY} />
              </dd>
              <dt className="text-muted">Operator (owner of nafuda.eth)</dt>
              <dd>
                <AddressLink address={d.operator} />
              </dd>
              <dt className="text-muted">Grader roles on {grader.label}</dt>
              <dd className="font-mono text-xs">{roles(d.facts.graderNameTokenRoles)}</dd>
              <dt className="text-muted">Operator roles on nafuda.eth</dt>
              <dd className="font-mono text-xs">{roles(d.facts.operatorRootNameRoles)}</dd>
              <dt className="text-muted">Holder roles ({d.facts.holderRoles.length} titles)</dt>
              <dd className="font-mono text-xs">{[...new Set(d.facts.holderRoles.map((h) => roles(h.roles)))].join(' / ') || '—'}</dd>
            </dl>
          </Card>
        </div>
      )}
    </>
  )
}

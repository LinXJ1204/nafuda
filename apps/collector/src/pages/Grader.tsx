import { useParams } from 'react-router'
import { graderByLabel } from '@nafuda/core/deployment.ts'
import { useActivity, useGrader, useTitles } from '@nafuda/ui/api.ts'
import { ActivityFeed } from '@nafuda/ui/ActivityFeed.tsx'
import { AddressLink, Card, Section, Skeleton, Stat } from '@nafuda/ui/components.tsx'
import { TitleGrid } from '@nafuda/ui/TitleCard.tsx'
import { useGraderTrust } from '@nafuda/ui/trust.ts'
import { TrustList } from '@nafuda/ui/TrustList.tsx'
import { GradeChart } from '@nafuda/ui/Charts.tsx'
import { NotFound } from './NotFound.tsx'

export function GraderPage() {
  const { label = '' } = useParams()
  const g = graderByLabel(label)
  const detail = useGrader(label)
  const titles = useTitles({ grader: label, sort: 'recent', limit: 20 })
  const activity = useActivity({ grader: label, limit: 10 })
  const trust = useGraderTrust(label)
  if (!g) return <NotFound />

  return (
    <>
      <div className="mt-8 overflow-hidden rounded-3xl border border-line" style={{ background: `linear-gradient(120deg, ${g.color}22, transparent 60%)` }}>
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span className="size-4 rounded-full" style={{ background: g.color }} />
            <h1 className="text-3xl font-bold">{g.short}</h1>
          </div>
          <p className="mt-1 font-mono text-sm text-muted">{g.ensName}</p>
          <p className="mt-3 max-w-2xl text-sm text-muted">{g.name}. Grade scale: {g.scale.join(' · ')}.{g.subgrades.length ? ` Adds subgrades (${g.subgrades.join(', ')}) as ENS text records.` : ''}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
            <span>
              Registry <AddressLink address={g.registry} />
            </span>
            <span>
              Controller v{g.controllerVersion} <AddressLink address={g.controller} />
            </span>
            <span>
              Grader <AddressLink address={g.grader} />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Titles" value={detail.data?.titles ?? '…'} />
        <Stat label="Holders" value={detail.data?.holders ?? '…'} />
        <Stat label="Transfers" value={detail.data?.transfers ?? '…'} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-bold">Grade distribution</h2>
          {detail.data ? <GradeChart data={detail.data.grades} color={g.color} /> : <Skeleton className="h-56" />}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-bold">What {g.short} cannot do</h2>
          <p className="mb-3 text-xs text-muted">Read live from the registries when this page loads.</p>
          {trust.data ? <TrustList checks={trust.data.checks.filter((c) => c.group === 'titles')} /> : <Skeleton className="h-48" />}
        </Card>
      </div>

      <Section title="Titles">
        <TitleGrid items={titles.data?.items} loading={titles.isLoading} />
      </Section>
      <Section title="Recent activity">
        <ActivityFeed items={activity.data} loading={activity.isLoading} compact />
      </Section>
    </>
  )
}

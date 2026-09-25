import { Link } from 'react-router'
import { useActivity, useGrader, useTitles } from '@nafuda/ui/api.ts'
import { ActivityFeed } from '@nafuda/ui/ActivityFeed.tsx'
import { GradeChart } from '@nafuda/ui/Charts.tsx'
import { Button, Card, Section, Skeleton, Stat } from '@nafuda/ui/components.tsx'
import { useGraderTrust } from '@nafuda/ui/trust.ts'
import { useConsole } from '../console.tsx'
import { IssuedChart } from '../components/IssuedChart.tsx'

export function DashboardPage() {
  const { grader, canIssue } = useConsole()
  const detail = useGrader(grader.label)
  const titles = useTitles({ grader: grader.label, limit: 200 })
  const activity = useActivity({ grader: grader.label, limit: 12 })
  const trust = useGraderTrust(grader.label)
  const avg = titles.data?.items.length ? titles.data.items.reduce((s, t) => s + t.gradeScore, 0) / titles.data.items.length : null
  const trustOk = trust.data?.checks.filter((c) => c.group === 'titles').every((c) => c.ok)

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Everything {grader.short} has issued, from chain events.</p>
        </div>
        <Link to="/issue">
          <Button variant="primary" size="lg" disabled={!canIssue}>
            Issue a title
          </Button>
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Titles issued" value={detail.data?.titles ?? '…'} />
        <Stat label="Current holders" value={detail.data?.holders ?? '…'} />
        <Stat label="Resales" value={detail.data?.transfers ?? '…'} sub="transfers after issue" />
        <Stat label="Average grade" value={avg ? avg.toFixed(2) : '…'} />
        <Stat label="Trust checks" value={trust.data ? (trustOk ? '✓ all pass' : '✗ failing') : '…'} sub="read live" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-bold">Issued per hour</h2>
          {detail.data ? <IssuedChart data={detail.data.issuedPerHour} color={grader.color} /> : <Skeleton className="h-48" />}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-bold">Grade distribution</h2>
          {detail.data ? <GradeChart data={detail.data.grades} color={grader.color} /> : <Skeleton className="h-56" />}
        </Card>
      </div>
      <Section title="Recent activity on your titles" sub="Issuances, and resales between collectors after issue.">
        <ActivityFeed items={activity.data} loading={activity.isLoading} compact />
      </Section>
    </>
  )
}

import { useState } from 'react'
import { GRADERS } from '@nafuda/core/deployment.ts'
import { useActivity, useStats } from '@nafuda/ui/api.ts'
import { ActivityFeed } from '@nafuda/ui/ActivityFeed.tsx'
import { Button } from '@nafuda/ui/components.tsx'
import { ActivityChart } from '@nafuda/ui/Charts.tsx'
import { WitnessBanner } from '@nafuda/ui/Witness.tsx'

export function ActivityPage() {
  const [grader, setGrader] = useState('')
  const [type, setType] = useState('')
  const activity = useActivity({ grader, type, limit: 100 })
  const stats = useStats()
  return (
    <>
      <h1 className="mt-8 text-3xl font-bold">Activity</h1>
      <p className="mt-1 text-sm text-muted">Every issuance and every transfer, straight from chain events. Declared prices are what sellers wrote into the transfer; nobody verifies them.</p>
      <div className="mt-4">
        <WitnessBanner href="/developers#witness" />
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-card p-4">{stats.data && <ActivityChart data={stats.data.perHour} />}</div>
      <div className="mt-6 flex flex-wrap gap-2">
        {['', 'issue', 'transfer'].map((t) => (
          <Button key={t} size="sm" variant={type === t ? 'primary' : 'secondary'} onClick={() => setType(t)}>
            {t === '' ? 'All events' : t === 'issue' ? 'Issued' : 'Transfers'}
          </Button>
        ))}
        <span className="mx-1 w-px bg-line" />
        <Button size="sm" variant={grader === '' ? 'primary' : 'secondary'} onClick={() => setGrader('')}>
          All graders
        </Button>
        {GRADERS.map((g) => (
          <Button key={g.label} size="sm" variant={grader === g.label ? 'primary' : 'secondary'} onClick={() => setGrader(g.label)}>
            {g.short}
          </Button>
        ))}
      </div>
      <div className="mt-4">
        <ActivityFeed items={activity.data} loading={activity.isLoading} />
      </div>
    </>
  )
}

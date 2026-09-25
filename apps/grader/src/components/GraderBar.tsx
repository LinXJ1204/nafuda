import { GRADERS } from '@nafuda/core/deployment.ts'
import { AddressLink } from '@nafuda/ui/components.tsx'
import { who } from '@nafuda/ui/format.ts'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { useConsole } from '../console.tsx'

/// Who you are in this console: the connected grader, or a read-only view of one.
export function GraderBar() {
  const { account } = useWallet()
  const { grader, canIssue, setGrader } = useConsole()
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: grader.color, background: `linear-gradient(90deg, ${grader.color}18, transparent 70%)` }}>
      <span className="size-3 rounded-full" style={{ background: grader.color }} />
      <strong className="text-lg">{grader.short}</strong>
      <span className="font-mono text-xs text-muted">{grader.ensName}</span>
      <span className="text-xs text-muted">
        grader <AddressLink address={grader.grader} />
      </span>
      <span className="ml-auto text-sm">
        {canIssue ? (
          <span className="font-semibold text-ok">✓ Signed in as {grader.short}: you can issue</span>
        ) : account ? (
          <span className="text-warn">Connected as {who(account)}, not a grader. Read-only.</span>
        ) : (
          <span className="text-muted">Read-only. Connect a grader wallet to issue.</span>
        )}
      </span>
      {!canIssue && (
        <select value={grader.label} onChange={(e) => setGrader(e.target.value)} className="rounded-lg border border-line bg-card px-2 py-1 text-sm">
          {GRADERS.map((g) => (
            <option key={g.label} value={g.label}>
              View {g.short}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

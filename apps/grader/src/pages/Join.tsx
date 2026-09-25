import { Card } from '@nafuda/ui/components.tsx'

const STEPS = [
  ['Own registry', 'A UserRegistry proxy is deployed for the grader through the official ENSv2 VerifiableFactory. The grader is its admin.'],
  ['Own controller', 'The grader deploys a TitleController (or V2, for extra records such as subgrades). It issues titles and answers as the wildcard resolver for every cert.'],
  ['Name under nafuda.eth', 'The operator registers <grader>.nafuda.eth with the registry as its subregistry and the controller as its resolver. Nothing else in the tree changes.'],
  ['Hand over issuance', 'The grader grants ROLE_REGISTRAR to its controller only.'],
  ['Give up the rest', 'The grader revokes every other role on its registry root, keeping only REGISTRAR admin, SET_PARENT and CAN_NAME. The registry is now emancipated: nobody can unregister, re-point or upgrade an issued title.'],
]

export function JoinPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="mt-8 text-3xl font-bold">How a grader joins</h1>
      <p className="mt-2 text-muted">
        BGS-Sim and CGC-Sim joined this way tonight, after PSA-Sim, without any change to PSA-Sim's contracts. It also works after the final lock: the lock
        freezes existing graders' subtrees, not the operator's ability to add new names.
      </p>
      <ol className="mt-6 grid gap-3">
        {STEPS.map(([h, b], i) => (
          <li key={h} className="grid grid-cols-[36px_1fr] gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-accent font-bold text-on-accent">{i + 1}</span>
            <Card className="p-4">
              <strong>{h}</strong>
              <p className="mt-1 text-sm text-muted">{b}</p>
            </Card>
          </li>
        ))}
      </ol>
      <Card className="mt-6 p-5">
        <h2 className="font-bold">One command</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-code p-3 text-[12.5px]">{`cd scripts
npm run deploy-grader -- --network sepolia --label <grader>   # idempotent`}</pre>
        <p className="mt-2 text-xs text-muted">Source: scripts/src/deploy-grader.ts. Each step checks chain state first, so re-running it never repeats a step.</p>
      </Card>
    </div>
  )
}

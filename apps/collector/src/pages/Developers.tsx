import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { GRADERS, NAFUDA_REGISTRY, UNIVERSAL_RESOLVER } from '@nafuda/core/deployment.ts'
import { AddressLink, Card, ExtLink } from '@nafuda/ui/components.tsx'
import { WitnessPanel } from '@nafuda/ui/Witness.tsx'

const RECORDS = [
  ['addr (coin 60)', 'The current holder. Follows every transfer; computed from the registry, never stale.'],
  ['title.status', 'ISSUED, or NONE for a cert without a title.'],
  ['slab.chip', "Address of the key inside the slab's chip (checksummed). Fixed at issuance."],
  ['card', 'Card as graded.'],
  ['grade', 'Grade as graded, in the grader’s own scale.'],
  ['issued_at', 'Unix seconds.'],
  ['grader', 'Human-readable grader name.'],
  ['attributes', 'Controller v2 only: comma-separated list of extra keys, e.g. BGS-Sim subgrades.'],
  ['subgrade.centering …', 'Controller v2 only: one text record per attribute key.'],
  ['card.category, card.game, card.sport, card.year, card.language …', 'Controller v2 only, optional: the card’s category, set by the grader at issuance (fields modeled on a PSA cert page). Game names are real; the demo cards are fictional.'],
]

export function DevelopersPage() {
  const { hash } = useLocation()
  // In-app links to /developers#witness: scroll to the panel once it is on screen.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])
  return (
    <div className="max-w-4xl">
      <h1 className="mt-8 text-3xl font-bold">For developers</h1>
      <p className="mt-2 text-muted">
        A title is an ENSv2 name. There is no Nafuda API you need: any ENS client that uses the ENSv2 Universal Resolver can read it. The Nafuda server
        only indexes events for lists and charts.
      </p>
      <Card className="mt-6 p-5">
        <h2 className="text-lg font-bold">Read a title with viem</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-code p-4 text-[12.5px] leading-relaxed">{`import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'

const client = createPublicClient({ chain: sepolia, transport: http() })
const universalResolverAddress = '${UNIVERSAL_RESOLVER}' // ENSv2 Beta
const name = '12345678.psa-sim.nafuda.eth'

const holder = await client.getEnsAddress({ name, universalResolverAddress })
const chip = await client.getEnsText({ name, key: 'slab.chip', universalResolverAddress })

// Verify the slab: ask its chip to sign a fresh challenge, then
// recoverMessageAddress({ message, signature }) === chip`}</pre>
      </Card>
      <div id="witness" className="mt-6 scroll-mt-20">
        <WitnessPanel />
      </div>
      <Card className="mt-6 p-5">
        <h2 className="text-lg font-bold">Records</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {RECORDS.map(([k, v]) => (
              <tr key={k} className="border-t border-line">
                <td className="py-2 pr-4 font-mono text-[13px] whitespace-nowrap">{k}</td>
                <td className="py-2 text-muted">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="mt-6 p-5">
        <h2 className="text-lg font-bold">Contracts (Sepolia)</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            <tr className="border-t border-line">
              <td className="py-2 pr-4">nafuda.eth registry</td>
              <td className="py-2">
                <AddressLink address={NAFUDA_REGISTRY} />
              </td>
            </tr>
            {GRADERS.map((g) => (
              <tr key={g.label} className="border-t border-line">
                <td className="py-2 pr-4">
                  <span className="font-mono">{g.ensName}</span>
                </td>
                <td className="py-2">
                  registry <AddressLink address={g.registry} /> · controller v{g.controllerVersion} <AddressLink address={g.controller} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Source and tests: <ExtLink href="https://github.com/LinXJ1204/nafuda">github.com/LinXJ1204/nafuda</ExtLink>
        </p>
      </Card>
    </div>
  )
}

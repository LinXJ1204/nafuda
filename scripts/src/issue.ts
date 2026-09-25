// Issue the demo titles (every slab in demo/slabs.json) to alice. Idempotent.
//
//   npm run issue -- --network fork|sepolia

import { zeroAddress, type Address } from 'viem'
import { loadConfig, networkFromArgs } from './config.ts'
import { confirm, demoSlabs, loadState, skip, titleControllerArtifact } from './lib.ts'

const cfg = loadConfig(networkFromArgs())
const { publicClient: client } = cfg
const state = loadState(cfg.network, cfg.nameLabel)
if (!state.titleController) throw new Error('no TitleController in deployment state: run deploy first')
const controller = { address: state.titleController, abi: titleControllerArtifact().abi }
const alice = cfg.accounts.alice.address

console.log(`== issue demo titles on ${cfg.network} ==`)

for (const [cert, slab] of Object.entries(demoSlabs())) {
  const label = `issue ${cert}`
  const holder = (await client.readContract({ ...controller, functionName: 'holderOf', args: [cert] })) as Address
  if (holder !== zeroAddress) {
    skip(label, `already issued, holder ${holder}`)
    continue
  }
  const hash = await cfg.wallet('grader').writeContract({
    ...controller,
    functionName: 'issue',
    args: [cert, alice, slab.genuine.address, slab.card, slab.grade],
  })
  state.txs[label] = hash
  await confirm(client, label, hash)
}

// Before (re)recording the demo: move every demo title back to alice. Idempotent.
//
//   npm run reset -- --network sepolia

import { zeroAddress, type Address } from 'viem'
import { ROLES, loadConfig, networkFromArgs, type Role } from './config.ts'
import { demoSlabs, loadState, sameAddress, skip, titleControllerArtifact, transferTitle } from './lib.ts'

const cfg = loadConfig(networkFromArgs())
const state = loadState(cfg.network, cfg.nameLabel)
if (!state.titleController || !state.psaRegistry) throw new Error('deployment state incomplete: run deploy first')
const controller = { address: state.titleController, abi: titleControllerArtifact().abi }

console.log(`== reset demo titles to alice on ${cfg.network} ==`)
for (const cert of Object.keys(demoSlabs())) {
  const holder = (await cfg.publicClient.readContract({ ...controller, functionName: 'holderOf', args: [cert] })) as Address
  if (holder === zeroAddress) throw new Error(`${cert} is not issued: run issue first`)
  if (sameAddress(holder, cfg.accounts.alice.address)) {
    skip(`reset ${cert}`, 'already with alice')
    continue
  }
  const from = ROLES.find((r) => sameAddress(cfg.accounts[r].address, holder)) as Role | undefined
  if (!from) throw new Error(`${cert} is held by ${holder}, which is not a demo account`)
  await transferTitle(cfg, state.psaRegistry, from, 'alice', cert)
}

// Transfer a title (ERC-1155 safeTransferFrom on the grader registry).
//
//   npm run transfer -- --network fork --from alice --to bob --cert 12345678

import { ROLES, loadConfig, networkFromArgs, type Role } from './config.ts'
import { loadState, transferTitle } from './lib.ts'

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`)
  const v = i >= 0 ? process.argv[i + 1] : undefined
  if (!v) throw new Error(`missing --${name}`)
  return v
}

function role(name: string): Role {
  if (!(ROLES as readonly string[]).includes(name)) throw new Error(`unknown account "${name}", expected one of ${ROLES.join(', ')}`)
  return name as Role
}

const cfg = loadConfig(networkFromArgs())
const state = loadState(cfg.network, cfg.nameLabel)
if (!state.psaRegistry) throw new Error('no psaRegistry in deployment state: run deploy first')

await transferTitle(cfg, state.psaRegistry, role(arg('from')), role(arg('to')), arg('cert'))

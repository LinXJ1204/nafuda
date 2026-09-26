// Everything the apps and the server need to know about the deployment, from the committed
// files: deployments/sepolia.json (addresses), demo/graders.json, demo/collectors.json,
// demo/catalog.json. Single source of truth; works in Node and in Vite.

import { getAddress, type Address } from 'viem'
import catalogJson from '../../../demo/catalog.json' with { type: 'json' }
import collectorsJson from '../../../demo/collectors.json' with { type: 'json' }
import gradersJson from '../../../demo/graders.json' with { type: 'json' }
import deployment from '../../../deployments/sepolia.json' with { type: 'json' }

export const CHAIN_ID = 11155111
export const ROOT_LABEL: string = deployment.nameLabel
export const ROOT_NAME = `${ROOT_LABEL}.eth`

/// ENSv2 Beta on Sepolia. viem's built-in Sepolia UR is the ENSv1 one, so pass this explicitly.
export const UNIVERSAL_RESOLVER: Address = '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe'
export const ETH_REGISTRY: Address = '0x657eA849311d3D5823348ddEd7C2AaAFb3EDE09E'
export const NAFUDA_REGISTRY = getAddress(deployment.nafudaRegistry)
/// ENSv2 Beta UserRegistry implementation (what every registry proxy points at)
export const USER_REGISTRY_IMPL: Address = getAddress('0xa80338aaa8d23831cea25e858d1774534abb0263')

export type Grader = {
  label: string
  /// e.g. "psa-sim.nafuda.eth"
  ensName: string
  short: string
  name: string
  modeledAfter: string
  color: string
  certDigits: number
  seedCertStart: number
  scale: string[]
  subgrades: string[]
  grader: Address
  registry: Address
  controller: Address
  controllerVersion: 1 | 2
  startBlock: number
}

type GraderDef = Omit<Grader, 'label' | 'ensName' | 'grader' | 'registry' | 'controller' | 'controllerVersion' | 'startBlock' | 'subgrades'> & {
  subgrades?: string[]
}
type GraderDeployment = { label: string; grader: string; registry: string; controller: string; controllerVersion: 1 | 2; startBlock: number }

const defs = gradersJson.graders as Record<string, GraderDef>
const deployed = ((deployment as { graders?: Record<string, GraderDeployment> }).graders ?? {}) as Record<string, GraderDeployment>

/// Graders that are both defined and deployed, in definition order.
export const GRADERS: Grader[] = Object.entries(defs)
  .filter(([label]) => deployed[label])
  .map(([label, d]) => ({
    ...d,
    label,
    ensName: `${label}.${ROOT_NAME}`,
    subgrades: d.subgrades ?? [],
    grader: getAddress(deployed[label].grader),
    registry: getAddress(deployed[label].registry),
    controller: getAddress(deployed[label].controller),
    controllerVersion: deployed[label].controllerVersion,
    startBlock: deployed[label].startBlock,
  }))

export const graderByLabel = (label: string) => GRADERS.find((g) => g.label === label)
export const graderByRegistry = (address: string) => GRADERS.find((g) => g.registry.toLowerCase() === address.toLowerCase())
export const graderByController = (address: string) => GRADERS.find((g) => g.controller.toLowerCase() === address.toLowerCase())

/// First block to read events from.
export const START_BLOCK = Math.min(deployment.startBlock, ...GRADERS.map((g) => g.startBlock))

export type Collector = { name: string; bio: string; address: Address; source: 'env' | 'mnemonic' | 'external' }
export const COLLECTORS: Collector[] = (collectorsJson.collectors as Collector[]).map((c) => ({ ...c, address: getAddress(c.address) }))
const byAddress = new Map(COLLECTORS.map((c) => [c.address.toLowerCase(), c]))
export const collectorOf = (address: string | null | undefined) => (address ? byAddress.get(address.toLowerCase()) : undefined)

export type CatalogCard = { card: string; name: string; rarity: string; number: string; set: string }
export const CATALOG: CatalogCard[] = catalogJson.cards

/// "12345678.psa-sim.nafuda.eth"
export const titleName = (grader: string, cert: string) => `${cert}.${grader}.${ROOT_NAME}`

/// Same rule as TitleController._isCanonicalCert.
export const isCanonicalCert = (cert: string) => /^[1-9][0-9]{0,9}$/.test(cert)

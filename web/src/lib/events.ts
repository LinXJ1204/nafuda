// Title index built from on-chain events with getLogs (no indexer, no database):
//   TitleController.TitleIssued      → which certs exist, their chip and card data
//   psaRegistry ERC-1155 TransferSingle → every change of holder
// `buildIndex` is pure and covered by events.test.ts; `loadIndex` fetches the logs.

import { parseAbiItem, type Address, type Hash, type PublicClient } from 'viem'

export const titleIssuedEvent = parseAbiItem(
  'event TitleIssued(uint256 indexed labelId, string cert, address indexed holder, address indexed chip, string card, string grade)',
)
export const transferSingleEvent = parseAbiItem(
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
)

const ZERO: Address = '0x0000000000000000000000000000000000000000'

/// ENSv2 token ids carry a version in the low 32 bits; the canonical id zeroes them, so every
/// version of a title (and the labelhash itself) maps to the same key.
export const canonicalId = (id: bigint) => id & ~0xffffffffn

type Pos = { blockNumber: bigint; logIndex: number; transactionHash: Hash }

export type IssuedLog = Pos & {
  args: { labelId: bigint; cert: string; holder: Address; chip: Address; card: string; grade: string }
}
export type TransferLog = Pos & { args: { from: Address; to: Address; id: bigint } }

export type HistoryEntry = {
  kind: 'issued' | 'transfer'
  from: Address | null
  to: Address
  blockNumber: bigint
  transactionHash: Hash
}

export type IndexedTitle = {
  cert: string
  labelId: bigint
  card: string
  grade: string
  chip: Address
  holder: Address
  issuedBlock: bigint
  history: HistoryEntry[] // oldest first
}

const byPosition = (a: Pos, b: Pos) =>
  a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1

/// Newest-issued first. Mints and burns inside TransferSingle are skipped: the issuance is
/// represented by TitleIssued, and a burn/mint pair to the same owner is a token-id
/// regeneration (roles changed), not a change of holder.
export function buildIndex(issued: IssuedLog[], transfers: TransferLog[]): IndexedTitle[] {
  const titles = new Map<bigint, IndexedTitle>()
  for (const log of [...issued].sort(byPosition)) {
    const { labelId, cert, holder, chip, card, grade } = log.args
    titles.set(canonicalId(labelId), {
      cert,
      labelId,
      card,
      grade,
      chip,
      holder,
      issuedBlock: log.blockNumber,
      history: [{ kind: 'issued', from: null, to: holder, blockNumber: log.blockNumber, transactionHash: log.transactionHash }],
    })
  }
  for (const log of [...transfers].sort(byPosition)) {
    const { from, to, id } = log.args
    if (from === ZERO || to === ZERO) continue
    const title = titles.get(canonicalId(id))
    if (!title) continue
    title.holder = to
    title.history.push({ kind: 'transfer', from, to, blockNumber: log.blockNumber, transactionHash: log.transactionHash })
  }
  return [...titles.values()].sort((a, b) => (a.issuedBlock === b.issuedBlock ? 0 : a.issuedBlock > b.issuedBlock ? -1 : 1))
}

export async function loadIndex(
  client: PublicClient,
  deployment: { titleController: Address; psaRegistry: Address; startBlock: number },
): Promise<IndexedTitle[]> {
  const fromBlock = BigInt(deployment.startBlock)
  const [issued, transfers] = await Promise.all([
    client.getLogs({ address: deployment.titleController, event: titleIssuedEvent, fromBlock, toBlock: 'latest' }),
    client.getLogs({ address: deployment.psaRegistry, event: transferSingleEvent, fromBlock, toBlock: 'latest' }),
  ])
  return buildIndex(issued as unknown as IssuedLog[], transfers as unknown as TransferLog[])
}

/// Block timestamps for history rows (one request per distinct block, cached).
const blockTimes = new Map<bigint, Date>()
export async function blockTime(client: PublicClient, blockNumber: bigint): Promise<Date> {
  let t = blockTimes.get(blockNumber)
  if (!t) {
    const block = await client.getBlock({ blockNumber })
    t = new Date(Number(block.timestamp) * 1000)
    blockTimes.set(blockNumber, t)
  }
  return t
}

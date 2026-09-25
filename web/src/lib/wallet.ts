// Injected wallet (MetaMask): connection state shared by the header and the views, the seller's
// proof of holding (sign the buyer's challenge), and the title transfer (ERC-1155 safeTransferFrom).

import {
  createWalletClient,
  custom,
  getAddress,
  labelhash,
  recoverMessageAddress,
  type Address,
  type EIP1193Provider,
  type Hash,
} from 'viem'
import { sepolia } from 'viem/chains'
import { PSA_REGISTRY } from './config.ts'
import { registryAbi } from './contracts.ts'
import { client } from './ens.ts'

const injected = () => (window as unknown as { ethereum?: EIP1193Provider }).ethereum

////////////////////////////////////////////////////////////////////////
// Connection state
////////////////////////////////////////////////////////////////////////

let account: Address | null = null
const listeners = new Set<(a: Address | null) => void>()

function setAccount(next: Address | null) {
  if (next === account) return
  account = next
  for (const fn of listeners) fn(account)
}

export const currentAccount = () => account

/// Called now and on every change (connect, account switch, disconnect).
export function watchAccount(fn: (a: Address | null) => void): () => void {
  listeners.add(fn)
  fn(account)
  return () => listeners.delete(fn)
}

/// Pick up an already-authorized account without prompting (eth_accounts).
export async function restoreAccount() {
  const provider = injected()
  if (!provider) return
  provider.on?.('accountsChanged', (accounts: string[]) => setAccount(accounts[0] ? getAddress(accounts[0]) : null))
  try {
    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
    setAccount(accounts[0] ? getAddress(accounts[0]) : null)
  } catch {
    // no wallet access yet: stay disconnected
  }
}

export async function connect() {
  const provider = injected()
  if (!provider) throw new Error('No browser wallet found. Install MetaMask, or use scripts/transfer.ts.')
  const wallet = createWalletClient({ chain: sepolia, transport: custom(provider) })
  const [first] = await wallet.requestAddresses()
  if ((await wallet.getChainId()) !== sepolia.id) await wallet.switchChain({ id: sepolia.id })
  setAccount(first)
  return { wallet, account: first }
}

////////////////////////////////////////////////////////////////////////
// Seller actions
////////////////////////////////////////////////////////////////////////

/// The seller signs the buyer's challenge message; returns the recovered address.
export async function sellerSigns(message: string): Promise<Address> {
  const { wallet, account } = await connect()
  const signature = await wallet.signMessage({ account, message })
  return recoverMessageAddress({ message, signature })
}

/// Transfer the title for `cert` from the connected account to `to`.
export async function transferTitle(cert: string, to: Address): Promise<Hash> {
  const { wallet, account } = await connect()
  const tokenId = await client.readContract({
    address: PSA_REGISTRY,
    abi: registryAbi,
    functionName: 'getTokenId',
    args: [BigInt(labelhash(cert))],
  })
  const hash = await wallet.writeContract({
    account,
    address: PSA_REGISTRY,
    abi: registryAbi,
    functionName: 'safeTransferFrom',
    args: [account, to, tokenId, 1n, '0x'],
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`transfer reverted: ${hash}`)
  return hash
}

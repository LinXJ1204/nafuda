// Seller-side actions with an injected wallet (MetaMask): prove you hold the title by signing
// the buyer's challenge, and transfer the title (ERC-1155 safeTransferFrom).

import { createWalletClient, custom, labelhash, parseAbi, recoverMessageAddress, type Address, type EIP1193Provider, type Hash } from 'viem'
import { sepolia } from 'viem/chains'
import { PSA_REGISTRY } from './config.ts'
import { client } from './ens.ts'

const registryAbi = parseAbi([
  'function getTokenId(uint256 anyId) view returns (uint256)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)',
])

async function connect() {
  const provider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum
  if (!provider) throw new Error('No browser wallet found. Install MetaMask, or use scripts/transfer.ts.')
  const wallet = createWalletClient({ chain: sepolia, transport: custom(provider) })
  const [account] = await wallet.requestAddresses()
  if ((await wallet.getChainId()) !== sepolia.id) await wallet.switchChain({ id: sepolia.id })
  return { wallet, account }
}

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

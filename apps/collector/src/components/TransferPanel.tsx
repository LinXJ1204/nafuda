// The holder transfers the title (ERC-1155 safeTransferFrom). The seller may declare the sale
// price; it is written into the transfer's `data` and shown as self-reported.

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getAddress, isAddress, isAddressEqual, labelhash, type Address } from 'viem'
import { registryAbi } from '@nafuda/core/abis.ts'
import { COLLECTORS, graderByLabel } from '@nafuda/core/deployment.ts'
import { encodePrice } from '@nafuda/core/price.ts'
import { Avatar, Button, Card, TxLink } from '@nafuda/ui/components.tsx'
import { publicClient } from '@nafuda/ui/ens.ts'
import { who } from '@nafuda/ui/format.ts'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { WalletButton } from '@nafuda/ui/WalletButton.tsx'

export function TransferPanel({ grader, cert, holder, onDone }: { grader: string; cert: string; holder: Address; onDone: () => void }) {
  const { account, client } = useWallet()
  const queryClient = useQueryClient()
  const [to, setTo] = useState('')
  const [price, setPrice] = useState('')
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; text?: string; tx?: string }>({ kind: 'idle' })
  const isHolder = account && isAddressEqual(account, holder)

  async function send() {
    if (!isAddress(to.trim())) return setState({ kind: 'error', text: 'Enter the buyer address.' })
    const buyer = getAddress(to.trim())
    if (isAddressEqual(buyer, holder)) return setState({ kind: 'error', text: 'That is already the holder.' })
    const jpy = price.trim() ? Number(price.replace(/[,¥\s]/g, '')) : null
    if (jpy !== null && (!Number.isSafeInteger(jpy) || jpy < 0)) return setState({ kind: 'error', text: 'Price must be a whole number of yen.' })
    try {
      setState({ kind: 'busy', text: 'Confirm in your wallet…' })
      const registry = graderByLabel(grader)!.registry
      const { wallet, account: from } = await client()
      const tokenId = await publicClient.readContract({ address: registry, abi: registryAbi, functionName: 'getTokenId', args: [BigInt(labelhash(cert))] })
      const hash = await wallet.writeContract({
        account: from,
        chain: wallet.chain,
        address: registry,
        abi: registryAbi,
        functionName: 'safeTransferFrom',
        args: [from, buyer, tokenId, 1n, jpy === null ? '0x' : encodePrice(jpy)],
      })
      setState({ kind: 'busy', text: 'Waiting for the block…', tx: hash })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('transfer reverted')
      setState({ kind: 'done', text: `Transferred to ${who(buyer)}.`, tx: hash })
      await queryClient.invalidateQueries()
      onDone()
    } catch (e) {
      setState({ kind: 'error', text: (e as Error).message.split('\n')[0] })
    }
  }

  return (
    <Card className="p-4">
      <h3 className="font-bold">Transfer this title</h3>
      {!account ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">Holder? Connect your wallet to send the title to the buyer.</p>
          <WalletButton />
        </div>
      ) : !isHolder ? (
        <p className="mt-2 text-sm text-muted">
          Connected as {who(account)}. Only the holder, {who(holder)}, can transfer this title.
        </p>
      ) : (
        <div className="mt-2 grid gap-2">
          <p className="text-sm text-muted">You hold this title. After the buyer has checked the slab and paid, send the title to them.</p>
          <div className="flex flex-wrap gap-1.5">
            {COLLECTORS.filter((c) => !isAddressEqual(c.address, holder) && c.name !== 'mallory')
              .slice(0, 6)
              .map((c) => (
                <Button key={c.address} size="sm" onClick={() => setTo(c.address)}>
                  <Avatar address={c.address} size={14} />
                  {c.name}
                </Button>
              ))}
          </div>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Buyer address 0x…" className="rounded-xl border border-line bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-accent" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Declared price in ¥ (optional, public)" inputMode="numeric" className="rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
          <Button variant="primary" disabled={state.kind === 'busy'} onClick={send}>
            Transfer title
          </Button>
        </div>
      )}
      {state.text && (
        <p className={`mt-2 text-xs ${state.kind === 'error' ? 'text-bad' : state.kind === 'done' ? 'text-ok' : 'text-muted'}`}>
          {state.text} {state.tx && <TxLink hash={state.tx} />}
        </p>
      )}
    </Card>
  )
}

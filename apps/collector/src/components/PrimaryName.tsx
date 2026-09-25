// Set the connected wallet's primary ENS name (v1 addr.reverse, which ENSv2 reads).

import { useState } from 'react'
import { parseAbi } from 'viem'
import { Button, TxLink } from '@nafuda/ui/components.tsx'
import { publicClient } from '@nafuda/ui/ens.ts'
import { useWallet } from '@nafuda/ui/wallet.tsx'

const REVERSE_REGISTRAR = '0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6'
const abi = parseAbi(['function setName(string name) returns (bytes32)'])

export function PrimaryNameButton({ name, onDone }: { name: string; onDone: () => void }) {
  const { client } = useWallet()
  const [state, setState] = useState<{ text: string; tx?: string } | null>(null)
  async function set() {
    try {
      setState({ text: 'Confirm in your wallet…' })
      const { wallet, account } = await client()
      const hash = await wallet.writeContract({ account, chain: wallet.chain, address: REVERSE_REGISTRAR, abi, functionName: 'setName', args: [name] })
      setState({ text: 'Waiting for the block…', tx: hash })
      await publicClient.waitForTransactionReceipt({ hash })
      setState({ text: `Primary name set to ${name}.`, tx: hash })
      onDone()
    } catch (e) {
      setState({ text: (e as Error).message.split('\n')[0] })
    }
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="primary" onClick={set}>
        Set {name} as my primary name
      </Button>
      {state && (
        <span className="text-xs text-muted">
          {state.text} {state.tx && <TxLink hash={state.tx} />}
        </span>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Avatar, Button } from './components.tsx'
import { who } from './format.ts'
import { useWallet } from './wallet.tsx'

export function WalletButton({ label = 'Connect wallet' }: { label?: string }) {
  const { account, connect, disconnect, connecting, providers } = useWallet()
  const [error, setError] = useState<string | null>(null)
  if (account) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-xl border border-accent/50 bg-card px-3 py-1.5 text-sm font-semibold">
          <Avatar address={account} size={18} />
          {who(account)}
        </span>
        <Button variant="ghost" size="sm" onClick={disconnect} title="Forget this connection in this app">
          ✕
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-end">
      <Button
        variant="primary"
        size="md"
        disabled={connecting}
        onClick={() => connect(providers[0]?.info.rdns).catch((e: Error) => setError(e.message.split('\n')[0]))}
      >
        {connecting ? 'Connecting…' : label}
      </Button>
      {error && <span className="mt-1 max-w-56 text-right text-[11px] text-bad">{error}</span>}
    </div>
  )
}

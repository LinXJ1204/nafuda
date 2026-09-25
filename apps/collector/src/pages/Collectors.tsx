import { Link } from 'react-router'
import { useCollectors } from '@nafuda/ui/api.ts'
import { Avatar, Card, Skeleton } from '@nafuda/ui/components.tsx'
import { short } from '@nafuda/ui/format.ts'
import { WalletButton } from '@nafuda/ui/WalletButton.tsx'

export function CollectorsPage({ prompt = false }: { prompt?: boolean }) {
  const collectors = useCollectors()
  return (
    <>
      {prompt && (
        <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="text-xl font-bold">My titles</h1>
            <p className="text-sm text-muted">Connect your wallet to see the titles you hold, or look at one of the demo collectors below.</p>
          </div>
          <WalletButton />
        </Card>
      )}
      <h1 className={`${prompt ? 'mt-10 text-2xl' : 'mt-8 text-3xl'} font-bold`}>Collectors</h1>
      <p className="mt-1 text-sm text-muted">The demo's collectors are fictional; their wallets trade on Sepolia through the night. The author's own wallet is one of them.</p>
      {!collectors.data ? (
        <Skeleton className="mt-6 h-64" />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...collectors.data]
            .sort((a, b) => b.titles - a.titles)
            .map((c) => (
              <Link key={c.address} to={`/collector/${c.address}`} className="flex gap-3 rounded-2xl border border-line bg-card p-4 no-underline transition hover:border-accent">
                <Avatar address={c.address} size={40} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <strong>{c.name}</strong>
                    <span className="text-xs text-muted">{c.titles} titles</span>
                  </div>
                  <div className="font-mono text-[11px] text-faint">{short(c.address)}</div>
                  <p className="mt-1 text-xs text-muted">{c.bio}</p>
                </div>
              </Link>
            ))}
        </div>
      )}
    </>
  )
}

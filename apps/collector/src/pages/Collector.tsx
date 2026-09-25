import { useParams } from 'react-router'
import { isAddress } from 'viem'
import { useHolder } from '@nafuda/ui/api.ts'
import { ActivityFeed } from '@nafuda/ui/ActivityFeed.tsx'
import { AddressLink, Avatar, Empty, Section, Skeleton, Stat } from '@nafuda/ui/components.tsx'
import { compactJpy, short } from '@nafuda/ui/format.ts'
import { TitleGrid } from '@nafuda/ui/TitleCard.tsx'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { NotFound } from './NotFound.tsx'

export function CollectorPage() {
  const { address = '' } = useParams()
  const holder = useHolder(isAddress(address) ? address : null)
  const { account } = useWallet()
  if (!isAddress(address)) return <NotFound />
  const h = holder.data
  const mine = account?.toLowerCase() === address.toLowerCase()

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <Avatar address={address} size={72} />
        <div>
          <h1 className="text-3xl font-bold">
            {h?.name ?? short(address)} {mine && <span className="align-middle text-sm font-semibold text-accent">· you</span>}
          </h1>
          <div className="mt-1 text-sm text-muted">
            <AddressLink address={address} />
          </div>
          {h?.bio && <p className="mt-2 max-w-xl text-sm text-muted">{h.bio}</p>}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Holds" value={h?.held.length ?? '…'} />
        <Stat label="Held before" value={h?.past.length ?? '…'} />
        <Stat label="Bought" value={h?.stats.bought ?? '…'} />
        <Stat label="Sold" value={h?.stats.sold ?? '…'} />
        <Stat label="Declared spend" value={h ? compactJpy(h.stats.spentJpy) : '…'} sub={h ? `earned ${compactJpy(h.stats.earnedJpy)}` : undefined} />
      </div>
      <Section title="Holds now">{!h ? <Skeleton className="h-64" /> : h.held.length ? <TitleGrid items={h.held} /> : <Empty>No titles.</Empty>}</Section>
      {h && h.past.length > 0 && (
        <Section title="Held before" sub="Titles this collector sold on.">
          <TitleGrid items={h.past} />
        </Section>
      )}
      <Section title="Activity">
        <ActivityFeed items={h?.activity} loading={holder.isLoading} />
      </Section>
    </>
  )
}

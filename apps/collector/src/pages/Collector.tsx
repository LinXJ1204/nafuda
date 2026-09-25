import { useParams } from 'react-router'
import { isAddress } from 'viem'
import { useHolder, useHolderOffers, useSubmissions } from '@nafuda/ui/api.ts'
import { ActivityFeed } from '@nafuda/ui/ActivityFeed.tsx'
import { Addr, AddressLink, AppLink, Avatar, Empty, Pill, Section, Skeleton, Stat, useEnsName } from '@nafuda/ui/components.tsx'
import { PrimaryNameButton } from '../components/PrimaryName.tsx'
import { compactJpy, jpy, short } from '@nafuda/ui/format.ts'
import { TitleGrid } from '@nafuda/ui/TitleCard.tsx'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { NotFound } from './NotFound.tsx'
import { SubmissionList } from './Submit.tsx'

export function CollectorPage() {
  const { address = '' } = useParams()
  const holder = useHolder(isAddress(address) ? address : null)
  const { account } = useWallet()
  const ens = useEnsName(isAddress(address) ? address : null)
  const offers = useHolderOffers(isAddress(address) ? address : null)
  const submissions = useSubmissions({ submitter: isAddress(address) ? address.toLowerCase() : undefined })
  if (!isAddress(address)) return <NotFound />
  const h = holder.data
  const mine = account?.toLowerCase() === address.toLowerCase()

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <Avatar address={address} size={72} />
        <div>
          <h1 className="text-3xl font-bold">
            {ens.data ?? h?.name ?? short(address)} {mine && <span className="align-middle text-sm font-semibold text-accent">· you</span>}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <AddressLink address={address} />
            {ens.data ? <Pill tone="ok">primary name via ENS</Pill> : ens.isFetched && <Pill>no primary name</Pill>}
          </div>
          {mine && !ens.data && ens.isFetched && h?.name && <PrimaryNameButton name={`${h.name}.nafuda.eth`} onDone={() => ens.refetch()} />}
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
      {offers.data && (offers.data.received.length > 0 || offers.data.made.length > 0) && (
        <Section title="Trade interest" sub="Signed asks and offers. They never move a title.">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Offers on their titles', offers.data.received],
              ['Their asks and offers', offers.data.made],
            ].map(([label, rows]) => (
              <div key={label as string}>
                <h3 className="mb-2 text-sm font-semibold text-muted">{label as string}</h3>
                <div className="grid gap-2">
                  {(rows as typeof offers.data.made).length === 0 && <p className="text-sm text-faint">None.</p>}
                  {(rows as typeof offers.data.made).map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm">
                      <AppLink to={`/title/${o.grader}/${o.cert}`} className="font-medium hover:text-accent">
                        {(o.card ?? '').replace(' (demo card)', '').split(' - ')[0]} <span className="font-mono text-xs text-faint">#{o.cert}</span>
                      </AppLink>
                      <span className="flex items-center gap-2">
                        <span className={o.kind === 'ask' ? 'font-semibold text-accent' : ''}>{o.kind === 'ask' ? 'asks' : 'offers'}</span>
                        <strong className="tabular-nums">{jpy(o.priceJpy)}</strong>
                        {o.kind === 'bid' && <Addr address={o.from} />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {submissions.data && submissions.data.length > 0 && (
        <Section title="Grading submissions">
          <SubmissionList items={submissions.data} />
        </Section>
      )}
      <Section title="Activity">
        <ActivityFeed items={h?.activity} loading={holder.isLoading} />
      </Section>
    </>
  )
}

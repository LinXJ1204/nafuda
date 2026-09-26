// Title page: the slab, its title as resolved through ENS (authoritative, in the browser), the
// index's view checked against it, provenance, the buyer check, how ENS resolves the name,
// declared price history, and the transfer form for the holder.

import { cardFields } from '@nafuda/core/categories.ts'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { isAddressEqual } from 'viem'
import { UNIVERSAL_RESOLVER, graderByLabel, isCanonicalCert, titleName } from '@nafuda/core/deployment.ts'
import { splitCard } from '@nafuda/core/slab.ts'
import { useTitle } from '@nafuda/ui/api.ts'
import { Addr, AddressLink, Card, ExtLink, GraderBadge, Pill, Section, Skeleton, TimeAgo, TxLink } from '@nafuda/ui/components.tsx'
import { resolveTitle } from '@nafuda/ui/ens.ts'
import { formatTime, jpy, scan } from '@nafuda/ui/format.ts'
import { SlabArt } from '@nafuda/ui/SlabArt.tsx'
import { PriceChart } from '@nafuda/ui/Charts.tsx'
import { ProvenanceFlow } from '../components/ProvenanceFlow.tsx'
import { QrCode } from '../components/QrCode.tsx'
import { ResolutionPath } from '../components/ResolutionPath.tsx'
import { TitleIntegrity } from '../components/TitleIntegrity.tsx'
import { PermissionsPanel } from '../components/PermissionsPanel.tsx'
import { useIntegrity } from '@nafuda/ui/integrity.ts'
import { TradePanel } from '../components/TradePanel.tsx'
import { TransferPanel } from '../components/TransferPanel.tsx'
import { VerifyPanel } from '../components/VerifyPanel.tsx'
import { NotFound } from './NotFound.tsx'
import { useT } from '@nafuda/ui/i18n.tsx'

export function TitlePage() {
  const { grader = '', cert = '' } = useParams()
  const g = graderByLabel(grader)
  const [tapping, setTapping] = useState(false)
  const { t: tr } = useT()
  const ens = useQuery({ queryKey: ['ens', grader, cert], queryFn: () => resolveTitle(grader, cert), enabled: !!g && isCanonicalCert(cert), staleTime: 15_000 })
  const indexed = useTitle(grader, cert)
  const integrity = useIntegrity(grader, cert, ens.data?.holder ?? null, ens.data?.status === 'ISSUED')

  if (!g) return <NotFound />
  if (!isCanonicalCert(cert))
    return (
      <div className="py-16">
        <h1 className="text-2xl font-bold">Not a cert number</h1>
        <p className="mt-2 text-muted">A cert number is 1–10 digits with no leading zero, the same rule the grader's contract enforces on chain.</p>
      </div>
    )

  const t = ens.data
  const idx = indexed.data
  const issued = t?.status === 'ISSUED'
  const card = splitCard(t?.card ?? idx?.card ?? '')
  const consistent = t && idx ? !!t.holder && isAddressEqual(t.holder, idx.holder as `0x${string}`) && !!t.chip && t.chip.toLowerCase() === idx.chip.toLowerCase() : null
  const pageUrl = `${location.origin}/title/${grader}/${cert}`
  const prices = (idx?.history ?? []).filter((h) => h.priceJpy).map((h) => ({ time: h.time, priceJpy: h.priceJpy! }))

  return (
    <>
      <p className="mt-6 text-sm text-muted">
        <Link to="/explore" className="hover:text-ink">
          ← Explore
        </Link>
      </p>

      <section className="mt-4 grid gap-8 md:grid-cols-[minmax(240px,340px)_1fr]">
        <div className="mx-auto w-full max-w-72 md:sticky md:top-24 md:mx-0 md:max-w-none md:self-start">
          {issued && t ? (
            <SlabArt grader={grader} cert={cert} card={t.card ?? ''} grade={t.grade ?? ''} attributes={t.attributes} chipGlow={tapping} />
          ) : ens.isLoading ? (
            <Skeleton className="aspect-[300/480]" />
          ) : (
            <div className="grid aspect-[300/480] place-items-center rounded-2xl border-2 border-dashed border-line text-sm text-muted">No title on ENS</div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {t ? issued ? <Pill tone="ok">ISSUED</Pill> : <Pill>NO TITLE</Pill> : <Skeleton className="h-5 w-16" />}
            <GraderBadge label={grader} />
            <Pill tone="accent">resolved via ENS</Pill>
            {consistent === true && <Pill tone="ok">index matches ENS ✓</Pill>}
            {consistent === false && <Pill tone="warn">index is behind ENS</Pill>}
          </div>
          <p className="mt-2 font-mono text-sm break-all text-muted">{titleName(grader, cert)}</p>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">{issued ? card.name : `Cert #${cert}`}</h1>
          {issued && t && (
            <p className="mt-1 text-lg text-muted">
              {card.detail} · {t.grade}
            </p>
          )}

          {ens.isError && <p className="mt-4 text-sm text-bad">ENS lookup failed: {(ens.error as Error).message.split('\n')[0]}</p>}

          {t && !issued && (
            <p className="mt-4 max-w-xl text-muted">
              {g.short} has not issued a title for this cert. It could be a slab from a grader that does not take part, or an older slab without a chip. Nafuda
              cannot tell either way.
            </p>
          )}

          {issued && t && (
            <>
              <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 text-[15px]">
                <dt className="text-muted">Holder</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <Addr address={t.holder} /> {t.holder && <AddressLink address={t.holder} />}
                </dd>
                <dt className="text-muted">Slab chip</dt>
                <dd>
                  <AddressLink address={t.chip!} />
                </dd>
                <dt className="text-muted">Grade</dt>
                <dd>{t.grade}</dd>
                {cardFields(t.attributes).length > 0 && (
                  <>
                    <dt className="text-muted">Category</dt>
                    <dd className="flex flex-wrap gap-2" title="card.* ENS text records, set by the grader at issuance and fixed">
                      {cardFields(t.attributes).map(([k, v]) => (
                        <span key={k} className="rounded-lg border border-line bg-raised px-2 py-0.5 text-xs">
                          <span className="text-muted">{k}</span> <strong>{v}</strong>
                        </span>
                      ))}
                    </dd>
                  </>
                )}
                {Object.keys(t.attributes).some((k) => k.startsWith('subgrade.')) && (
                  <>
                    <dt className="text-muted">Subgrades</dt>
                    <dd className="flex flex-wrap gap-2">
                      {Object.entries(t.attributes).filter(([k]) => k.startsWith('subgrade.')).map(([k, v]) => (
                        <span key={k} className="rounded-lg border border-line bg-raised px-2 py-0.5 text-xs">
                          {k.replace('subgrade.', '')} <strong>{v}</strong>
                        </span>
                      ))}
                    </dd>
                  </>
                )}
                <dt className="text-muted">Issued</dt>
                <dd>
                  {formatTime(t.issuedAt)} {idx && <TxLink hash={idx.issuedTx} />}
                </dd>
                <dt className="text-muted">Grader</dt>
                <dd className="text-sm">{t.grader}</dd>
                {idx && (
                  <>
                    <dt className="text-muted">Transfers</dt>
                    <dd>
                      {idx.transferCount} {idx.lastPriceJpy ? <span className="text-muted">· last declared {jpy(idx.lastPriceJpy)}</span> : null}
                    </dd>
                  </>
                )}
              </dl>
              <div className="mt-6 grid gap-4">
                <TradePanel grader={grader} cert={cert} holder={t.holder!} />
                <TransferPanel grader={grader} cert={cert} holder={t.holder!} onDone={() => ens.refetch()} />
              </div>
            </>
          )}
        </div>
      </section>

      {issued && idx && (
        <Section title={tr('Provenance')} sub="Every holder since the grader issued the title. Edges are transfers; click one to open the transaction.">
          <ProvenanceFlow title={idx} />
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                  <th className="px-4 py-2">Event</th>
                  <th className="px-2 py-2">From</th>
                  <th className="px-2 py-2">To</th>
                  <th className="px-2 py-2 text-right">Declared</th>
                  <th className="px-2 py-2">When</th>
                  <th className="px-4 py-2">Tx</th>
                </tr>
              </thead>
              <tbody>
                {[...idx.history].reverse().map((h) => (
                  <tr key={h.tx} className="border-t border-line">
                    <td className="px-4 py-2 font-semibold">⇄ Transfer</td>
                    <td className="px-2 py-2">
                      <Addr address={h.from} />
                    </td>
                    <td className="px-2 py-2">
                      <Addr address={h.to} />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{jpy(h.priceJpy)}</td>
                    <td className="px-2 py-2 text-muted">
                      <TimeAgo date={h.time} />
                    </td>
                    <td className="px-4 py-2">
                      <TxLink hash={h.tx} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-line">
                  <td className="px-4 py-2 font-semibold text-accent">◆ Issued</td>
                  <td className="px-2 py-2 text-muted">{g.short}</td>
                  <td className="px-2 py-2">
                    <Addr address={idx.history[0]?.from ?? idx.holder} />
                  </td>
                  <td className="px-2 py-2 text-right text-faint">—</td>
                  <td className="px-2 py-2 text-muted">
                    <TimeAgo date={idx.issuedAt} />
                  </td>
                  <td className="px-4 py-2">
                    <TxLink hash={idx.issuedTx} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {t && (
        <div className="mt-10">
          <VerifyPanel grader={grader} cert={cert} title={t} onTapping={setTapping} integrity={integrity.data} />
        </div>
      )}

      {issued && t?.holder && (
        <div className="mt-10">
          <PermissionsPanel grader={grader} cert={cert} holder={t.holder} />
        </div>
      )}

      {t && (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid content-start gap-6">
            {issued && <TitleIntegrity checks={integrity.data} loading={integrity.isLoading} />}
            <ResolutionPath grader={grader} cert={cert} title={t} />
          </div>
          <div className="grid content-start gap-6">
            <Card className="p-5">
              <h2 className="text-lg font-bold">{tr('Declared price history')}</h2>
              <p className="mt-1 text-xs text-muted">Written by each seller into the transfer. Self-reported, never verified.</p>
              {prices.length ? <PriceChart data={prices} /> : <p className="mt-6 text-sm text-muted">No declared prices yet.</p>}
            </Card>
            <Card className="flex items-center gap-4 p-5">
              <QrCode value={pageUrl} />
              <div className="text-sm">
                <h2 className="text-lg font-bold">On the slab label</h2>
                <p className="mt-1 text-muted">A QR next to the cert number opens this page. The chip, not the QR, is the proof: a QR can be copied.</p>
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="text-lg font-bold">{tr('Any ENS client can read it')}</h2>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-code p-3 text-[11.5px] leading-relaxed">{`const name = '${titleName(grader, cert)}'
const universalResolverAddress = '${UNIVERSAL_RESOLVER}'

await client.getEnsAddress({ name, universalResolverAddress })
await client.getEnsText({ name, key: 'slab.chip', universalResolverAddress })`}</pre>
              <p className="mt-2 text-xs text-muted">
                <Link to="/developers" className="underline">Developer notes</Link> · <ExtLink href={scan('address', g.controller)}>resolver contract</ExtLink>
              </p>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

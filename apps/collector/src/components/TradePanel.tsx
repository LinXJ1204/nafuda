// Trade interest on a title: the holder's asking price and collectors' bids, all EIP-712 signed
// and verified by the server. None of it moves the title: at the show, the buyer still taps the
// slab, pays, and the holder transfers the title.

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { isAddressEqual, type Address } from 'viem'
import { useTitleOffers, type OfferRow } from '@nafuda/ui/api.ts'
import { Addr, Button, Card, Pill, TimeAgo } from '@nafuda/ui/components.tsx'
import { jpy } from '@nafuda/ui/format.ts'
import { signOffer, withdrawOffer } from '@nafuda/ui/sign.ts'
import { useWallet } from '@nafuda/ui/wallet.tsx'

export function TradePanel({ grader, cert, holder }: { grader: string; cert: string; holder: Address }) {
  const offers = useTitleOffers(grader, cert)
  const { account, client } = useWallet()
  const queryClient = useQueryClient()
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const isHolder = !!account && isAddressEqual(account, holder)
  const ask = offers.data?.find((o) => o.kind === 'ask')
  const bids = offers.data?.filter((o) => o.kind === 'bid') ?? []
  const mine = (o: OfferRow) => !!account && o.from.toLowerCase() === account.toLowerCase()

  async function submit() {
    const jpyValue = Number(price.replace(/[,¥\s]/g, ''))
    if (!Number.isSafeInteger(jpyValue) || jpyValue <= 0) return setMsg({ ok: false, text: 'Enter a price in yen.' })
    try {
      await signOffer(client, { grader, cert, kind: isHolder ? 'ask' : 'bid', priceJpy: BigInt(jpyValue), note: note.trim() })
      setMsg({ ok: true, text: isHolder ? 'Asking price published.' : 'Offer sent to the holder.' })
      setPrice('')
      setNote('')
      await queryClient.invalidateQueries()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.split('\n')[0] })
    }
  }

  async function withdraw(id: string) {
    try {
      await withdrawOffer(client, id)
      await queryClient.invalidateQueries()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.split('\n')[0] })
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Trade interest</h2>
          <p className="mt-1 text-xs text-muted">Signed intents to meet and trade. They never move the title: at the show you still tap the slab, pay, and the holder transfers.</p>
        </div>
        {ask ? <Pill tone="accent">For trade</Pill> : <Pill>Not listed</Pill>}
      </div>

      {ask && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/50 bg-accent/5 px-4 py-3">
          <div>
            <div className="text-xs text-muted">Holder asks</div>
            <div className="text-2xl font-bold tabular-nums">{jpy(ask.priceJpy)}</div>
            {ask.note && <div className="text-sm">“{ask.note}”</div>}
          </div>
          {mine(ask) && (
            <Button size="sm" onClick={() => withdraw(ask.id)}>
              Withdraw
            </Button>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Offers ({bids.length})</div>
        {bids.length === 0 ? (
          <p className="text-sm text-muted">No offers yet.</p>
        ) : (
          <ul className="grid gap-2">
            {bids.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <strong className="tabular-nums">{jpy(b.priceJpy)}</strong> from <Addr address={b.from} />
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {b.note && <span>“{b.note}”</span>}
                  <TimeAgo date={b.createdAt} />
                  {mine(b) && (
                    <Button size="sm" variant="ghost" onClick={() => withdraw(b.id)}>
                      Withdraw
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 grid gap-2 border-t border-line pt-4">
        <div className="text-sm font-semibold">{!account ? 'Connect a wallet to make an offer' : isHolder ? 'Set your asking price' : 'Make an offer'}</div>
        <div className="flex flex-wrap gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="¥ price" inputMode="numeric" className="w-36 rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Note (optional, public)" className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <Button variant="primary" disabled={!account} onClick={submit}>
            {isHolder ? 'Publish ask' : 'Sign offer'}
          </Button>
        </div>
        {msg && <p className={`text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
      </div>
    </Card>
  )
}

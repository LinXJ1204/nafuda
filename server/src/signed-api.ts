// Write endpoints for signed, off-chain data: trade interest (offers) and grading submissions.
// Every write carries an EIP-712 signature; the signer is recovered here, never taken from the
// request. Rules live in packages/core/src/signed.ts.

import type { Hono } from 'hono'
import type { Context } from 'hono'
import { createPublicClient, fallback, http, isAddressEqual, parseEventLogs, type Address, type Hex } from 'viem'
import { sepolia } from 'viem/chains'
import { titleIssuedEvent } from '../../packages/core/src/abis.ts'
import { env } from './env.ts'
import { GRADERS, graderByLabel } from '../../packages/core/src/deployment.ts'
import {
  checkGraderAction,
  checkOffer,
  checkSubmission,
  recoverGraderAction,
  recoverOffer,
  recoverSubmission,
  recoverWithdraw,
  type GraderAction,
  type Offer,
  type Submission,
} from '../../packages/core/src/signed.ts'
import type { Sql } from './db.ts'

type Out = (c: Context, data: unknown, status?: number) => Response

let chain: ReturnType<typeof createPublicClient> | null = null
const client = () =>
  (chain ??= createPublicClient({
    chain: sepolia,
    transport: fallback([http(env.rpcUrl(), { retryCount: 3 }), http('https://ethereum-sepolia-rpc.publicnode.com', { retryCount: 3 })]),
  }))

/// The "issued" step must point at a real, successful issuance of this cert by this grader.
async function issuanceMatches(txHash: Hex, controller: Address, cert: string): Promise<boolean> {
  try {
    const receipt = await client().getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') return false
    const logs = parseEventLogs({ abi: [titleIssuedEvent], logs: receipt.logs.filter((l) => isAddressEqual(l.address, controller)) })
    return logs.some((l) => l.args.cert === cert)
  } catch {
    return false
  }
}
const big = (v: unknown) => BigInt(String(v))
const isSig = (v: unknown): v is Hex => typeof v === 'string' && /^0x[0-9a-fA-F]{130}$/.test(v)

async function useNonce(sql: Sql, signer: string, nonce: bigint) {
  const rows = await sql`insert into used_nonces (signer, nonce) values (${signer}, ${nonce.toString()}) on conflict do nothing returning 1`
  return rows.length === 1
}

function offerOut(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    grader: r.grader,
    cert: r.cert,
    kind: r.kind,
    from: r.from_addr,
    priceJpy: Number(r.price_jpy),
    note: r.note,
    expiry: r.expiry,
    createdAt: r.created_at,
    card: r.card ?? null,
    grade: r.grade ?? null,
  }
}

function submissionOut(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    grader: r.grader,
    submitter: r.submitter,
    card: r.card,
    declaredValueJpy: Number(r.declared_value_jpy),
    service: r.service,
    status: r.status,
    grade: r.grade,
    cert: r.cert,
    issueTx: r.issue_tx,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/// Open offers only: not withdrawn, not expired, and asks only while the asker still holds the title.
const OPEN = (sql: Sql) => sql`
  o.status = 'open' and o.expiry > now()
  and (o.kind = 'bid' or o.from_addr = (select holder from titles t where t.grader = o.grader and t.cert = o.cert))`

export function signedRoutes(app: Hono, sql: Sql, out: Out) {
  app.get('/titles/:grader/:cert/offers', async (c) => {
    const { grader, cert } = c.req.param()
    const rows = await sql`select o.* from offers o where o.grader = ${grader} and o.cert = ${cert} and ${OPEN(sql)} order by o.kind, o.price_jpy desc`
    return out(c, rows.map(offerOut))
  })

  app.get('/offers', async (c) => {
    const kind = c.req.query('kind') === 'bid' ? 'bid' : c.req.query('kind') === 'ask' ? 'ask' : null
    const rows = await sql`
      select o.*, t.card, t.grade from offers o join titles t using (grader, cert)
      where ${OPEN(sql)} and (${kind}::text is null or o.kind = ${kind}) order by o.created_at desc limit 200`
    return out(c, rows.map(offerOut))
  })

  app.get('/holders/:address/offers', async (c) => {
    const a = c.req.param('address').toLowerCase()
    const made = await sql`select o.*, t.card, t.grade from offers o join titles t using (grader, cert) where o.from_addr = ${a} and ${OPEN(sql)} order by o.created_at desc`
    const received = await sql`
      select o.*, t.card, t.grade from offers o join titles t using (grader, cert)
      where o.kind = 'bid' and t.holder = ${a} and ${OPEN(sql)} order by o.created_at desc`
    return out(c, { made: made.map(offerOut), received: received.map(offerOut) })
  })

  app.post('/offers', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body || !isSig(body.signature)) return out(c, { error: 'bad request' }, 400)
    const m = body.message ?? {}
    const offer: Offer = {
      grader: String(m.grader),
      cert: String(m.cert),
      kind: m.kind,
      priceJpy: big(m.priceJpy),
      note: String(m.note ?? ''),
      nonce: big(m.nonce),
      expiry: big(m.expiry),
    }
    const problem = graderByLabel(offer.grader) ? checkOffer(offer) : 'unknown grader'
    if (problem) return out(c, { error: problem }, 400)
    const signer = (await recoverOffer(offer, body.signature)).toLowerCase()
    const [title] = await sql`select holder from titles where grader = ${offer.grader} and cert = ${offer.cert}`
    if (!title) return out(c, { error: 'no such title' }, 404)
    if (offer.kind === 'ask' && title.holder !== signer) return out(c, { error: 'only the current holder can ask' }, 403)
    if (offer.kind === 'bid' && title.holder === signer) return out(c, { error: 'the holder cannot bid on their own title' }, 400)
    if (!(await useNonce(sql, signer, offer.nonce))) return out(c, { error: 'signature already used' }, 409)
    const [row] = await sql.begin(async (tx) => {
      // one open offer per signer, kind and title: a new one replaces the old
      await tx`update offers set status = 'withdrawn' where grader = ${offer.grader} and cert = ${offer.cert} and from_addr = ${signer} and kind = ${offer.kind} and status = 'open'`
      return tx`
        insert into offers (grader, cert, kind, from_addr, price_jpy, note, nonce, expiry, signature)
        values (${offer.grader}, ${offer.cert}, ${offer.kind}, ${signer}, ${offer.priceJpy.toString()}, ${offer.note}, ${offer.nonce.toString()},
          to_timestamp(${Number(offer.expiry)}), ${body.signature}) returning *`
    })
    return out(c, offerOut(row), 201)
  })

  app.post('/offers/:id/withdraw', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body || !isSig(body.signature)) return out(c, { error: 'bad request' }, 400)
    const id = big(c.req.param('id'))
    const nonce = big(body.nonce)
    const signer = (await recoverWithdraw({ offerId: id, nonce }, body.signature)).toLowerCase()
    const [offer] = await sql`select from_addr from offers where id = ${id.toString()}`
    if (!offer) return out(c, { error: 'no such offer' }, 404)
    if (offer.from_addr !== signer) return out(c, { error: 'only the signer can withdraw' }, 403)
    if (!(await useNonce(sql, signer, nonce))) return out(c, { error: 'signature already used' }, 409)
    await sql`update offers set status = 'withdrawn' where id = ${id.toString()}`
    return out(c, { ok: true })
  })

  app.get('/submissions', async (c) => {
    const grader = c.req.query('grader') ?? null
    const submitter = c.req.query('submitter')?.toLowerCase() ?? null
    const rows = await sql`
      select * from submissions where (${grader}::text is null or grader = ${grader}) and (${submitter}::text is null or submitter = ${submitter})
      order by created_at desc limit 200`
    return out(c, rows.map(submissionOut))
  })

  app.post('/submissions', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body || !isSig(body.signature)) return out(c, { error: 'bad request' }, 400)
    const m = body.message ?? {}
    const s: Submission = { grader: String(m.grader), card: String(m.card), declaredValueJpy: big(m.declaredValueJpy), service: String(m.service), nonce: big(m.nonce) }
    const problem = checkSubmission(s, GRADERS.map((g) => g.label))
    if (problem) return out(c, { error: problem }, 400)
    const signer = (await recoverSubmission(s, body.signature)).toLowerCase()
    if (!(await useNonce(sql, signer, s.nonce))) return out(c, { error: 'signature already used' }, 409)
    const [row] = await sql`
      insert into submissions (grader, submitter, card, declared_value_jpy, service, nonce, signature)
      values (${s.grader}, ${signer}, ${s.card.trim()}, ${s.declaredValueJpy.toString()}, ${s.service}, ${s.nonce.toString()}, ${body.signature}) returning *`
    return out(c, submissionOut(row), 201)
  })

  app.post('/submissions/:id/actions', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body || !isSig(body.signature)) return out(c, { error: 'bad request' }, 400)
    const m = body.message ?? {}
    const id = big(c.req.param('id'))
    const action: GraderAction = { submissionId: id, action: m.action, grade: String(m.grade ?? ''), cert: String(m.cert ?? ''), txHash: String(m.txHash ?? ''), nonce: big(m.nonce) }
    const [row] = await sql`select * from submissions where id = ${id.toString()}`
    if (!row) return out(c, { error: 'no such submission' }, 404)
    const grader = graderByLabel(row.grader as string)!
    const signer = await recoverGraderAction(action, body.signature)
    if (!isAddressEqual(signer, grader.grader as Address)) return out(c, { error: `only ${grader.short} can move its submissions` }, 403)
    const problem = checkGraderAction(action, row.status as string)
    if (problem) return out(c, { error: problem }, 400)
    if (action.action === 'issued' && !(await issuanceMatches(action.txHash as Hex, grader.controller, row.cert as string))) {
      return out(c, { error: `transaction ${action.txHash} is not ${grader.short} issuing cert #${row.cert}` }, 400)
    }
    if (!(await useNonce(sql, signer.toLowerCase(), action.nonce))) return out(c, { error: 'signature already used' }, 409)
    const [updated] = await sql`
      update submissions set status = ${action.action}, updated_at = now(),
        grade = coalesce(nullif(${action.grade}, ''), grade), cert = coalesce(nullif(${action.cert}, ''), cert),
        issue_tx = coalesce(nullif(${action.txHash}, ''), issue_tx)
      where id = ${id.toString()} returning *`
    return out(c, submissionOut(updated))
  })
}

// Demo trade interest and grading submissions (v3, off-chain, EIP-712 signed): collectors sign
// asks and bids and submit cards; graders sign status moves. Posted to the Nafuda API, which
// verifies every signature. Nothing here moves a title.
//
//   node --env-file=../.env src/social.ts --api https://nafuda.sololin.xyz/api
//   (also a smoke test of the write endpoints: bad signatures and wrong signers must be refused)

import { mnemonicToAccount, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { DOMAIN, TYPES, type GraderAction, type Offer, type Submission } from '../../packages/core/src/signed.ts'
import { collectorAccounts } from './collectors.ts'
import { loadConfig, networkFromArgs } from './config.ts'
import { CATALOG, GRADERS, prng, priceFor } from './seed-plan.ts'

const argApi = process.argv.indexOf('--api')
const API = argApi >= 0 ? process.argv[argApi + 1] : 'http://localhost:3310/api'
const cfg = loadConfig(networkFromArgs())
const accounts = collectorAccounts()
const rand = prng(260926)
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
let failures = 0

type Account = PrivateKeyAccount | ReturnType<typeof mnemonicToAccount>
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))

async function post(path: string, body: unknown, expect: number) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json(body) })
  const text = await res.text()
  if (res.status !== expect) {
    failures++
    console.log(`✗ POST ${path} → ${res.status} (expected ${expect}) ${text.slice(0, 160)}`)
  }
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

let nonceClock = Date.now()
const nonce = () => BigInt(nonceClock++)

async function offer(account: Account, o: Omit<Offer, 'nonce' | 'expiry'>, expect = 201) {
  const message: Offer = { ...o, nonce: nonce(), expiry: BigInt(Math.floor(Date.now() / 1000) + 7 * 86400) }
  const signature = await account.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'Offer', message })
  return post('/offers', { message, signature }, expect)
}

async function submit(account: Account, s: Omit<Submission, 'nonce'>) {
  const message: Submission = { ...s, nonce: nonce() }
  const signature = await account.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'Submission', message })
  return post('/submissions', { message, signature }, 201)
}

async function act(account: Account, id: string, a: Omit<GraderAction, 'submissionId' | 'nonce'>, expect = 200) {
  const message: GraderAction = { ...a, submissionId: BigInt(id), nonce: nonce() }
  const signature = await account.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'GraderAction', message })
  return post(`/submissions/${id}/actions`, { message, signature }, expect)
}

// Titles and who holds them, from the API
const titles: { grader: string; cert: string; card: string; grade: string; holder: string }[] = (await (await fetch(`${API}/titles?limit=200`)).json()).items
const byAddress = new Map(Object.entries(accounts).map(([name, a]) => [a.address.toLowerCase(), { name, a }]))
const held = titles.filter((t) => byAddress.has(t.holder))
console.log(`== social on ${API}: ${titles.length} titles, ${held.length} held by demo keys ==`)

// Asks: some holders are open to trade at the next card show
for (const t of held.filter(() => rand() < 0.35)) {
  const { a } = byAddress.get(t.holder)!
  const price = Math.round((priceFor(rand, t.card, t.grade) * 1.15) / 500) * 500
  await offer(a, { grader: t.grader, cert: t.cert, kind: 'ask', priceJpy: BigInt(price), note: pick(['At the Tokyo show on Saturday.', 'Open to trades too.', 'Firm price.', 'Can meet in Akihabara.']) })
}

// Bids: collectors ask holders to sell
const bidders = Object.entries(accounts).filter(([n]) => n !== 'mallory')
for (let i = 0; i < 16; i++) {
  const t = pick(titles)
  const [, a] = pick(bidders.filter(([, x]) => x.address.toLowerCase() !== t.holder))
  const price = Math.round((priceFor(rand, t.card, t.grade) * 0.9) / 500) * 500
  await offer(a, { grader: t.grader, cert: t.cert, kind: 'bid', priceJpy: BigInt(price), note: pick(['Meet at the Tokyo show?', 'Will tap before paying.', 'Cash at the show.', '']) })
}

// Refusals the API must enforce
const someone = held[0]
if (someone) {
  const notHolder = bidders.find(([, x]) => x.address.toLowerCase() !== someone.holder)![1]
  await offer(notHolder, { grader: someone.grader, cert: someone.cert, kind: 'ask', priceJpy: 1000n, note: 'not mine' }, 403)
  const holder = byAddress.get(someone.holder)!.a
  await offer(holder, { grader: someone.grader, cert: someone.cert, kind: 'bid', priceJpy: 1000n, note: 'own title' }, 400)
}

// Submissions: collectors send cards to graders; graders move some along
const submitted: { id: string; grader: string }[] = []
for (let i = 0; i < 12; i++) {
  const [, a] = pick(bidders)
  const g = pick(Object.keys(GRADERS))
  const r = await submit(a, { grader: g, card: pick(CATALOG).card, declaredValueJpy: BigInt(Math.round((5000 + rand() * 200000) / 1000) * 1000), service: pick(['Economy', 'Regular', 'Express']) })
  if (r.body?.id) submitted.push({ id: r.body.id, grader: g })
}
for (const [i, s] of submitted.entries()) {
  const grader = cfg.graderAccount(s.grader)
  if (i % 3 === 0) continue // stays "received"
  await act(grader, s.id, { action: 'grading', grade: '', cert: '', txHash: '' })
  if (i % 3 === 2) {
    const def = GRADERS[s.grader]
    await act(grader, s.id, { action: 'sealed', grade: def.scale[1], cert: String(def.seedCertStart + 40 + i), txHash: '' })
  }
}
// A grader cannot move another grader's submission, nor skip a step
if (submitted.length) {
  const other = Object.keys(GRADERS).find((g) => g !== submitted[0].grader)!
  await act(cfg.graderAccount(other), submitted[0].id, { action: 'grading', grade: '', cert: '', txHash: '' }, 403)
  const stranger = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
  await act(stranger, submitted[0].id, { action: 'grading', grade: '', cert: '', txHash: '' }, 403)
}

console.log(failures ? `\n${failures} unexpected responses` : '\nall responses as expected')
process.exit(failures ? 1 : 0)

// Set up Curvegrid MultiBaas as Nafuda's second witness, with the official TypeScript SDK. Every
// step checks what exists first, so re-running changes nothing. Needs MULTIBAAS_URL and
// MULTIBAAS_API_KEY in ../.env (an Administrator key; it stays on this machine: the server only
// ever gets the webhook secret).
//
//   npm run multibaas -- plan                           the deployment's real limits (GET /plan)
//   npm run multibaas -- webhook --secret-out <file>    create the webhook; its signing secret is
//                                                       written to <file> (mode 600), never printed
//   npm run multibaas -- link                           add the registry ABI, alias and link the
//                                                       three grader registries (startingBlock -100)
//   npm run multibaas -- status                         links, indexing, webhook health
//
// Order: webhook → put the secret on the server → link. Linking starts the event sync, so the
// first deliveries find the endpoint ready.

import { AdminApi, AddressesApi, Configuration, ContractsApi, EventsApi, WebhooksApi } from '@curvegrid/multibaas-sdk'
import { writeFileSync } from 'node:fs'
import { formatAbiItem } from 'viem/utils'
import { transferBatchEvent, transferSingleEvent } from '../../packages/core/src/abis.ts'
import { GRADERS } from '../../packages/core/src/deployment.ts'

const CONTRACT = 'nafuda-title-registry'
const WEBHOOK = 'nafuda-second-witness'
const HOOK_URL = process.env.MULTIBAAS_HOOK_URL ?? 'https://nafuda.sololin.xyz/api/hooks/multibaas'
const alias = (label: string) => `${label}-registry`

const url = process.env.MULTIBAAS_URL?.replace(/\/+$/, '')
const key = process.env.MULTIBAAS_API_KEY
if (!url || !key) throw new Error('MULTIBAAS_URL and MULTIBAAS_API_KEY must be set in ../.env')
const config = new Configuration({ basePath: `${url}/api/v0`, accessToken: key })
const admin = new AdminApi(config)
const addresses = new AddressesApi(config)
const contracts = new ContractsApi(config)
const events = new EventsApi(config)
const webhooks = new WebhooksApi(config)

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const notFound = (e: unknown) => (e as { response?: { status?: number } }).response?.status === 404
/// SDK errors carry the whole axios request, including the Authorization header: print only
/// the status and MultiBaas' message.
const reason = (e: unknown) => {
  const r = (e as { response?: { status?: number; data?: { message?: string } } }).response
  return r ? `HTTP ${r.status}: ${r.data?.message ?? ''}` : String((e as Error).message ?? e)
}

async function plan() {
  const { data } = await admin.getPlan()
  console.log(`plan: ${data.result.name}`)
  for (const l of data.result.limits) console.log(`  ${l.name.padEnd(32)} ${l.limit}`)
  for (const f of data.result.features ?? []) console.log(`  feature ${JSON.stringify(f)}`)
}

async function webhook() {
  const out = arg('secret-out')
  const { data } = await webhooks.listWebhooks()
  const existing = data.result.find((w) => w.label === WEBHOOK)
  if (existing) {
    if (existing.url !== HOOK_URL) {
      await webhooks.updateWebhook(existing.id, { url: HOOK_URL, label: WEBHOOK, subscriptions: ['event.emitted'] })
      console.log(`webhook ${WEBHOOK}: url updated to ${HOOK_URL}`)
    } else console.log(`webhook ${WEBHOOK}: exists (id ${existing.id}) → ${HOOK_URL}`)
    if (out) {
      const { data: full } = await webhooks.getWebhook(existing.id)
      writeFileSync(out, `MULTIBAAS_WEBHOOK_SECRET=${full.result.secret}\n`, { mode: 0o600 })
      console.log(`  secret written to ${out}`)
    }
    return
  }
  if (!out) throw new Error('--secret-out <file> is required when creating the webhook (the secret is shown only in the create response)')
  const { data: created } = await webhooks.createWebhook({ url: HOOK_URL, label: WEBHOOK, subscriptions: ['event.emitted'] })
  writeFileSync(out, `MULTIBAAS_WEBHOOK_SECRET=${created.result.secret}\n`, { mode: 0o600 })
  console.log(`webhook ${WEBHOOK}: created (id ${created.result.id}) → ${HOOK_URL}; secret written to ${out}`)
}

async function link() {
  // A minimal ABI: the two transfer events of the ENSv2 registry. Mints are issuances.
  const rawAbi = JSON.stringify([transferSingleEvent, transferBatchEvent])
  try {
    await contracts.getContract(CONTRACT)
    console.log(`contract ${CONTRACT}: in the library`)
  } catch (e) {
    if (!notFound(e)) throw e
    await contracts.createContract(CONTRACT, { label: CONTRACT, contractName: 'NafudaTitleRegistry', version: '1.0', rawAbi })
    console.log(`contract ${CONTRACT}: added (${[transferSingleEvent, transferBatchEvent].map((e) => formatAbiItem(e)).join(', ')})`)
  }
  for (const g of GRADERS) {
    const a = alias(g.label)
    let linked: string[] = []
    try {
      const { data } = await addresses.getAddress(a)
      if (data.result.address.toLowerCase() !== g.registry.toLowerCase()) throw new Error(`alias ${a} points at ${data.result.address}, expected ${g.registry}`)
      linked = (data.result.contracts ?? []).map((c) => c.label)
    } catch (e) {
      if (!notFound(e)) throw e
      await addresses.setAddress({ alias: a, address: g.registry })
      console.log(`alias ${a} → ${g.registry}`)
    }
    if (linked.includes(CONTRACT)) console.log(`${a}: linked`)
    else {
      await contracts.linkAddressContract(a, { label: CONTRACT, startingBlock: '-100' })
      console.log(`${a}: linked, syncing events from 100 blocks back`)
    }
  }
}

async function status() {
  for (const g of GRADERS) {
    const a = alias(g.label)
    try {
      const { data } = await contracts.getEventIndexingStatus(a, CONTRACT)
      console.log(`${a}: ${JSON.stringify(data.result)}`)
    } catch (e) {
      console.log(`${a}: ${reason(e)}`)
    }
  }
  const { data } = await webhooks.listWebhooks()
  for (const w of data.result.filter((w) => w.label === WEBHOOK)) {
    const { data: count } = await webhooks.countWebhookEvents(w.id)
    console.log(`webhook ${w.label} → ${w.url}: ${count.result} events, failed calls since last success: ${w.failedCalls}${w.lastError ? `, last error: ${w.lastError}` : ''}`)
  }
  const { data: ev } = await events.getEventCount(undefined, undefined, undefined, undefined, undefined, undefined, undefined, CONTRACT)
  console.log(`events stored for ${CONTRACT}: ${ev.result}`)
}

const commands: Record<string, () => Promise<void>> = { plan, webhook, link, status }
const cmd = process.argv[2]
if (!cmd || !commands[cmd]) throw new Error(`usage: multibaas.ts ${Object.keys(commands).join('|')}`)
try {
  await commands[cmd]()
} catch (e) {
  console.error(`${cmd} failed: ${reason(e)}`)
  process.exit(1)
}

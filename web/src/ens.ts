// Read a title exactly the way any ENS client would: viem + the ENSv2 Universal Resolver.
// The TitleController answers as the wildcard resolver of the grader name.

import { createPublicClient, http, type Address } from 'viem'
import { sepolia } from 'viem/chains'
import { normalize } from 'viem/ens'
import { GRADER_NAME, SEPOLIA_RPC_URL, UNIVERSAL_RESOLVER } from './config.ts'
import type { Title } from './verify.ts'

export const client = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC_URL) })

/// Same rule as TitleController._isCanonicalCert: digits only, no leading zero, 1–10 digits.
export const isCanonicalCert = (cert: string) => /^[1-9][0-9]{0,9}$/.test(cert)

export const certName = (cert: string) => `${cert}.${GRADER_NAME}`

export type TitleView = Title & {
  name: string
  card: string | null
  grade: string | null
  issuedAt: Date | null
  grader: string | null
}

export async function lookupTitle(cert: string): Promise<TitleView> {
  const name = normalize(certName(cert))
  const opts = { name, universalResolverAddress: UNIVERSAL_RESOLVER }
  const text = (key: string) => client.getEnsText({ ...opts, key })
  const [holder, status, chip, card, grade, issuedAt, grader] = await Promise.all([
    client.getEnsAddress(opts),
    text('title.status'),
    text('slab.chip'),
    text('card'),
    text('grade'),
    text('issued_at'),
    text('grader'),
  ])
  return {
    name,
    status: status === 'ISSUED' ? 'ISSUED' : 'NONE',
    holder: holder ?? null,
    chip: (chip as Address | null) ?? null,
    card,
    grade,
    issuedAt: issuedAt ? new Date(Number(issuedAt) * 1000) : null,
    grader,
  }
}

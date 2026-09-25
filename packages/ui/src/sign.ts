// Sign Nafuda's EIP-712 messages with the connected wallet and post them to the API.

import { DOMAIN, TYPES, type GraderAction, type Offer, type Submission } from '@nafuda/core/signed.ts'
import type { Address, WalletClient } from 'viem'
import { apiPost, type OfferRow, type SubmissionRow } from './api.ts'

type Client = () => Promise<{ wallet: WalletClient; account: Address }>
const nonce = () => BigInt(Date.now())

export async function signOffer(client: Client, o: Omit<Offer, 'nonce' | 'expiry'>, days = 7) {
  const { wallet, account } = await client()
  const message: Offer = { ...o, nonce: nonce(), expiry: BigInt(Math.floor(Date.now() / 1000) + days * 86400) }
  const signature = await wallet.signTypedData({ account, domain: DOMAIN, types: TYPES, primaryType: 'Offer', message })
  return apiPost<OfferRow>('/offers', { message, signature })
}

export async function withdrawOffer(client: Client, offerId: string) {
  const { wallet, account } = await client()
  const message = { offerId: BigInt(offerId), nonce: nonce() }
  const signature = await wallet.signTypedData({ account, domain: DOMAIN, types: TYPES, primaryType: 'Withdraw', message })
  return apiPost<{ ok: true }>(`/offers/${offerId}/withdraw`, { nonce: message.nonce, signature })
}

export async function signSubmission(client: Client, s: Omit<Submission, 'nonce'>) {
  const { wallet, account } = await client()
  const message: Submission = { ...s, nonce: nonce() }
  const signature = await wallet.signTypedData({ account, domain: DOMAIN, types: TYPES, primaryType: 'Submission', message })
  return apiPost<SubmissionRow>('/submissions', { message, signature })
}

export async function signGraderAction(client: Client, submissionId: string, a: Omit<GraderAction, 'submissionId' | 'nonce'>) {
  const { wallet, account } = await client()
  const message: GraderAction = { ...a, submissionId: BigInt(submissionId), nonce: nonce() }
  const signature = await wallet.signTypedData({ account, domain: DOMAIN, types: TYPES, primaryType: 'GraderAction', message })
  return apiPost<SubmissionRow>(`/submissions/${submissionId}/actions`, { message, signature })
}

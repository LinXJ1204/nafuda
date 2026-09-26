// Issue one title: every contract rule checked first (core/issue-rules.ts), the call simulated,
// then sent from the grader's wallet and awaited. Shared by the Issue page and the intake
// board's batch issue.

import type { Address, Hash, WalletClient } from 'viem'
import { controllerAbi } from '@nafuda/core/abis.ts'
import type { Grader } from '@nafuda/core/deployment.ts'
import { attributesFor, precheck, type IssueForm } from '@nafuda/core/issue-rules.ts'
import { publicClient } from '@nafuda/ui/ens.ts'

export class NotSent extends Error {}

export async function issueTitle(
  client: () => Promise<{ wallet: WalletClient; account: Address }>,
  account: Address | null,
  grader: Grader,
  form: IssueForm,
  onStatus: (text: string, tx?: Hash) => void = () => {},
): Promise<Hash> {
  onStatus('Checking on chain…')
  const heldBy = (await publicClient.readContract({ address: grader.controller, abi: controllerAbi, functionName: 'holderOf', args: [form.cert] })) as Address
  const reason = precheck(form, grader, account, heldBy)
  if (reason) throw new NotSent(reason)
  const { keys, values } = attributesFor(form, grader)
  const base = [form.cert, form.holder as Address, form.chip, form.card.trim(), form.grade] as const
  const target = { address: grader.controller, abi: controllerAbi } as const
  const withAttributes = grader.controllerVersion === 2 && keys.length > 0
  // Simulate first: a revert here costs nothing and names the reason.
  if (withAttributes) await publicClient.simulateContract({ ...target, account: account!, functionName: 'issueWithAttributes', args: [...base, keys, values] })
  else await publicClient.simulateContract({ ...target, account: account!, functionName: 'issue', args: base })
  onStatus('Confirm in your wallet…')
  const { wallet, account: from } = await client()
  const hash = withAttributes
    ? await wallet.writeContract({ ...target, account: from, chain: wallet.chain, functionName: 'issueWithAttributes', args: [...base, keys, values] })
    : await wallet.writeContract({ ...target, account: from, chain: wallet.chain, functionName: 'issue', args: base })
  onStatus('Waiting for the block…', hash)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('issue reverted')
  return hash
}

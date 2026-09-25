// Trust view (#/trust): what the grader can and cannot do, proven from the chain on every load.
// Reads the registries directly; the scoring is in trust-rules.ts.

import { labelhash, type Address } from 'viem'
import { ETH_REGISTRY, GRADER_LABEL, NAFUDA_REGISTRY, PSA_REGISTRY, ROOT_NAME, TITLE_CONTROLLER } from '../lib/config.ts'
import { registryAbi } from '../lib/contracts.ts'
import { addressLink, el, errorText, firstLine, kv, muted } from '../lib/dom.ts'
import { client } from '../lib/ens.ts'
import { titleIndex } from '../lib/index-store.ts'
import { ROLE, decodeRoles } from '../lib/roles.ts'
import type { View } from '../lib/view.ts'
import { graderAddress } from './grader.ts'
import { evaluateTrust, type TrustCheck, type TrustFacts } from './trust-rules.ts'

const NAME_LABEL = ROOT_NAME.replace(/\.eth$/, '')

async function readFacts() {
  const read = <T>(address: Address, functionName: string, args: unknown[] = []) =>
    client.readContract({ address, abi: registryAbi, functionName, args } as never) as Promise<T>
  const graderNameId = BigInt(labelhash(GRADER_LABEL))
  const rootNameId = BigInt(labelhash(NAME_LABEL))

  const [grader, operator, titles] = await Promise.all([graderAddress(), read<Address>(ETH_REGISTRY, 'getOwner', [rootNameId]), titleIndex()])
  const [psaEmancipated, controllerIsRegistrar, graderRootRoles, psaParent, nafudaParent, nafudaEmancipated, graderNameTokenRoles, operatorNameTokenRoles, operatorRootNameRoles, holderRoles] =
    await Promise.all([
      read<boolean>(PSA_REGISTRY, 'isEmancipated'),
      read<boolean>(PSA_REGISTRY, 'hasRootRoles', [ROLE.REGISTRAR, TITLE_CONTROLLER]),
      read<bigint>(PSA_REGISTRY, 'roles', [0n, grader]),
      read<[Address, string]>(PSA_REGISTRY, 'getParent'),
      read<[Address, string]>(NAFUDA_REGISTRY, 'getParent'),
      read<boolean>(NAFUDA_REGISTRY, 'isEmancipated'),
      read<bigint>(NAFUDA_REGISTRY, 'roles', [graderNameId, grader]),
      read<bigint>(NAFUDA_REGISTRY, 'roles', [graderNameId, operator]),
      read<bigint>(ETH_REGISTRY, 'roles', [rootNameId, operator]),
      Promise.all(titles.map(async (t) => ({ cert: t.cert, roles: await read<bigint>(PSA_REGISTRY, 'roles', [t.labelId, t.holder]) }))),
    ])
  const facts: TrustFacts = {
    psaEmancipated,
    controllerIsRegistrar,
    graderRootRoles,
    holderRoles,
    psaParent: { parent: psaParent[0], label: psaParent[1] },
    nafudaParent: { parent: nafudaParent[0], label: nafudaParent[1] },
    expected: { nafudaRegistry: NAFUDA_REGISTRY, ethRegistry: ETH_REGISTRY, graderLabel: GRADER_LABEL, nameLabel: NAME_LABEL },
    nafudaEmancipated,
    graderNameTokenRoles,
    operatorNameTokenRoles,
    operatorRootNameRoles,
  }
  return { facts, grader, operator }
}

const row = (c: TrustCheck, pendingText: string) =>
  el(
    'li',
    { className: `check ${c.ok ? 'ok' : c.group === 'lock' ? 'pending' : 'bad'}` },
    el('span', { className: 'check-icon', textContent: c.ok ? '✓' : c.group === 'lock' ? '○' : '✗' }),
    el('div', {}, el('strong', { textContent: c.title }), el('p', { textContent: c.ok || c.group !== 'lock' ? c.body : `${pendingText} ${c.body}` })),
  )

const rolesText = (bitmap: bigint) => decodeRoles(bitmap).join(', ') || 'none'

export async function trustPage(view: View) {
  view.main.append(
    el('h1', { textContent: 'What PSA-Sim can and cannot do' }),
    muted('Every line below is read from Sepolia when this page loads. Nothing here is a claim you have to take on trust.'),
  )
  const body = el('div', {}, muted('Reading registries…'))
  view.main.append(body)

  let data: Awaited<ReturnType<typeof readFacts>>
  try {
    data = await readFacts()
  } catch (e) {
    if (view.alive()) body.replaceChildren(errorText(`Could not read the registries: ${firstLine(e)}`))
    return
  }
  if (!view.alive()) return
  const { facts, grader, operator } = data
  const checks = evaluateTrust(facts)
  const titleChecks = checks.filter((c) => c.group === 'titles')
  const lockChecks = checks.filter((c) => c.group === 'lock')
  const locked = lockChecks.every((c) => c.ok)

  body.replaceChildren(
    el(
      'section',
      { className: 'card' },
      el('h2', { textContent: 'Issued titles are out of the grader’s hands' }),
      el('ul', { className: 'checks-list' }, ...titleChecks.map((c) => row(c, ''))),
    ),
    el(
      'section',
      { className: 'card' },
      el('h2', {}, 'Final lock ', el('span', { className: `pill ${locked ? 'issued' : 'waiting'}`, textContent: locked ? 'Applied' : 'Not applied yet' })),
      muted(
        locked
          ? 'The one-way lock has been applied: the whole path from .eth to every title is fixed.'
          : 'Until the one-way lock (scripts/src/lock.ts) runs, the operator could still swap the whole psa-sim subtree. It is irreversible, so it is applied once the demo deployment is final.',
      ),
      el('ul', { className: 'checks-list' }, ...lockChecks.map((c) => row(c, 'Not yet:'))),
    ),
    el(
      'section',
      { className: 'card' },
      el('h2', { textContent: 'Raw on-chain data' }),
      kv([
        ['Grader (TitleController.GRADER)', addressLink(grader)],
        ['Grader roles on the title registry', el('span', { className: 'mono', textContent: rolesText(facts.graderRootRoles) })],
        ['TitleController', addressLink(TITLE_CONTROLLER)],
        ['Title registry', addressLink(PSA_REGISTRY)],
        [`${NAME_LABEL}.eth registry`, addressLink(NAFUDA_REGISTRY)],
        [`Operator (owner of ${NAME_LABEL}.eth)`, addressLink(operator)],
        [`Grader roles on ${GRADER_LABEL}`, el('span', { className: 'mono', textContent: rolesText(facts.graderNameTokenRoles) })],
        [`Operator roles on ${NAME_LABEL}.eth`, el('span', { className: 'mono', textContent: rolesText(facts.operatorRootNameRoles) })],
        ['Holder roles', el('span', { className: 'mono', textContent: [...new Set(facts.holderRoles.map((h) => rolesText(h.roles)))].join(' / ') || '—' })],
      ]),
    ),
  )
}

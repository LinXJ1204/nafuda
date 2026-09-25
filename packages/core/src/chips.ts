// Simulated slab chips. A real deployment uses an NFC chip such as Arx HaLo, which signs EIP-191
// messages with a key that never leaves the chip; the demo derives public test keys instead:
//   psa-sim: keccak256("nafuda-demo-chip:<variant>:<cert>")        (the original demo formula)
//   others:  keccak256("nafuda-demo-chip:<grader>:<variant>:<cert>")

import { keccak256, toBytes, type Address, type Hex } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

export type ChipVariant = 'genuine' | 'clone'

export function chipKey(grader: string, variant: ChipVariant, cert: string): Hex {
  const seed = grader === 'psa-sim' ? `nafuda-demo-chip:${variant}:${cert}` : `nafuda-demo-chip:${grader}:${variant}:${cert}`
  return keccak256(toBytes(seed))
}

export interface SlabChip {
  /// EIP-191 personal_sign over `message`.
  sign(message: string): Promise<Hex>
}

/// SIMULATED: the key is a public demo key. A real chip keeps its key inside the slab.
export class SimulatedChip implements SlabChip {
  private readonly account: PrivateKeyAccount
  constructor(grader: string, variant: ChipVariant, cert: string) {
    this.account = privateKeyToAccount(chipKey(grader, variant, cert))
  }
  get address(): Address {
    return this.account.address
  }
  sign(message: string): Promise<Hex> {
    return this.account.signMessage({ message })
  }
}

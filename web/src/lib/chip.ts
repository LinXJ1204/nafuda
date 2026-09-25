// Slab chip interface. The hackathon demo uses a SimulatedChip (a key in the browser);
// a real deployment swaps in an NFC chip such as Arx HaLo, which also signs EIP-191
// messages with a key that never leaves the chip.
//
// Swapping in HaLo is one class (libhalo, not a dependency of this demo):
//
//   import { execHaloCmdWeb } from '@arx-research/libhalo/api/web'
//   class HaloChip implements SlabChip {
//     async sign(message: string) {
//       const res = await execHaloCmdWeb({ name: 'sign', message, format: 'text' })
//       return res.signature.ether as Hex
//     }
//   }

import type { Address, Hex } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

export interface SlabChip {
  /// EIP-191 personal_sign over `message`.
  sign(message: string): Promise<Hex>
}

/// SIMULATED: the private key is a public demo key from demo/slabs.json. A real chip keeps its
/// key inside the slab and never exposes it.
export class SimulatedChip implements SlabChip {
  private readonly account: PrivateKeyAccount

  constructor(privateKey: Hex) {
    this.account = privateKeyToAccount(privateKey)
  }

  get address(): Address {
    return this.account.address
  }

  sign(message: string): Promise<Hex> {
    return this.account.signMessage({ message })
  }
}
